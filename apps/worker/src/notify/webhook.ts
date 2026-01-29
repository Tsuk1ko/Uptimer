import pLimit from 'p-limit';

import type { WebhookChannelConfig } from '@uptimer/db';

import { claimNotificationDelivery, finalizeNotificationDelivery } from './dedupe';

export type WebhookChannel = {
  id: number;
  name: string;
  config: WebhookChannelConfig;
};

export type WebhookDispatchResult = {
  status: 'success' | 'failed';
  httpStatus: number | null;
  error: string | null;
};

const DEFAULT_TIMEOUT_MS = 5000;
const WEBHOOK_CONCURRENCY = 5;

function isAbortError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name?: unknown }).name === 'AbortError';
  }
  return false;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toHex(sig);
}

function readEnvSecret(env: Record<string, unknown>, ref: string): string | null {
  const v = env[ref];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function dispatchWebhookToChannel(args: {
  db: D1Database;
  env: Record<string, unknown>;
  channel: WebhookChannel;
  eventKey: string;
  payload: unknown;
}): Promise<'sent' | 'skipped'> {
  const now = Math.floor(Date.now() / 1000);
  const claimed = await claimNotificationDelivery(args.db, args.eventKey, args.channel.id, now);
  if (!claimed) {
    return 'skipped';
  }

  const config = args.channel.config;
  const method = config.method.toUpperCase();
  const headers = new Headers(config.headers ?? undefined);

  const canHaveBody = method !== 'GET' && method !== 'HEAD';
  const rawBody = canHaveBody ? JSON.stringify(args.payload) : '';

  if (canHaveBody && !headers.has('content-type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  if (config.signing?.enabled) {
    const secret = readEnvSecret(args.env, config.signing.secret_ref);
    if (!secret) {
      await finalizeNotificationDelivery(args.db, args.eventKey, args.channel.id, {
        status: 'failed',
        httpStatus: null,
        error: `Signing secret not configured: ${config.signing.secret_ref}`,
      });
      return 'sent';
    }

    const timestamp = now;
    const sig = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
    headers.set('X-Uptimer-Timestamp', String(timestamp));
    headers.set('X-Uptimer-Signature', `sha256=${sig}`);
  }

  const timeoutMs = config.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let outcome: WebhookDispatchResult;
  try {
    const init: RequestInit = { method, headers, signal: controller.signal };
    if (canHaveBody) {
      init.body = rawBody;
    }

    const res = await fetch(config.url, init);
    res.body?.cancel();

    if (res.ok) {
      outcome = { status: 'success', httpStatus: res.status, error: null };
    } else {
      outcome = { status: 'failed', httpStatus: res.status, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    outcome = {
      status: 'failed',
      httpStatus: null,
      error: isAbortError(err) ? `Timeout after ${timeoutMs}ms` : toErrorMessage(err),
    };
  } finally {
    clearTimeout(t);
  }

  await finalizeNotificationDelivery(args.db, args.eventKey, args.channel.id, outcome);
  return 'sent';
}

export async function dispatchWebhookToChannels(args: {
  db: D1Database;
  env: Record<string, unknown>;
  channels: WebhookChannel[];
  eventKey: string;
  payload: unknown;
}): Promise<void> {
  if (args.channels.length === 0) return;

  const limit = pLimit(WEBHOOK_CONCURRENCY);
  const settled = await Promise.allSettled(
    args.channels.map((channel) =>
      limit(() =>
        dispatchWebhookToChannel({
          db: args.db,
          env: args.env,
          channel,
          eventKey: args.eventKey,
          payload: args.payload,
        }).catch((err) => Promise.reject({ channel, err }))
      )
    )
  );

  const rejected = settled.filter((r) => r.status === 'rejected');
  if (rejected.length > 0) {
    console.error(`notify: ${rejected.length}/${settled.length} webhooks failed`, rejected[0]);
  }
}

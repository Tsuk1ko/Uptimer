import { Hono } from 'hono';
import { z } from 'zod';

import {
  eq,
  expectedStatusJsonSchema,
  getDb,
  httpHeadersJsonSchema,
  monitors,
  parseDbJson,
  parseDbJsonNullable,
  serializeDbJson,
  serializeDbJsonNullable,
  webhookChannelConfigSchema,
} from '@uptimer/db';

import type { Env } from '../env';
import { requireAdmin } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { runHttpCheck } from '../monitor/http';
import { validateHttpTarget, validateTcpTarget } from '../monitor/targets';
import { runTcpCheck } from '../monitor/tcp';
import { dispatchWebhookToChannel } from '../notify/webhook';
import { createMonitorInputSchema, patchMonitorInputSchema } from '../schemas/monitors';
import {
  createNotificationChannelInputSchema,
  patchNotificationChannelInputSchema,
} from '../schemas/notification-channels';

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use('*', requireAdmin);

function monitorRowToApi(row: typeof monitors.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    target: row.target,
    interval_sec: row.intervalSec,
    timeout_ms: row.timeoutMs,
    http_method: row.httpMethod,
    http_headers_json: parseDbJsonNullable(httpHeadersJsonSchema, row.httpHeadersJson, {
      field: 'http_headers_json',
    }),
    http_body: row.httpBody,
    expected_status_json: parseDbJsonNullable(expectedStatusJsonSchema, row.expectedStatusJson, {
      field: 'expected_status_json',
    }),
    response_keyword: row.responseKeyword,
    response_forbidden_keyword: row.responseForbiddenKeyword,
    is_active: row.isActive,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

adminRoutes.get('/monitors', async (c) => {
  const limit = z.coerce.number().int().min(1).max(200).optional().default(50).parse(c.req.query('limit'));
  const db = getDb(c.env);
  const rows = await db.select().from(monitors).orderBy(monitors.id).limit(limit).all();
  return c.json({ monitors: rows.map(monitorRowToApi) });
});

adminRoutes.post('/monitors', async (c) => {
  const rawBody = await c.req.json().catch(() => {
    throw new AppError(400, 'INVALID_ARGUMENT', 'Invalid JSON body');
  });
  const input = createMonitorInputSchema.parse(rawBody);

  const db = getDb(c.env);
  const now = Math.floor(Date.now() / 1000);

  const inserted = await db
    .insert(monitors)
    .values({
      name: input.name,
      type: input.type,
      target: input.target,
      intervalSec: input.interval_sec ?? 60,
      timeoutMs: input.timeout_ms ?? 10000,

      httpMethod: input.type === 'http' ? (input.http_method ?? null) : null,
      httpHeadersJson:
        input.type === 'http'
          ? serializeDbJsonNullable(httpHeadersJsonSchema, input.http_headers_json ?? null, {
              field: 'http_headers_json',
            })
          : null,
      httpBody: input.type === 'http' ? (input.http_body ?? null) : null,
      expectedStatusJson:
        input.type === 'http'
          ? serializeDbJsonNullable(expectedStatusJsonSchema, input.expected_status_json ?? null, {
              field: 'expected_status_json',
            })
          : null,
      responseKeyword: input.type === 'http' ? (input.response_keyword ?? null) : null,
      responseForbiddenKeyword: input.type === 'http' ? (input.response_forbidden_keyword ?? null) : null,

      isActive: input.is_active ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json({ monitor: monitorRowToApi(inserted) }, 201);
});

adminRoutes.patch('/monitors/:id', async (c) => {
  const id = z.coerce.number().int().positive().parse(c.req.param('id'));

  const rawBody = await c.req.json().catch(() => {
    throw new AppError(400, 'INVALID_ARGUMENT', 'Invalid JSON body');
  });
  const input = patchMonitorInputSchema.parse(rawBody);

  const db = getDb(c.env);
  const existing = await db.select().from(monitors).where(eq(monitors.id, id)).get();

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Monitor not found');
  }

  // Validate target if being updated
  if (input.target !== undefined) {
    const targetErr =
      existing.type === 'http' ? validateHttpTarget(input.target) : validateTcpTarget(input.target);
    if (targetErr) {
      throw new AppError(400, 'INVALID_ARGUMENT', targetErr);
    }
  }

  // Prevent http_* fields on tcp monitors
  if (existing.type === 'tcp') {
    const httpFields = [
      'http_method',
      'http_headers_json',
      'http_body',
      'expected_status_json',
      'response_keyword',
      'response_forbidden_keyword',
    ] as const;
    for (const field of httpFields) {
      if (input[field] !== undefined) {
        throw new AppError(400, 'INVALID_ARGUMENT', 'http_* fields are not allowed for tcp monitors');
      }
    }
  }

  const now = Math.floor(Date.now() / 1000);

  const updated = await db
    .update(monitors)
    .set({
      name: input.name ?? existing.name,
      target: input.target ?? existing.target,
      intervalSec: input.interval_sec ?? existing.intervalSec,
      timeoutMs: input.timeout_ms ?? existing.timeoutMs,
      httpMethod: input.http_method !== undefined ? input.http_method : existing.httpMethod,
      httpHeadersJson:
        input.http_headers_json !== undefined
          ? serializeDbJsonNullable(httpHeadersJsonSchema, input.http_headers_json, {
              field: 'http_headers_json',
            })
          : existing.httpHeadersJson,
      httpBody: input.http_body !== undefined ? input.http_body : existing.httpBody,
      expectedStatusJson:
        input.expected_status_json !== undefined
          ? serializeDbJsonNullable(expectedStatusJsonSchema, input.expected_status_json, {
              field: 'expected_status_json',
            })
          : existing.expectedStatusJson,
      responseKeyword: input.response_keyword !== undefined ? input.response_keyword : existing.responseKeyword,
      responseForbiddenKeyword:
        input.response_forbidden_keyword !== undefined
          ? input.response_forbidden_keyword
          : existing.responseForbiddenKeyword,
      isActive: input.is_active ?? existing.isActive,
      updatedAt: now,
    })
    .where(eq(monitors.id, id))
    .returning()
    .get();

  if (!updated) {
    throw new AppError(500, 'INTERNAL', 'Failed to update monitor');
  }

  return c.json({ monitor: monitorRowToApi(updated) });
});

adminRoutes.delete('/monitors/:id', async (c) => {
  const id = z.coerce.number().int().positive().parse(c.req.param('id'));

  const db = getDb(c.env);
  const existing = await db.select().from(monitors).where(eq(monitors.id, id)).get();

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Monitor not found');
  }

  await db.delete(monitors).where(eq(monitors.id, id)).run();

  return c.json({ deleted: true });
});

adminRoutes.post('/monitors/:id/test', async (c) => {
  const id = z.coerce.number().int().positive().parse(c.req.param('id'));

  const db = getDb(c.env);
  const monitor = await db.select().from(monitors).where(eq(monitors.id, id)).get();

  if (!monitor) {
    throw new AppError(404, 'NOT_FOUND', 'Monitor not found');
  }

  let outcome;
  if (monitor.type === 'http') {
    outcome = await runHttpCheck({
      url: monitor.target,
      timeoutMs: monitor.timeoutMs,
      method: (monitor.httpMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD') ?? 'GET',
      headers: parseDbJsonNullable(httpHeadersJsonSchema, monitor.httpHeadersJson, { field: 'http_headers_json' }),
      body: monitor.httpBody,
      expectedStatus: parseDbJsonNullable(expectedStatusJsonSchema, monitor.expectedStatusJson, {
        field: 'expected_status_json',
      }),
      responseKeyword: monitor.responseKeyword,
      responseForbiddenKeyword: monitor.responseForbiddenKeyword,
    });
  } else {
    outcome = await runTcpCheck({
      target: monitor.target,
      timeoutMs: monitor.timeoutMs,
    });
  }

  return c.json({
    monitor: { id: monitor.id, name: monitor.name, type: monitor.type },
    result: {
      status: outcome.status,
      latency_ms: outcome.latencyMs,
      http_status: outcome.httpStatus,
      error: outcome.error,
      attempts: outcome.attempts,
    },
  });
});

type NotificationChannelRow = {
  id: number;
  name: string;
  type: string;
  config_json: string;
  is_active: number;
  created_at: number;
};

function notificationChannelRowToApi(row: NotificationChannelRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config_json: parseDbJson(webhookChannelConfigSchema, row.config_json, { field: 'config_json' }),
    is_active: row.is_active === 1,
    created_at: row.created_at,
  };
}

adminRoutes.get('/notification-channels', async (c) => {
  const limit = z.coerce.number().int().min(1).max(200).optional().default(50).parse(c.req.query('limit'));

  const { results } = await c.env.DB.prepare(
    `
      SELECT id, name, type, config_json, is_active, created_at
      FROM notification_channels
      ORDER BY id
      LIMIT ?1
    `
  )
    .bind(limit)
    .all<NotificationChannelRow>();

  return c.json({ notification_channels: (results ?? []).map(notificationChannelRowToApi) });
});

adminRoutes.post('/notification-channels', async (c) => {
  const rawBody = await c.req.json().catch(() => {
    throw new AppError(400, 'INVALID_ARGUMENT', 'Invalid JSON body');
  });
  const input = createNotificationChannelInputSchema.parse(rawBody);

  const now = Math.floor(Date.now() / 1000);
  const isActive = input.is_active ?? true;
  const configJson = serializeDbJson(webhookChannelConfigSchema, input.config_json, { field: 'config_json' });

  const row = await c.env.DB.prepare(
    `
      INSERT INTO notification_channels (name, type, config_json, is_active, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
      RETURNING id, name, type, config_json, is_active, created_at
    `
  )
    .bind(input.name, input.type, configJson, isActive ? 1 : 0, now)
    .first<NotificationChannelRow>();

  if (!row) {
    throw new AppError(500, 'INTERNAL', 'Failed to create notification channel');
  }

  return c.json({ notification_channel: notificationChannelRowToApi(row) }, 201);
});

adminRoutes.patch('/notification-channels/:id', async (c) => {
  const id = z.coerce.number().int().positive().parse(c.req.param('id'));

  const rawBody = await c.req.json().catch(() => {
    throw new AppError(400, 'INVALID_ARGUMENT', 'Invalid JSON body');
  });
  const input = patchNotificationChannelInputSchema.parse(rawBody);

  const existing = await c.env.DB.prepare(
    `
      SELECT id, name, type, config_json, is_active, created_at
      FROM notification_channels
      WHERE id = ?1
    `
  )
    .bind(id)
    .first<NotificationChannelRow>();

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Notification channel not found');
  }

  const nextName = input.name ?? existing.name;
  const nextIsActive = input.is_active !== undefined ? (input.is_active ? 1 : 0) : existing.is_active;
  const nextConfigJson =
    input.config_json !== undefined
      ? serializeDbJson(webhookChannelConfigSchema, input.config_json, { field: 'config_json' })
      : existing.config_json;

  const updated = await c.env.DB.prepare(
    `
      UPDATE notification_channels
      SET name = ?1, config_json = ?2, is_active = ?3
      WHERE id = ?4
      RETURNING id, name, type, config_json, is_active, created_at
    `
  )
    .bind(nextName, nextConfigJson, nextIsActive, id)
    .first<NotificationChannelRow>();

  if (!updated) {
    throw new AppError(500, 'INTERNAL', 'Failed to update notification channel');
  }

  return c.json({ notification_channel: notificationChannelRowToApi(updated) });
});

type NotificationDeliveryRow = {
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: number;
};

adminRoutes.post('/notification-channels/:id/test', async (c) => {
  const id = z.coerce.number().int().positive().parse(c.req.param('id'));

  const channelRow = await c.env.DB.prepare(
    `
      SELECT id, name, type, config_json, is_active, created_at
      FROM notification_channels
      WHERE id = ?1
    `
  )
    .bind(id)
    .first<NotificationChannelRow>();

  if (!channelRow) {
    throw new AppError(404, 'NOT_FOUND', 'Notification channel not found');
  }

  const config = parseDbJson(webhookChannelConfigSchema, channelRow.config_json, { field: 'config_json' });
  const channel = { id: channelRow.id, name: channelRow.name, config };

  const now = Math.floor(Date.now() / 1000);
  const eventKey = `test:webhook:${id}:${now}`;
  const payload = {
    event: 'test.ping',
    event_id: eventKey,
    timestamp: now,
  };

  await dispatchWebhookToChannel({
    db: c.env.DB,
    env: c.env as unknown as Record<string, unknown>,
    channel,
    eventKey,
    payload,
  });

  const delivery = await c.env.DB.prepare(
    `
      SELECT status, http_status, error, created_at
      FROM notification_deliveries
      WHERE event_key = ?1 AND channel_id = ?2
    `
  )
    .bind(eventKey, id)
    .first<NotificationDeliveryRow>();

  return c.json({
    event_key: eventKey,
    delivery: delivery
      ? {
          status: delivery.status,
          http_status: delivery.http_status,
          error: delivery.error,
          created_at: delivery.created_at,
        }
      : null,
  });
});

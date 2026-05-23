import type { CheckStatus } from '@uptimer/db/schema';

export type CheckResultV2Status = CheckStatus;

export type CheckResultV2Entry = {
  monitorId: number;
  status: CheckResultV2Status;
  latencyMs: number | null;
  httpStatus: number | null;
  error: string | null;
  attempt: number;
};

export type CompactCheckResultV2Entry = [
  monitorId: number,
  status: CheckResultV2Status,
  latencyMs: number | null,
  httpStatus: number | null,
  error: string | null,
  attempt: number,
];

type StoredCheckResultV2Entry = {
  s: 'u' | 'd' | 'm' | 'x';
  l: number | null;
  h: number | null;
  e: string | null;
  a: number;
};

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || Number.isInteger(value);
}

function parseCheckStatus(value: unknown): CheckResultV2Status | null {
  return value === 'up' || value === 'down' || value === 'maintenance' || value === 'unknown'
    ? value
    : null;
}

function toStoredStatusCode(status: CheckResultV2Status): StoredCheckResultV2Entry['s'] {
  switch (status) {
    case 'up':
      return 'u';
    case 'down':
      return 'd';
    case 'maintenance':
      return 'm';
    case 'unknown':
    default:
      return 'x';
  }
}

function normalizeEntry(entry: CheckResultV2Entry): CheckResultV2Entry | null {
  if (!isPositiveInteger(entry.monitorId)) return null;
  if (!isNullableInteger(entry.latencyMs)) return null;
  if (!isNullableInteger(entry.httpStatus)) return null;
  if (entry.error !== null && typeof entry.error !== 'string') return null;
  if (!Number.isInteger(entry.attempt) || entry.attempt < 0) return null;
  return entry;
}

export function encodeCheckResultsV2Compact(
  entries: readonly CheckResultV2Entry[],
): CompactCheckResultV2Entry[] {
  return entries.flatMap((entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized) return [];
    return [
      [
        normalized.monitorId,
        normalized.status,
        normalized.latencyMs,
        normalized.httpStatus,
        normalized.error,
        normalized.attempt,
      ],
    ];
  });
}

export function parseCheckResultsV2Compact(value: unknown): CheckResultV2Entry[] | null {
  if (!Array.isArray(value)) return null;

  const entries: CheckResultV2Entry[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 6) return null;

    const [monitorId, statusValue, latencyMs, httpStatus, error, attempt] = item;
    const status = parseCheckStatus(statusValue);
    if (
      !isPositiveInteger(monitorId) ||
      !status ||
      !isNullableInteger(latencyMs) ||
      !isNullableInteger(httpStatus) ||
      (error !== null && typeof error !== 'string') ||
      !Number.isInteger(attempt) ||
      attempt < 0
    ) {
      return null;
    }

    entries.push({
      monitorId,
      status,
      latencyMs,
      httpStatus,
      error,
      attempt,
    });
  }

  return entries;
}

export function buildCheckResultsV2Json(entries: readonly CheckResultV2Entry[]): string {
  const byMonitorId: Record<string, StoredCheckResultV2Entry> = {};
  for (const entry of entries) {
    const normalized = normalizeEntry(entry);
    if (!normalized) continue;
    byMonitorId[String(normalized.monitorId)] = {
      s: toStoredStatusCode(normalized.status),
      l: normalized.latencyMs,
      h: normalized.httpStatus,
      e: normalized.error,
      a: normalized.attempt,
    };
  }
  return JSON.stringify(byMonitorId);
}

export async function writeCheckResultsV2(
  db: D1Database,
  checkedAt: number,
  entries: readonly CheckResultV2Entry[],
): Promise<void> {
  if (!Number.isInteger(checkedAt) || checkedAt < 0 || entries.length === 0) {
    return;
  }

  const resultsJson = buildCheckResultsV2Json(entries);
  if (resultsJson === '{}') {
    return;
  }

  await db
    .prepare(
      `
        INSERT INTO check_results_v2 (checked_at, results_json, schema_version)
        VALUES (?1, ?2, 1)
        ON CONFLICT(checked_at) DO UPDATE SET
          results_json = json_patch(check_results_v2.results_json, excluded.results_json),
          schema_version = excluded.schema_version
      `,
    )
    .bind(checkedAt, resultsJson)
    .run();
}

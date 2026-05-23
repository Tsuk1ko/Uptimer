import { describe, expect, it } from 'vitest';

import {
  encodeCheckResultsV2Compact,
  parseCheckResultsV2Compact,
  writeCheckResultsV2,
  type CheckResultV2Entry,
} from '../src/check-results-v2';
import { createFakeD1Database, type FakeD1QueryHandler } from './helpers/fake-d1';

describe('check-results-v2', () => {
  it('encodes compact check results and writes one JSON row for a checked_at minute', async () => {
    const runs: { sql: string; args: unknown[] }[] = [];
    const handlers: FakeD1QueryHandler[] = [
      {
        match: 'insert into check_results_v2',
        run: (args, sql) => {
          runs.push({ sql, args });
          return { meta: { changes: 1 } };
        },
      },
    ];
    const db = createFakeD1Database(handlers);
    const checkedAt = 1_771_286_400;
    const entries: CheckResultV2Entry[] = [
      {
        monitorId: 12,
        status: 'up',
        latencyMs: 42,
        httpStatus: 200,
        error: null,
        attempt: 1,
      },
      {
        monitorId: 13,
        status: 'down',
        latencyMs: null,
        httpStatus: null,
        error: 'Timeout after 5000ms',
        attempt: 3,
      },
    ];

    await writeCheckResultsV2(db, checkedAt, entries);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.sql).toContain('on conflict(checked_at) do update');
    expect(runs[0]?.args[0]).toBe(checkedAt);
    expect(JSON.parse(String(runs[0]?.args[1]))).toEqual({
      '12': { s: 'u', l: 42, h: 200, e: null, a: 1 },
      '13': { s: 'd', l: null, h: null, e: 'Timeout after 5000ms', a: 3 },
    });
  });

  it('round-trips compact internal batch payloads', () => {
    const encoded = encodeCheckResultsV2Compact([
      {
        monitorId: 7,
        status: 'unknown',
        latencyMs: null,
        httpStatus: null,
        error: 'Invalid target',
        attempt: 1,
      },
    ]);

    expect(encoded).toEqual([[7, 'unknown', null, null, 'Invalid target', 1]]);
    expect(parseCheckResultsV2Compact(encoded)).toEqual([
      {
        monitorId: 7,
        status: 'unknown',
        latencyMs: null,
        httpStatus: null,
        error: 'Invalid target',
        attempt: 1,
      },
    ]);
    expect(parseCheckResultsV2Compact([[0, 'up', null, null, null, 1]])).toBeNull();
  });
});

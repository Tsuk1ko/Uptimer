import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('check-results-v2 migrations', () => {
  it('clears runtime snapshots derived from pre-v2 check history', () => {
    const sql = readFileSync(
      new URL('../migrations/0015_clear_check_results_v2_runtime_cache.sql', import.meta.url),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain("'monitor-runtime'");
    expect(sql).toContain("'monitor-runtime:totals'");
    expect(sql).toContain("'monitor-runtime:updates'");
    expect(sql).toContain('delete from public_snapshots');
    expect(sql).toContain('delete from public_snapshot_fragments');
  });

  it('resets derived historical check surfaces for a clean v2 cutover', () => {
    const sql = readFileSync(
      new URL('../migrations/0016_reset_check_history_for_v2_cutover.sql', import.meta.url),
      'utf8',
    ).toLowerCase();

    expect(sql).not.toContain('delete from check_results;');
    expect(sql).toContain('delete from check_results_v2');
    expect(sql).toContain('delete from monitor_daily_rollups');
    expect(sql).toContain('delete from outages');
    expect(sql).toContain('update monitor_state');
    expect(sql).toContain("where status != 'paused'");
    expect(sql).toContain('last_checked_at = null');
    expect(sql).toContain('delete from public_snapshots');
    expect(sql).toContain('delete from public_snapshot_fragments');
  });
});

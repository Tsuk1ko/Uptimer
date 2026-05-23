-- Reset historical check-derived data for the v2 check_results cutover.
-- Keep legacy raw check_results rows for audit/export purposes; active reads use
-- check_results_v2_expanded, so only v2 and derived display surfaces are reset.
DELETE FROM check_results_v2;
DELETE FROM monitor_daily_rollups;
DELETE FROM outages;

-- Keep explicitly paused monitors paused, but clear non-paused runtime state
-- so public pages do not keep displaying pre-cutover last check/status data.
UPDATE monitor_state
SET
  status = 'unknown',
  last_checked_at = NULL,
  last_changed_at = NULL,
  last_latency_ms = NULL,
  last_error = NULL,
  consecutive_failures = 0,
  consecutive_successes = 0
WHERE status != 'paused';

-- Clear every public snapshot/fragment that can embed heartbeat, uptime,
-- outage, or runtime-update history.
DELETE FROM public_snapshots
WHERE key IN (
  'homepage',
  'homepage:artifact',
  'status',
  'analytics-overview',
  'monitor-runtime',
  'monitor-runtime:totals'
);

DELETE FROM public_snapshot_fragments
WHERE snapshot_key IN (
  'homepage:monitors',
  'homepage:artifact:monitors',
  'homepage:envelope',
  'status:monitors',
  'status:envelope',
  'monitor-runtime:updates'
);

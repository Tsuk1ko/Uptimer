-- Drop runtime snapshots/fragments that may still carry heartbeat history
-- materialized from pre-v2 check_results rows. These are derived cache rows;
-- they will be rebuilt from check_results_v2 and fresh scheduler updates.
DELETE FROM public_snapshots
WHERE key IN (
  'monitor-runtime',
  'monitor-runtime:totals'
);

DELETE FROM public_snapshot_fragments
WHERE snapshot_key IN (
  'monitor-runtime:updates'
);

-- Drop public snapshots that may embed pre-v2 check_results history.
-- They will be regenerated from check_results_v2 after deployment.
DELETE FROM public_snapshots
WHERE key IN (
  'homepage',
  'homepage:artifact',
  'status',
  'analytics-overview'
);

DELETE FROM public_snapshot_fragments
WHERE snapshot_key IN (
  'homepage:monitors',
  'homepage:artifact:monitors',
  'homepage:envelope',
  'status:monitors',
  'status:envelope'
);

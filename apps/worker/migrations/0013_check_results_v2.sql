-- Aggregated check results keyed by minute. Each row contains all monitor
-- results completed for the same checked_at timestamp.
CREATE TABLE IF NOT EXISTS check_results_v2 (
  checked_at INTEGER PRIMARY KEY,
  results_json TEXT NOT NULL CHECK (json_valid(results_json)),
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE VIEW IF NOT EXISTS check_results_v2_expanded AS
SELECT
  CAST(j.key AS INTEGER) AS monitor_id,
  r.checked_at AS checked_at,
  CASE json_extract(j.value, '$.s')
    WHEN 'u' THEN 'up'
    WHEN 'd' THEN 'down'
    WHEN 'm' THEN 'maintenance'
    ELSE 'unknown'
  END AS status,
  CAST(json_extract(j.value, '$.l') AS INTEGER) AS latency_ms,
  CAST(json_extract(j.value, '$.h') AS INTEGER) AS http_status,
  json_extract(j.value, '$.e') AS error,
  NULL AS location,
  COALESCE(CAST(json_extract(j.value, '$.a') AS INTEGER), 1) AS attempt
FROM check_results_v2 r, json_each(r.results_json) j;

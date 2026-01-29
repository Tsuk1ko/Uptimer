// API Response Types

export type MonitorStatus = 'up' | 'down' | 'maintenance' | 'paused' | 'unknown';
export type CheckStatus = 'up' | 'down' | 'maintenance' | 'unknown';
export type MonitorType = 'http' | 'tcp';

export interface Heartbeat {
  checked_at: number;
  status: CheckStatus;
  latency_ms: number | null;
}

export interface PublicMonitor {
  id: number;
  name: string;
  type: MonitorType;
  status: MonitorStatus;
  is_stale: boolean;
  last_checked_at: number | null;
  last_latency_ms: number | null;
  heartbeats: Heartbeat[];
}

export interface StatusResponse {
  generated_at: number;
  overall_status: MonitorStatus;
  summary: {
    up: number;
    down: number;
    maintenance: number;
    paused: number;
    unknown: number;
  };
  monitors: PublicMonitor[];
}

export interface LatencyPoint {
  checked_at: number;
  status: CheckStatus;
  latency_ms: number | null;
}

export interface LatencyResponse {
  monitor: { id: number; name: string };
  range: '24h';
  range_start_at: number;
  range_end_at: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  points: LatencyPoint[];
}

export interface UptimeResponse {
  monitor: { id: number; name: string };
  range: '24h' | '7d' | '30d';
  range_start_at: number;
  range_end_at: number;
  total_sec: number;
  downtime_sec: number;
  unknown_sec: number;
  uptime_sec: number;
  uptime_pct: number;
}

// Admin Types

export interface AdminMonitor {
  id: number;
  name: string;
  type: MonitorType;
  target: string;
  interval_sec: number;
  timeout_ms: number;
  http_method: string | null;
  http_headers_json: Record<string, string> | null;
  http_body: string | null;
  expected_status_json: number[] | null;
  response_keyword: string | null;
  response_forbidden_keyword: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateMonitorInput {
  name: string;
  type: MonitorType;
  target: string;
  interval_sec?: number;
  timeout_ms?: number;
  http_method?: string;
  http_headers_json?: Record<string, string>;
  http_body?: string;
  expected_status_json?: number[];
  response_keyword?: string;
  response_forbidden_keyword?: string;
  is_active?: boolean;
}

export interface PatchMonitorInput {
  name?: string;
  target?: string;
  interval_sec?: number;
  timeout_ms?: number;
  http_method?: string;
  http_headers_json?: Record<string, string> | null;
  http_body?: string | null;
  expected_status_json?: number[] | null;
  response_keyword?: string | null;
  response_forbidden_keyword?: string | null;
  is_active?: boolean;
}

export interface MonitorTestResult {
  monitor: { id: number; name: string; type: MonitorType };
  result: {
    status: CheckStatus;
    latency_ms: number | null;
    http_status: number | null;
    error: string | null;
    attempts: number;
  };
}

export interface WebhookChannelConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
  payload_type?: string;
  signing?: {
    enabled: boolean;
    secret_ref: string;
  };
}

export interface NotificationChannel {
  id: number;
  name: string;
  type: 'webhook';
  config_json: WebhookChannelConfig;
  is_active: boolean;
  created_at: number;
}

export interface CreateNotificationChannelInput {
  name: string;
  type?: 'webhook';
  config_json: WebhookChannelConfig;
  is_active?: boolean;
}

export interface PatchNotificationChannelInput {
  name?: string;
  config_json?: WebhookChannelConfig;
  is_active?: boolean;
}

export interface NotificationChannelTestResult {
  event_key: string;
  delivery: {
    status: string;
    http_status: number | null;
    error: string | null;
    created_at: number;
  } | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

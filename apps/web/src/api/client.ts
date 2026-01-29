import type {
  AdminMonitor,
  CreateMonitorInput,
  CreateNotificationChannelInput,
  LatencyResponse,
  MonitorTestResult,
  NotificationChannel,
  NotificationChannelTestResult,
  PatchMonitorInput,
  PatchNotificationChannelInput,
  StatusResponse,
  UptimeResponse,
} from './types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('admin_token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Unknown error' } }));
    throw new ApiError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Unknown error', res.status);
  }
  return res.json();
}

// Public API
export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/public/status`);
  return handleResponse<StatusResponse>(res);
}

export async function fetchLatency(monitorId: number, range: '24h' = '24h'): Promise<LatencyResponse> {
  const res = await fetch(`${API_BASE}/public/monitors/${monitorId}/latency?range=${range}`);
  return handleResponse<LatencyResponse>(res);
}

export async function fetchUptime(monitorId: number, range: '24h' | '7d' | '30d' = '24h'): Promise<UptimeResponse> {
  const res = await fetch(`${API_BASE}/public/monitors/${monitorId}/uptime?range=${range}`);
  return handleResponse<UptimeResponse>(res);
}

export { ApiError };

// Admin API - Monitors
export async function fetchAdminMonitors(limit = 50): Promise<{ monitors: AdminMonitor[] }> {
  const res = await fetch(`${API_BASE}/admin/monitors?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<{ monitors: AdminMonitor[] }>(res);
}

export async function createMonitor(input: CreateMonitorInput): Promise<{ monitor: AdminMonitor }> {
  const res = await fetch(`${API_BASE}/admin/monitors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  return handleResponse<{ monitor: AdminMonitor }>(res);
}

export async function updateMonitor(id: number, input: PatchMonitorInput): Promise<{ monitor: AdminMonitor }> {
  const res = await fetch(`${API_BASE}/admin/monitors/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  return handleResponse<{ monitor: AdminMonitor }>(res);
}

export async function deleteMonitor(id: number): Promise<{ deleted: boolean }> {
  const res = await fetch(`${API_BASE}/admin/monitors/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return handleResponse<{ deleted: boolean }>(res);
}

export async function testMonitor(id: number): Promise<MonitorTestResult> {
  const res = await fetch(`${API_BASE}/admin/monitors/${id}/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse<MonitorTestResult>(res);
}

// Admin API - Notification Channels
export async function fetchNotificationChannels(limit = 50): Promise<{ notification_channels: NotificationChannel[] }> {
  const res = await fetch(`${API_BASE}/admin/notification-channels?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<{ notification_channels: NotificationChannel[] }>(res);
}

export async function createNotificationChannel(
  input: CreateNotificationChannelInput,
): Promise<{ notification_channel: NotificationChannel }> {
  const res = await fetch(`${API_BASE}/admin/notification-channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  return handleResponse<{ notification_channel: NotificationChannel }>(res);
}

export async function updateNotificationChannel(
  id: number,
  input: PatchNotificationChannelInput,
): Promise<{ notification_channel: NotificationChannel }> {
  const res = await fetch(`${API_BASE}/admin/notification-channels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  return handleResponse<{ notification_channel: NotificationChannel }>(res);
}

export async function testNotificationChannel(id: number): Promise<NotificationChannelTestResult> {
  const res = await fetch(`${API_BASE}/admin/notification-channels/${id}/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse<NotificationChannelTestResult>(res);
}

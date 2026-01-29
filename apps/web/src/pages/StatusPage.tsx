import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchStatus, fetchLatency } from '../api/client';
import type { MonitorStatus, PublicMonitor } from '../api/types';
import { HeartbeatBar } from '../components/HeartbeatBar';
import { LatencyChart } from '../components/LatencyChart';

function getOverallStatusText(status: MonitorStatus): string {
  switch (status) {
    case 'up':
      return 'All Systems Operational';
    case 'down':
      return 'System Outage';
    case 'maintenance':
      return 'Under Maintenance';
    case 'paused':
      return 'Monitoring Paused';
    case 'unknown':
    default:
      return 'Status Unknown';
  }
}

function getOverallStatusColor(status: MonitorStatus): string {
  switch (status) {
    case 'up':
      return 'bg-green-500';
    case 'down':
      return 'bg-red-500';
    case 'maintenance':
      return 'bg-blue-500';
    case 'paused':
      return 'bg-yellow-500';
    case 'unknown':
    default:
      return 'bg-gray-500';
  }
}

function getStatusBadge(status: MonitorStatus): string {
  switch (status) {
    case 'up':
      return 'bg-green-100 text-green-800';
    case 'down':
      return 'bg-red-100 text-red-800';
    case 'maintenance':
      return 'bg-blue-100 text-blue-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function MonitorCard({ monitor, onSelect }: { monitor: PublicMonitor; onSelect: () => void }) {
  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">{monitor.name}</h3>
          <span className="text-xs text-gray-500 uppercase">{monitor.type}</span>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(monitor.status)}`}>
          {monitor.status}
        </span>
      </div>
      <HeartbeatBar heartbeats={monitor.heartbeats} />
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>
          {monitor.last_latency_ms !== null ? `${monitor.last_latency_ms}ms` : '-'}
        </span>
        <span>
          {monitor.last_checked_at !== null
            ? new Date(monitor.last_checked_at * 1000).toLocaleTimeString()
            : 'Never'}
        </span>
      </div>
    </div>
  );
}

function MonitorDetail({ monitorId, onClose }: { monitorId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['latency', monitorId],
    queryFn: () => fetchLatency(monitorId),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{data?.monitor.name ?? 'Loading...'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">Loading...</div>
        ) : data ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              <span>Avg: {data.avg_latency_ms ?? '-'}ms</span>
              <span className="mx-2">|</span>
              <span>P95: {data.p95_latency_ms ?? '-'}ms</span>
            </div>
            <LatencyChart points={data.points} />
          </>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-500">
            Failed to load data
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPage() {
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">Failed to load status</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Uptimer</h1>
          <Link to="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
        </div>
      </header>

      <div className={`${getOverallStatusColor(data.overall_status)} text-white py-8`}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold">{getOverallStatusText(data.overall_status)}</h2>
          <p className="mt-2 text-sm opacity-90">
            Last updated: {new Date(data.generated_at * 1000).toLocaleString()}
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-4">
          {data.monitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              onSelect={() => setSelectedMonitorId(monitor.id)}
            />
          ))}
        </div>
        {data.monitors.length === 0 && (
          <div className="text-center text-gray-500 py-8">No monitors configured</div>
        )}
      </main>

      {selectedMonitorId !== null && (
        <MonitorDetail monitorId={selectedMonitorId} onClose={() => setSelectedMonitorId(null)} />
      )}
    </div>
  );
}

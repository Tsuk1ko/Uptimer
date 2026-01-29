import type { Heartbeat, CheckStatus } from '../api/types';

interface HeartbeatBarProps {
  heartbeats: Heartbeat[];
  maxBars?: number;
}

function getStatusColor(status: CheckStatus): string {
  switch (status) {
    case 'up':
      return 'bg-green-500';
    case 'down':
      return 'bg-red-500';
    case 'maintenance':
      return 'bg-blue-500';
    case 'unknown':
    default:
      return 'bg-gray-400';
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function HeartbeatBar({ heartbeats, maxBars = 60 }: HeartbeatBarProps) {
  const displayHeartbeats = heartbeats.slice(0, maxBars);
  const reversed = [...displayHeartbeats].reverse();

  return (
    <div className="flex gap-0.5 h-8 items-end">
      {reversed.map((hb, idx) => (
        <div
          key={idx}
          className={`w-1.5 h-full rounded-sm ${getStatusColor(hb.status)} hover:opacity-80 cursor-pointer`}
          title={`${formatTime(hb.checked_at)}\nStatus: ${hb.status}${hb.latency_ms !== null ? `\nLatency: ${hb.latency_ms}ms` : ''}`}
        />
      ))}
      {reversed.length < maxBars &&
        Array.from({ length: maxBars - reversed.length }).map((_, idx) => (
          <div key={`empty-${idx}`} className="w-1.5 h-full rounded-sm bg-gray-200" />
        ))}
    </div>
  );
}

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { LatencyPoint } from '../api/types';

interface LatencyChartProps {
  points: LatencyPoint[];
  height?: number;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function LatencyChart({ points, height = 200 }: LatencyChartProps) {
  const data = points
    .filter((p) => p.status === 'up' && p.latency_ms !== null)
    .map((p) => ({
      time: p.checked_at,
      latency: p.latency_ms,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-500">
        No latency data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis
          dataKey="time"
          tickFormatter={formatTime}
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={(v) => `${v}ms`}
        />
        <Tooltip
          labelFormatter={(v) => new Date(Number(v) * 1000).toLocaleString()}
          formatter={(v: number) => [`${v}ms`, 'Latency']}
        />
        <Line
          type="monotone"
          dataKey="latency"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

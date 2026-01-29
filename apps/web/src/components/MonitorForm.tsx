import { useState } from 'react';
import type { AdminMonitor, CreateMonitorInput, MonitorType } from '../api/types';

interface MonitorFormProps {
  monitor?: AdminMonitor | undefined;
  onSubmit: (data: CreateMonitorInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MonitorForm({ monitor, onSubmit, onCancel, isLoading }: MonitorFormProps) {
  const [name, setName] = useState(monitor?.name ?? '');
  const [type, setType] = useState<MonitorType>(monitor?.type ?? 'http');
  const [target, setTarget] = useState(monitor?.target ?? '');
  const [intervalSec, setIntervalSec] = useState(monitor?.interval_sec ?? 60);
  const [timeoutMs, setTimeoutMs] = useState(monitor?.timeout_ms ?? 10000);
  const [httpMethod, setHttpMethod] = useState(monitor?.http_method ?? 'GET');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateMonitorInput = {
      name,
      type,
      target,
      interval_sec: intervalSec,
      timeout_ms: timeoutMs,
    };
    if (type === 'http') {
      data.http_method = httpMethod;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as MonitorType)}
          className="w-full px-3 py-2 border rounded-md"
          disabled={!!monitor}
        >
          <option value="http">HTTP</option>
          <option value="tcp">TCP</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {type === 'http' ? 'URL' : 'Host:Port'}
        </label>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={type === 'http' ? 'https://example.com' : 'example.com:443'}
          className="w-full px-3 py-2 border rounded-md"
          required
        />
      </div>

      {type === 'http' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
          <select
            value={httpMethod}
            onChange={(e) => setHttpMethod(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interval (sec)</label>
          <input
            type="number"
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
            min={60}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (ms)</label>
          <input
            type="number"
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value))}
            min={1000}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : monitor ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../app/AuthContext';
import {
  fetchAdminMonitors,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  testMonitor,
  fetchNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  testNotificationChannel,
} from '../api/client';
import type { AdminMonitor, NotificationChannel } from '../api/types';
import { MonitorForm } from '../components/MonitorForm';
import { NotificationChannelForm } from '../components/NotificationChannelForm';

type Tab = 'monitors' | 'notifications';
type ModalState =
  | { type: 'none' }
  | { type: 'create-monitor' }
  | { type: 'edit-monitor'; monitor: AdminMonitor }
  | { type: 'create-channel' }
  | { type: 'edit-channel'; channel: NotificationChannel };

export function AdminDashboard() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('monitors');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [testingMonitorId, setTestingMonitorId] = useState<number | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);

  // Queries
  const monitorsQuery = useQuery({
    queryKey: ['admin-monitors'],
    queryFn: () => fetchAdminMonitors(),
  });

  const channelsQuery = useQuery({
    queryKey: ['admin-channels'],
    queryFn: () => fetchNotificationChannels(),
  });

  // Monitor mutations
  const createMonitorMut = useMutation({
    mutationFn: createMonitor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-monitors'] });
      setModal({ type: 'none' });
    },
  });

  const updateMonitorMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateMonitor>[1] }) =>
      updateMonitor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-monitors'] });
      setModal({ type: 'none' });
    },
  });

  const deleteMonitorMut = useMutation({
    mutationFn: deleteMonitor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-monitors'] }),
  });

  const testMonitorMut = useMutation({
    mutationFn: testMonitor,
    onSettled: () => setTestingMonitorId(null),
  });

  // Channel mutations
  const createChannelMut = useMutation({
    mutationFn: createNotificationChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      setModal({ type: 'none' });
    },
  });

  const updateChannelMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateNotificationChannel>[1] }) =>
      updateNotificationChannel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      setModal({ type: 'none' });
    },
  });

  const testChannelMut = useMutation({
    mutationFn: testNotificationChannel,
    onSettled: () => setTestingChannelId(null),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="flex gap-4">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">Status Page</Link>
            <button onClick={logout} className="text-sm text-red-600 hover:text-red-800">Logout</button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex gap-4 border-b">
          <button
            onClick={() => setTab('monitors')}
            className={`pb-2 px-1 ${tab === 'monitors' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Monitors
          </button>
          <button
            onClick={() => setTab('notifications')}
            className={`pb-2 px-1 ${tab === 'notifications' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Notifications
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'monitors' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Monitors</h2>
              <button
                onClick={() => setModal({ type: 'create-monitor' })}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add Monitor
              </button>
            </div>

            {monitorsQuery.isLoading ? (
              <div className="text-gray-500">Loading...</div>
            ) : monitorsQuery.data?.monitors.length === 0 ? (
              <div className="text-gray-500">No monitors yet</div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Target</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {monitorsQuery.data?.monitors.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-3 text-sm">{m.name}</td>
                        <td className="px-4 py-3 text-sm uppercase text-gray-500">{m.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{m.target}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${m.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {m.is_active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right space-x-2">
                          <button
                            onClick={() => { setTestingMonitorId(m.id); testMonitorMut.mutate(m.id); }}
                            disabled={testingMonitorId === m.id}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {testingMonitorId === m.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => setModal({ type: 'edit-monitor', monitor: m })}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this monitor?')) deleteMonitorMut.mutate(m.id); }}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Notification Channels</h2>
              <button
                onClick={() => setModal({ type: 'create-channel' })}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add Channel
              </button>
            </div>

            {channelsQuery.isLoading ? (
              <div className="text-gray-500">Loading...</div>
            ) : channelsQuery.data?.notification_channels.length === 0 ? (
              <div className="text-gray-500">No channels yet</div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">URL</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {channelsQuery.data?.notification_channels.map((ch) => (
                      <tr key={ch.id}>
                        <td className="px-4 py-3 text-sm">{ch.name}</td>
                        <td className="px-4 py-3 text-sm uppercase text-gray-500">{ch.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{ch.config_json.url}</td>
                        <td className="px-4 py-3 text-sm text-right space-x-2">
                          <button
                            onClick={() => { setTestingChannelId(ch.id); testChannelMut.mutate(ch.id); }}
                            disabled={testingChannelId === ch.id}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {testingChannelId === ch.id ? 'Testing...' : 'Test'}
                          </button>
                          <button
                            onClick={() => setModal({ type: 'edit-channel', channel: ch })}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {modal.type !== 'none' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {modal.type === 'create-monitor' && 'Create Monitor'}
              {modal.type === 'edit-monitor' && 'Edit Monitor'}
              {modal.type === 'create-channel' && 'Create Channel'}
              {modal.type === 'edit-channel' && 'Edit Channel'}
            </h2>

            {(modal.type === 'create-monitor' || modal.type === 'edit-monitor') && (
              <MonitorForm
                monitor={modal.type === 'edit-monitor' ? modal.monitor : undefined}
                onSubmit={(data) => {
                  if (modal.type === 'edit-monitor') {
                    updateMonitorMut.mutate({ id: modal.monitor.id, data });
                  } else {
                    createMonitorMut.mutate(data);
                  }
                }}
                onCancel={() => setModal({ type: 'none' })}
                isLoading={createMonitorMut.isPending || updateMonitorMut.isPending}
              />
            )}

            {(modal.type === 'create-channel' || modal.type === 'edit-channel') && (
              <NotificationChannelForm
                channel={modal.type === 'edit-channel' ? modal.channel : undefined}
                onSubmit={(data) => {
                  if (modal.type === 'edit-channel') {
                    updateChannelMut.mutate({ id: modal.channel.id, data });
                  } else {
                    createChannelMut.mutate(data);
                  }
                }}
                onCancel={() => setModal({ type: 'none' })}
                isLoading={createChannelMut.isPending || updateChannelMut.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

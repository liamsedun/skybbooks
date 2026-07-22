import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gauge, Plus, Loader2, RefreshCw, X, Pencil, Trash2,
} from 'lucide-react';
import { api } from '../../lib/api';

export function RateLimitsPage() {
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    endpoint: '', method: 'ALL', maxRequests: 100, windowMs: 60000, description: '', isActive: true,
  });
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['rate-limit-configs'],
    queryFn: async () => {
      const res = await api.get('/platform/rate-limits');
      return res.data.data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await api.post('/platform/rate-limits', data); return res.data.data; },
    onSuccess: () => { setShowModal(null); resetForm(); queryClient.invalidateQueries({ queryKey: ['rate-limit-configs'] }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await api.put(`/platform/rate-limits/${id}`, data); return res.data.data; },
    onSuccess: () => { setShowModal(null); setEditingId(null); resetForm(); queryClient.invalidateQueries({ queryKey: ['rate-limit-configs'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await api.delete(`/platform/rate-limits/${id}`); return res.data; },
    onSuccess: () => { setShowDelete(null); queryClient.invalidateQueries({ queryKey: ['rate-limit-configs'] }); },
  });

  function resetForm() {
    setForm({ endpoint: '', method: 'ALL', maxRequests: 100, windowMs: 60000, description: '', isActive: true });
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setForm({
      endpoint: c.endpoint, method: c.method, maxRequests: c.maxRequests,
      windowMs: c.windowMs, description: c.description || '', isActive: c.isActive,
    });
    setShowModal('edit');
  }

  function fmtWindow(ms: number) {
    if (ms >= 3600000) return `${ms / 3600000}h`;
    if (ms >= 60000) return `${ms / 60000}m`;
    return `${ms / 1000}s`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rate Limit Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage API rate limiting per endpoint</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetForm(); setShowModal('create'); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['rate-limit-configs'] })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600">Endpoint</th>
                <th className="text-left p-3 font-medium text-gray-600">Method</th>
                <th className="text-left p-3 font-medium text-gray-600">Max Requests</th>
                <th className="text-left p-3 font-medium text-gray-600">Window</th>
                <th className="text-left p-3 font-medium text-gray-600">Active</th>
                <th className="text-left p-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs?.map((c: any) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900 font-mono text-xs">{c.endpoint}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded font-mono">{c.method}</span>
                  </td>
                  <td className="p-3">{c.maxRequests}</td>
                  <td className="p-3 text-gray-500">{fmtWindow(c.windowMs)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setShowDelete(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!configs || configs.length === 0) && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">No rate limit rules configured</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {(showModal === 'create' || showModal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowModal(null); setEditingId(null); }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{showModal === 'create' ? 'Add Rate Limit Rule' : 'Edit Rate Limit Rule'}</h3>
              <button onClick={() => { setShowModal(null); setEditingId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint pattern</label>
                <input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/api/accounts/*" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="ALL">ALL</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Requests</label>
                  <input type="number" value={form.maxRequests} onChange={e => setForm(f => ({ ...f, maxRequests: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" min={1} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Window (ms)</label>
                  <input type="number" value={form.windowMs} onChange={e => setForm(f => ({ ...f, windowMs: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" min={1000} step={1000} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                Active
              </label>
              <button onClick={() => {
                if (showModal === 'create') createMutation.mutate(form);
                else if (editingId) updateMutation.mutate({ id: editingId, data: form });
              }} disabled={!form.endpoint || createMutation.isPending || updateMutation.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {showModal === 'create' ? 'Create' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDelete(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete Rate Limit Rule</h3>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this rate limit rule? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDelete(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(showDelete)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

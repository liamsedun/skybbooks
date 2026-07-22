import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical, Plus, Loader2, RefreshCw, X, Pencil, History,
  ToggleLeft, ToggleRight, Percent,
} from 'lucide-react';
import { api } from '../../lib/api';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function FeatureRolloutsPage() {
  const [showModal, setShowModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState<string | null>(null);
  const [form, setForm] = useState({
    featureKey: '', name: '', description: '', rolloutPercent: 0, isActive: false, allowlistOrgIds: '',
  });
  const queryClient = useQueryClient();

  const { data: rollouts, isLoading } = useQuery({
    queryKey: ['feature-rollouts'],
    queryFn: async () => {
      const res = await api.get('/platform/feature-rollouts');
      return res.data.data as any[];
    },
  });

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['rollout-events', showEvents],
    queryFn: async () => {
      if (!showEvents) return [];
      const res = await api.get(`/platform/feature-rollouts/${showEvents}/events`);
      return res.data.data as any[];
    },
    enabled: !!showEvents,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await api.post('/platform/feature-rollouts', data); return res.data.data; },
    onSuccess: () => { setShowModal(null); resetForm(); queryClient.invalidateQueries({ queryKey: ['feature-rollouts'] }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await api.put(`/platform/feature-rollouts/${id}`, data); return res.data.data; },
    onSuccess: () => { setShowModal(null); setEditingId(null); resetForm(); queryClient.invalidateQueries({ queryKey: ['feature-rollouts'] }); },
  });

  function resetForm() {
    setForm({ featureKey: '', name: '', description: '', rolloutPercent: 0, isActive: false, allowlistOrgIds: '' });
  }

  function openEdit(r: any) {
    setEditingId(r.id);
    setForm({
      featureKey: r.featureKey, name: r.name, description: r.description || '',
      rolloutPercent: r.rolloutPercent, isActive: r.isActive,
      allowlistOrgIds: (r.allowlistOrgIds || []).join(', '),
    });
    setShowModal('edit');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Rollouts</h1>
          <p className="text-sm text-gray-500 mt-1">A/B testing and gradual feature rollout management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetForm(); setShowModal('create'); }} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Rollout
          </button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['feature-rollouts'] })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : !rollouts || rollouts.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-400">No feature rollouts configured</div>
        ) : (
          rollouts.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{r.name}</h3>
                    <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded">{r.featureKey}</span>
                    {r.isActive ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                        <ToggleRight className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                        <ToggleLeft className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </div>
                  {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> Rollout: {r.rolloutPercent}%</span>
                    {r.startedAt && <span>Started: {fmtDate(r.startedAt)}</span>}
                    {r.endedAt && <span>Ended: {fmtDate(r.endedAt)}</span>}
                    {r.allowlistOrgIds?.length > 0 && <span>Allowlisted: {r.allowlistOrgIds.length} org(s)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowEvents(r.id); refetchEvents(); }} className="text-blue-600 hover:text-blue-800" title="View events">
                    <History className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {(showModal === 'create' || showModal === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowModal(null); setEditingId(null); }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{showModal === 'create' ? 'New Feature Rollout' : 'Edit Rollout'}</h3>
              <button onClick={() => { setShowModal(null); setEditingId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feature Key</label>
                <input value={form.featureKey} onChange={e => setForm(f => ({ ...f, featureKey: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="new_dashboard_v2" disabled={showModal === 'edit'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rollout Percentage</label>
                <div className="flex items-center gap-2">
                  <input type="range" value={form.rolloutPercent} onChange={e => setForm(f => ({ ...f, rolloutPercent: Number(e.target.value) }))}
                    min={0} max={100} className="flex-1" />
                  <span className="text-sm font-medium w-12 text-right">{form.rolloutPercent}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allowlisted Org IDs (comma-separated)</label>
                <input value={form.allowlistOrgIds} onChange={e => setForm(f => ({ ...f, allowlistOrgIds: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="org-1, org-2, org-3" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                Active
              </label>
              <button onClick={() => {
                const data = {
                  ...form,
                  allowlistOrgIds: form.allowlistOrgIds ? form.allowlistOrgIds.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
                };
                if (showModal === 'create') createMutation.mutate(data);
                else if (editingId) updateMutation.mutate({ id: editingId, data });
              }} disabled={!form.featureKey || !form.name || createMutation.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {showModal === 'create' ? 'Create Rollout' : 'Update Rollout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEvents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEvents(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Rollout Events</h3>
              <button onClick={() => setShowEvents(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {!events || events.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No events recorded</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">Event</th>
                    <th className="text-left p-3 font-medium text-gray-600">Org</th>
                    <th className="text-left p-3 font-medium text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e: any) => (
                    <tr key={e.event?.id || e.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{e.event?.event || e.event}</td>
                      <td className="p-3 text-gray-500">{e.orgName || e.event?.orgId || '-'}</td>
                      <td className="p-3 text-gray-500">{fmtDate(e.event?.createdAt || e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

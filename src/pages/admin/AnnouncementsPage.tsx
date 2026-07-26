import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Plus, Loader2, RefreshCw, X, Globe, Building2,
  Info, AlertTriangle, AlertOctagon, Wrench,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TYPE_ICONS: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  important: AlertOctagon,
  maintenance: Wrench,
};

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  important: 'bg-red-100 text-red-700',
  maintenance: 'bg-purple-100 text-purple-700',
};

export function AnnouncementsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: announcements, isLoading, error } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await api.get('/announcements');
      const list = res.data?.data;
      if (!Array.isArray(list)) {
        console.error('[Announcements] Unexpected API response:', res.data);
        return [];
      }
      return list as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string; message: string; type: string; isGlobal: boolean;
      startsAt?: string; endsAt?: string; orgId?: string;
    }) => {
      const payload = { ...data };
      if (!payload.startsAt) delete payload.startsAt;
      if (!payload.endsAt) delete payload.endsAt;
      if (!payload.orgId) delete payload.orgId;
      const res = await api.post('/announcements', payload);
      return res.data.data;
    },
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm({ title: '', message: '', type: 'info', isGlobal: true, startsAt: '', endsAt: '', orgId: '' });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to create announcement', 'error'),
  });

  const [createForm, setCreateForm] = useState({
    title: '', message: '', type: 'info', isGlobal: true,
    startsAt: '', endsAt: '', orgId: '',
  });

  const now = new Date();

  const active = announcements?.filter(a => {
    try {
      return new Date(a.startsAt) <= now && (!a.endsAt || new Date(a.endsAt) >= now);
    } catch { return false; }
  }) || [];
  const past = announcements?.filter(a => {
    try {
      return a.endsAt && new Date(a.endsAt) < now;
    } catch { return false; }
  }) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Announcements</h1>
          <p className="text-sm text-ink-500 mt-1">Create and manage platform announcements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Announcement
          </button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['announcements'] })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-subtle">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

        <div className="bg-surface rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink-700">Active Announcements</h3>
              {!isLoading && announcements && (
                <span className="text-[11px] text-ink-400">{active.length} active / {announcements.length} total</span>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-500 text-center py-2">Error loading: {(error as any)?.message || 'Unknown error'}</p>
            )}
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
            ) : !announcements ? (
              <p className="text-sm text-ink-400 text-center py-4">Could not load announcements</p>
            ) : active.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-4">No active announcements</p>
            ) : (
          <div className="space-y-3">
            {active.map((a: any) => {
              const TypeIcon = TYPE_ICONS[a.type] || Info;
              return (
                <div key={a.id} className="flex items-start gap-3 p-4 border rounded-lg">
                  <div className={`p-2 rounded-lg ${TYPE_COLORS[a.type] || 'bg-surface-hover text-ink-600'}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-ink-900">{a.title}</h4>
                      {a.isGlobal ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                          <Globe className="w-3 h-3" /> Global
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-surface-hover text-ink-600">
                          <Building2 className="w-3 h-3" /> Org-specific
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-600 mt-1 whitespace-pre-wrap">{a.message}</p>
                    <p className="text-xs text-ink-400 mt-1">
                      {fmtDate(a.startsAt)} — {a.endsAt ? fmtDate(a.endsAt) : 'No end date'}
                      {a.createdBy && ` · by ${a.createdBy.fullName}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-surface rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-ink-700 mb-4">Past Announcements</h3>
        {past.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">No past announcements</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-subtle">
                <th className="text-left p-3 font-medium text-ink-600">Title</th>
                <th className="text-left p-3 font-medium text-ink-600">Type</th>
                <th className="text-left p-3 font-medium text-ink-600">Scope</th>
                <th className="text-left p-3 font-medium text-ink-600">Date</th>
                <th className="text-left p-3 font-medium text-ink-600">Created By</th>
              </tr>
            </thead>
            <tbody>
              {past.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-surface-subtle">
                  <td className="p-3 font-medium text-ink-900">{a.title}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 text-xs rounded-full ${TYPE_COLORS[a.type] || ''}`}>{a.type}</span></td>
                  <td className="p-3">{a.isGlobal ? 'Global' : 'Org-specific'}</td>
                  <td className="p-3 text-ink-500">{fmtDate(a.startsAt)}</td>
                  <td className="p-3 text-ink-500">{a.createdBy?.fullName || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Announcement</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-ink-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Title</label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Type</label>
                <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="important">Important</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Message</label>
                <textarea value={createForm.message} onChange={e => setCreateForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                <input type="checkbox" checked={createForm.isGlobal} onChange={e => setCreateForm(f => ({ ...f, isGlobal: e.target.checked }))} className="rounded" />
                Global announcement (visible to all orgs)
              </label>
              {!createForm.isGlobal && (
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Target Organisation ID</label>
                  <input value={createForm.orgId} onChange={e => setCreateForm(f => ({ ...f, orgId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">Start Date</label>
                  <input type="datetime-local" value={createForm.startsAt} onChange={e => setCreateForm(f => ({ ...f, startsAt: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-1">End Date (optional)</label>
                  <input type="datetime-local" value={createForm.endsAt} onChange={e => setCreateForm(f => ({ ...f, endsAt: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={() => createMutation.mutate(createForm)}
                disabled={!createForm.title || !createForm.message || createMutation.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create Announcement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

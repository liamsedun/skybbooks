import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Plus, Trash2, X, Search } from 'lucide-react';
import { api } from '../../lib/api';

function fmtDate(d: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function OrgConfigPage() {
  const queryClient = useQueryClient();
  const [orgFilter, setOrgFilter] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'org-configs', orgFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (orgFilter) params.set('orgId', orgFilter);
      const res = await api.get(`/platform/org-configs?${params.toString()}`);
      return res.data.data as any[];
    },
  });

  const { data: orgs } = useQuery({
    queryKey: ['admin', 'organizations-all'],
    queryFn: async () => { const res = await api.get('/platform/organizations?pageSize=500'); return res.data.data as any[]; },
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => { const r = await api.post('/platform/org-configs', payload); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'org-configs'] }); setEditing(null); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/platform/org-configs/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'org-configs'] }),
  });

  const handleSave = () => {
    const payload = { orgId: editing.orgId, key: editing.key, value: editing.value, description: editing.description };
    createMut.mutate(payload);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Org Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Manage key-value configuration per organization</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setEditing({})} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Config</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={orgFilter} onChange={e => setOrgFilter(e.target.value)} placeholder="Filter by org ID (leave empty for all)..."
            className="flex-1 text-sm outline-none" />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-600">Org</th>
              <th className="text-left p-3 font-medium text-gray-600">Key</th>
              <th className="text-left p-3 font-medium text-gray-600">Value</th>
              <th className="text-left p-3 font-medium text-gray-600">Description</th>
              <th className="text-right p-3 font-medium text-gray-600">Updated</th>
              <th className="text-right p-3 font-medium text-gray-600">Actions</th>
            </tr></thead>
            <tbody>
              {data?.map((item: any) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-600">{item.orgName || item.orgId?.slice(0,8)}</td>
                  <td className="p-3"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{item.key}</span></td>
                  <td className="p-3 max-w-[200px] truncate font-mono text-xs text-gray-800">
                    {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{item.description || '-'}</td>
                  <td className="p-3 text-right text-xs text-gray-400">{fmtDate(item.updatedAt || item.createdAt)}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setDeleteId(item.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan={6} className="p-6 text-center text-gray-400">No config entries</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Config Entry</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Organization *</label>
                <select value={editing.orgId || ''} onChange={e => setEditing({ ...editing, orgId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select org</option>
                  {orgs?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Key *</label>
                <input value={editing.key || ''} onChange={e => setEditing({ ...editing, key: e.target.value })}
                  placeholder="e.g. auto_renew, currency, timezone"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Value *</label>
                <input value={editing.value ?? ''} onChange={e => setEditing({ ...editing, value: e.target.value })}
                  placeholder="e.g. true, NGN, Africa/Lagos"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">For booleans/numbers enter raw value; for objects enter JSON string</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={handleSave} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm mb-4">Delete this config entry?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
              <button onClick={() => { deleteMut.mutate(deleteId); setDeleteId(null); }} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

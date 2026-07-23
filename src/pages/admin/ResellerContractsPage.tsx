import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Plus, Pen, Trash2, X, Search } from 'lucide-react';
import { api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ResellerContractsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'reseller-contracts', search],
    queryFn: async () => {
      const res = await api.get(`/platform/reseller-contracts?search=${search}`);
      return res.data.data as any[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => { const res = await api.get('/platform/plans'); return res.data.data as any[]; },
  });

  const { data: orgs } = useQuery({
    queryKey: ['admin', 'organizations-all'],
    queryFn: async () => { const res = await api.get('/platform/organizations?pageSize=500'); return res.data.data as any[]; },
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => { const r = await api.post('/platform/reseller-contracts', payload); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'reseller-contracts'] }); setEditing(null); },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await api.put(`/platform/reseller-contracts/${id}`, data); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'reseller-contracts'] }); setEditing(null); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/platform/reseller-contracts/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reseller-contracts'] }),
  });

  const handleSave = () => {
    const payload = { ...editing };
    delete payload.id; delete payload.resellerOrgName; delete payload.planName; delete payload.createdAt;
    if (editing.id) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const statusStyles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    terminated: 'bg-surface-hover text-ink-600',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Reseller Contracts</h1>
          <p className="text-sm text-ink-500 mt-1">Manage reseller partnership agreements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setEditing({ status: 'active', currency: 'NGN' })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Reseller</button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border">
        <div className="p-4 border-b flex items-center gap-3">
          <Search className="w-4 h-4 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code..."
            className="flex-1 text-sm outline-none" />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-surface-subtle">
              <th className="text-left p-3 font-medium text-ink-600">Reseller</th>
              <th className="text-left p-3 font-medium text-ink-600">Code</th>
              <th className="text-left p-3 font-medium text-ink-600">Org</th>
              <th className="text-right p-3 font-medium text-ink-600">Markup</th>
              <th className="text-right p-3 font-medium text-ink-600">Commission</th>
              <th className="text-center p-3 font-medium text-ink-600">Status</th>
              <th className="text-right p-3 font-medium text-ink-600">Actions</th>
            </tr></thead>
            <tbody>
              {data?.map((item: any) => (
                <tr key={item.id} className="border-b hover:bg-surface-hover">
                  <td className="p-3">
                    <div className="font-medium text-ink-900">{item.resellerName}</div>
                    <div className="text-xs text-ink-400">{item.contactEmail || '-'}</div>
                  </td>
                  <td className="p-3"><span className="font-mono text-xs bg-surface-hover px-2 py-0.5 rounded">{item.resellerCode}</span></td>
                  <td className="p-3 text-ink-600">{item.resellerOrgName || item.resellerOrgId?.slice(0,8)}</td>
                  <td className="p-3 text-right">{item.markupPercent}%</td>
                  <td className="p-3 text-right">{item.commissionPercent}%{item.commissionKobo ? ` (${fmtNaira(item.commissionKobo)})` : ''}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${statusStyles[item.status] || 'bg-surface-hover text-ink-600'}`}>{item.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(item)} className="p-1 hover:bg-surface-hover rounded mr-1"><Pen className="w-4 h-4 text-ink-500" /></button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan={7} className="p-6 text-center text-ink-400">No reseller contracts</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? 'Edit' : 'New'} Reseller Contract</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-ink-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-500 mb-1">Reseller Name *</label>
                <input value={editing.resellerName || ''} onChange={e => setEditing({ ...editing, resellerName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Reseller Code *</label>
                <input value={editing.resellerCode || ''} onChange={e => setEditing({ ...editing, resellerCode: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Reseller Org</label>
                <select value={editing.resellerOrgId || ''} onChange={e => setEditing({ ...editing, resellerOrgId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select org</option>
                  {orgs?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Plan</label>
                <select value={editing.planId || ''} onChange={e => setEditing({ ...editing, planId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select plan</option>
                  {plans?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Contact Name</label>
                <input value={editing.contactName || ''} onChange={e => setEditing({ ...editing, contactName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Contact Email</label>
                <input type="email" value={editing.contactEmail || ''} onChange={e => setEditing({ ...editing, contactEmail: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Markup %</label>
                <input type="number" value={editing.markupPercent || 0} onChange={e => setEditing({ ...editing, markupPercent: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Commission %</label>
                <input type="number" value={editing.commissionPercent || 0} onChange={e => setEditing({ ...editing, commissionPercent: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Currency</label>
                <input value={editing.currency || 'NGN'} onChange={e => setEditing({ ...editing, currency: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Status</label>
                <select value={editing.status || 'active'} onChange={e => setEditing({ ...editing, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">Start Date</label>
                <input type="date" value={editing.startDate ? editing.startDate.slice(0,10) : ''} onChange={e => setEditing({ ...editing, startDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink-500 mb-1">End Date</label>
                <input type="date" value={editing.endDate ? editing.endDate.slice(0,10) : ''} onChange={e => setEditing({ ...editing, endDate: e.target.value || null })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
                <label className="text-sm">Active</label>
              </div>
            </div>
            <button onClick={handleSave} className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              {editing.id ? 'Update' : 'Create'} Reseller
            </button>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm mb-4">Delete this reseller contract?</p>
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Plus, Pen, Trash2, X, Search } from 'lucide-react';
import { api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function RegionalPricingPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'regional-pricing'],
    queryFn: async () => {
      const res = await api.get('/admin/regional-pricing');
      return res.data.data as any[];
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const res = await api.get('/admin/plans');
      return res.data.data as any[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => { const r = await api.post('/admin/regional-pricing', payload); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'regional-pricing'] }); setEditing(null); },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await api.put(`/admin/regional-pricing/${id}`, data); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'regional-pricing'] }); setEditing(null); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/admin/regional-pricing/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'regional-pricing'] }),
  });

  const handleSave = () => {
    const payload = { ...editing };
    delete payload.id; delete payload.planName; delete payload.createdAt;
    if (editing.id) updateMut.mutate({ id: editing.id, data: payload });
    else createMut.mutate(payload);
  };

  const regions = ['ng', 'gh', 'ke', 'za', 'rw', 'tz', 'ug', 'zm', 'other'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regional Pricing</h1>
          <p className="text-sm text-gray-500 mt-1">Manage plan pricing per region/currency</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setEditing({ isActive: true })} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" /> New Pricing</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-600">Plan</th>
              <th className="text-left p-3 font-medium text-gray-600">Region</th>
              <th className="text-left p-3 font-medium text-gray-600">Currency</th>
              <th className="text-right p-3 font-medium text-gray-600">Monthly</th>
              <th className="text-right p-3 font-medium text-gray-600">Annual</th>
              <th className="text-center p-3 font-medium text-gray-600">Active</th>
              <th className="text-right p-3 font-medium text-gray-600">Actions</th>
            </tr></thead>
            <tbody>
              {data?.map((item: any) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">{item.planName || item.planId?.slice(0,8)}</td>
                  <td className="p-3"><span className="uppercase font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{item.region}</span></td>
                  <td className="p-3 text-gray-600">{item.currency}</td>
                  <td className="p-3 text-right font-mono">{fmtNaira(item.monthlyPriceKobo)}</td>
                  <td className="p-3 text-right font-mono">{fmtNaira(item.annualPriceKobo)}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(item)} className="p-1 hover:bg-gray-100 rounded mr-1"><Pen className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan={7} className="p-6 text-center text-gray-400">No regional pricing entries</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? 'Edit' : 'New'} Regional Pricing</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Plan</label>
                <select value={editing.planId || ''} onChange={e => setEditing({ ...editing, planId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select plan</option>
                  {plans?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Region</label>
                <select value={editing.region || ''} onChange={e => setEditing({ ...editing, region: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select region</option>
                  {regions.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <input value={editing.currency || 'NGN'} onChange={e => setEditing({ ...editing, currency: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monthly Price (kobo)</label>
                  <input type="number" value={editing.monthlyPriceKobo || 0} onChange={e => setEditing({ ...editing, monthlyPriceKobo: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Annual Price (kobo)</label>
                  <input type="number" value={editing.annualPriceKobo || 0} onChange={e => setEditing({ ...editing, annualPriceKobo: Number(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
                <label className="text-sm">Active</label>
              </div>
              <button onClick={handleSave} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                {editing.id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm mb-4">Delete this regional pricing entry?</p>
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

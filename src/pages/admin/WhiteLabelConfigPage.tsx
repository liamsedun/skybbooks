import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Pen, Trash2, X, Search } from 'lucide-react';
import { api } from '../../lib/api';

function fmtDate(d: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function WhiteLabelConfigPage() {
  const queryClient = useQueryClient();
  const [orgFilter, setOrgFilter] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'white-label', orgFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (orgFilter) params.set('orgId', orgFilter);
      const res = await api.get(`/admin/white-label?${params.toString()}`);
      return res.data.data as any[];
    },
  });

  const { data: orgs } = useQuery({
    queryKey: ['admin', 'organizations-all'],
    queryFn: async () => { const res = await api.get('/admin/organizations?pageSize=500'); return res.data.data as any[]; },
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => { const r = await api.post('/admin/white-label', payload); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'white-label'] }); setEditing(null); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/admin/white-label/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'white-label'] }),
  });

  const handleSave = () => {
    const payload = { ...editing };
    delete payload.id; delete payload.orgName; delete payload.createdAt;
    createMut.mutate(payload);
  };

  const openEdit = (item?: any) => {
    if (item) setEditing({ ...item });
    else setEditing({ isActive: true, primaryColor: '#3b82f6', secondaryColor: '#1e40af', accentColor: '#10b981' });
  };

  const colorPreview = (color: string) => (
    <span className="inline-block w-4 h-4 rounded border align-middle" style={{ backgroundColor: color }} />
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">White Label Config</h1>
          <p className="text-sm text-gray-500 mt-1">Manage branded portal settings per organization</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => openEdit()}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Pen className="w-4 h-4" /> New Config</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={orgFilter} onChange={e => setOrgFilter(e.target.value)} placeholder="Filter by org ID..."
            className="flex-1 text-sm outline-none" />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-600">Org</th>
              <th className="text-left p-3 font-medium text-gray-600">Brand</th>
              <th className="text-left p-3 font-medium text-gray-600">Colors</th>
              <th className="text-left p-3 font-medium text-gray-600">Domain</th>
              <th className="text-center p-3 font-medium text-gray-600">Active</th>
              <th className="text-right p-3 font-medium text-gray-600">Actions</th>
            </tr></thead>
            <tbody>
              {data?.map((item: any) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-600">{item.orgName || item.orgId?.slice(0,8)}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{item.brandName || '-'}</div>
                    <div className="text-xs text-gray-400">{item.supportEmail || '-'}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {item.primaryColor && <span title={`Primary: ${item.primaryColor}`}>{colorPreview(item.primaryColor)}</span>}
                      {item.secondaryColor && <span title={`Secondary: ${item.secondaryColor}`}>{colorPreview(item.secondaryColor)}</span>}
                      {item.accentColor && <span title={`Accent: ${item.accentColor}`}>{colorPreview(item.accentColor)}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-gray-500">{item.customDomain || '-'}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${item.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 rounded mr-1"><Pen className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => setDeleteId(item.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan={6} className="p-6 text-center text-gray-400">No white label configs</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? 'Edit' : 'New'} White Label Config</h3>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Organization *</label>
                <select value={editing.orgId || ''} onChange={e => setEditing({ ...editing, orgId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select org</option>
                  {orgs?.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Brand Name</label>
                <input value={editing.brandName || ''} onChange={e => setEditing({ ...editing, brandName: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Logo URL</label>
                <input value={editing.logoUrl || ''} onChange={e => setEditing({ ...editing, logoUrl: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Favicon URL</label>
                <input value={editing.faviconUrl || ''} onChange={e => setEditing({ ...editing, faviconUrl: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.primaryColor || '#3b82f6'} onChange={e => setEditing({ ...editing, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded border cursor-pointer" />
                  <input value={editing.primaryColor || '#3b82f6'} onChange={e => setEditing({ ...editing, primaryColor: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.secondaryColor || '#1e40af'} onChange={e => setEditing({ ...editing, secondaryColor: e.target.value })}
                    className="w-10 h-10 rounded border cursor-pointer" />
                  <input value={editing.secondaryColor || '#1e40af'} onChange={e => setEditing({ ...editing, secondaryColor: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.accentColor || '#10b981'} onChange={e => setEditing({ ...editing, accentColor: e.target.value })}
                    className="w-10 h-10 rounded border cursor-pointer" />
                  <input value={editing.accentColor || '#10b981'} onChange={e => setEditing({ ...editing, accentColor: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Custom Domain</label>
                <input value={editing.customDomain || ''} onChange={e => setEditing({ ...editing, customDomain: e.target.value })}
                  placeholder="portal.example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Support Email</label>
                <input type="email" value={editing.supportEmail || ''} onChange={e => setEditing({ ...editing, supportEmail: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Support Phone</label>
                <input value={editing.supportPhone || ''} onChange={e => setEditing({ ...editing, supportPhone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Footer Text</label>
                <input value={editing.footerText || ''} onChange={e => setEditing({ ...editing, footerText: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
                <label className="text-sm">Active</label>
              </div>
            </div>
            <button onClick={handleSave} className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              {editing.id ? 'Update' : 'Create'} Config
            </button>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm mb-4">Delete this white label config?</p>
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

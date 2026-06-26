/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import {
  Plus, X, Loader2, AlertCircle, Search, Building2,
  Phone, Mail, Edit2, Trash2, Download, FileText,
  CheckCircle2, ToggleLeft, ToggleRight, Upload
} from 'lucide-react';

interface Vendor {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null;
  country: string; taxPin: string | null; paymentTerms: number | null;
  creditLimit?: number | null; balance?: number; outstanding?: number;
  currency: string; notes: string | null; isActive: boolean; createdAt: string;
}

type FormState = {
  name: string; email: string; phone: string; address: string;
  city: string; state: string; country: string; taxPin: string;
  paymentTerms: string; creditLimit: string; balance: string; currency: string; notes: string;
};

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', address: '',
  city: '', state: '', country: 'Nigeria',
  taxPin: '', paymentTerms: '30', creditLimit: '', balance: '', currency: 'NGN', notes: '',
};

function initials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
const COLORS = ['bg-violet-100 text-violet-700','bg-blue-100 text-blue-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700'];
function colorFor(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

function exportVendorsCSV(vendors: Vendor[]) {
  const headers = ['Name','Email','Phone','Address','City','State','Country','Tax PIN','Payment Terms (days)','Currency','Opening Balance (NGN)','Credit Limit (NGN)','Notes','Status'];
  const rows = vendors.map(v => [
    v.name, v.email||'', v.phone||'', v.address||'', v.city||'', v.state||'',
    v.country, v.taxPin||'', v.paymentTerms ? `${v.paymentTerms}` : '',
    v.currency, v.balance ? `${(v.balance/100).toFixed(2)}` : '', v.creditLimit ? `${(v.creditLimit/100).toFixed(2)}` : '', v.notes||'', v.isActive ? 'Active' : 'Inactive'
  ]);
  const csv = [headers,...rows].map(r => r.map(val => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`vendors-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportVendorsPDF(vendors: Vendor[]) {
  const rows = vendors.map(v => `
    <tr>
      <td><strong>${v.name}</strong>${v.notes ? `<br><small style="color:#64748b">${v.notes}</small>` : ''}</td>
      <td>${v.email||'—'}<br>${v.phone||'—'}</td>
      <td>${[v.city,v.state,v.country].filter(Boolean).join(', ')||'—'}</td>
      <td>${v.taxPin||'—'}</td>
      <td>${v.paymentTerms ? `Net ${v.paymentTerms}` : '—'}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:${v.isActive?'#dcfce7':'#f1f5f9'};color:${v.isActive?'#166534':'#64748b'}">${v.isActive?'Active':'Inactive'}</span></td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vendor Directory</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #0f172a}
    .company{font-size:22px;font-weight:800;color:#0f172a}
    .subtitle{font-size:11px;color:#64748b;margin-top:4px}
    .title{font-size:18px;font-weight:700;color:#0f172a}
    .date{font-size:11px;color:#64748b;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
    td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div>
    <div style="text-align:right"><div class="title">Vendor Directory</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${vendors.length} vendors</div></div>
  </div>
  <table>
    <thead><tr><th>Vendor</th><th>Contact</th><th>Location</th><th>Tax PIN</th><th>Terms</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
}

export function VendorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: vendors = [], isLoading, isError } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/vendors', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); closeModal(); showSuccess('Vendor added.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to save vendor.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/purchases/vendors/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); closeModal(); showSuccess('Vendor updated.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update vendor.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/purchases/vendors/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/purchases/vendors/${id}`, { isActive: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vendors'] }); showSuccess('Vendor deactivated.'); },
  });

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return vendors.filter(v => {
      const matchSearch = !t || v.name.toLowerCase().includes(t) ||
        (v.email||'').toLowerCase().includes(t) || (v.city||'').toLowerCase().includes(t);
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? v.isActive : !v.isActive);
      return matchSearch && matchStatus;
    });
  }, [vendors, search, statusFilter]);

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(null),4000); }
  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }
  function openEdit(v: Vendor) {
    setEditingId(v.id);
    setForm({ name:v.name, email:v.email||'', phone:v.phone||'', address:v.address||'',
      city:v.city||'', state:v.state||'', country:v.country||'Nigeria',
      taxPin:v.taxPin||'', paymentTerms:v.paymentTerms?.toString()||'30',
      creditLimit:v.creditLimit ? (v.creditLimit/100).toString() : '',
      balance:v.balance ? (v.balance/100).toString() : '',
      currency:v.currency||'NGN', notes:v.notes||'' });
    setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Vendor name is required.'); return; }
    const payload = { ...form, email:form.email||null, phone:form.phone||null,
      address:form.address||null, city:form.city||null, state:form.state||null,
      taxPin:form.taxPin||null, notes:form.notes||null,
      creditLimit:form.creditLimit ? Math.round(parseFloat(form.creditLimit)*100) : null,
      balance:form.balance ? Math.round(parseFloat(form.balance)*100) : null,
      paymentTerms:parseInt(form.paymentTerms)||null };
    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const activeCount = vendors.filter(v => v.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500 mt-0.5">{vendors.length} vendors · {activeCount} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportVendorsCSV(filtered)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportVendorsPDF(filtered)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={15} /> Add Vendor
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 w-56" />
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(['all','active','inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 font-medium capitalize transition-colors ${statusFilter===s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading vendors...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load vendors.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Building2 size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No vendors match your search' : 'No vendors yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Add your first supplier to get started</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Contact</th>
                <th className="py-3 px-2 text-left">Location</th>
                <th className="py-3 px-2 text-left">Terms</th>
                <th className="py-3 px-2 text-left">Tax PIN</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 pl-2 pr-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(v => (
                <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${!v.isActive ? 'opacity-60' : ''}`}>
                  <td className="py-3 pl-4 pr-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${colorFor(v.name)}`}>
                        {initials(v.name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{v.name}</p>
                        {v.notes && <p className="text-xs text-slate-400 truncate max-w-[160px]">{v.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="space-y-0.5">
                      {v.email && <div className="flex items-center gap-1 text-xs text-slate-500"><Mail size={11}/> {v.email}</div>}
                      {v.phone && <div className="flex items-center gap-1 text-xs text-slate-500"><Phone size={11}/> {v.phone}</div>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500">{[v.city,v.state,v.country].filter(Boolean).join(', ')||'—'}</td>
                  <td className="py-3 px-2">
                    {v.paymentTerms ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Net {v.paymentTerms}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500 font-mono">{v.taxPin||'—'}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {v.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(v)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors" title="Edit">
                        <Edit2 size={11}/> Edit
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate({ id: v.id, isActive: !v.isActive })}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors ${v.isActive ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}`}
                        title={v.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {v.isActive ? <ToggleRight size={11}/> : <ToggleLeft size={11}/>}
                        {v.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importOpen && (
        <CsvImportModal
          entity="vendors"
          endpoint="/purchases/vendors"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['vendors'] })}
          transformRow={(row, headers) => {
            const map: Record<string, string> = {};
            headers.forEach((h, i) => { map[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
            return {
              name: map['name'],
              email: map['email'] || null,
              phone: map['phone'] || null,
              address: map['address'] || null,
              city: map['city'] || null,
              state: map['state'] || null,
              country: map['country'] || 'Nigeria',
              taxPin: map['tax pin'] || map['taxpin'] || null,
              paymentTerms: map['payment terms (days)'] ? parseInt(map['payment terms (days)'], 10) : null,
              creditLimit: map['creditlimit (ngn)'] ? Math.round(parseFloat(map['creditlimit (ngn)'])*100) : null,
              balance: map['openingbalance (ngn)'] ? Math.round(parseFloat(map['openingbalance (ngn)'])*100) : null,
              currency: map['currency'] || 'NGN',
              notes: map['notes'] || null,
            };
          }}
        />
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto" onClick={e => { if (e.target===e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle size={14}/> {formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor Name *</label>
                  <input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. ABC Supplies Ltd" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="vendor@company.com" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                  <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+234 800 000 0000" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                  <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Street address" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                  <input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="Lagos" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                  <input value={form.state} onChange={e=>setForm({...form,state:e.target.value})} placeholder="Lagos State" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tax PIN</label>
                  <input value={form.taxPin} onChange={e=>setForm({...form,taxPin:e.target.value})} placeholder="TIN-XXXXXXXXX" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.paymentTerms} onChange={e=>setForm({...form,paymentTerms:e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (NGN)</label>
                  <input type="number" step="0.01" min="0" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Credit Limit (NGN)</label>
                  <input type="number" step="0.01" min="0" value={form.creditLimit} onChange={e=>setForm({...form,creditLimit:e.target.value})} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"/>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 size={14} className="animate-spin"/>}
                  {editingId ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

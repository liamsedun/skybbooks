/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { downloadCsv } from '../../lib/csvTemplates';
import {
  Plus, X, Loader2, AlertCircle, Search, Building2,
  Phone, Mail, Edit2, Trash2, Download, FileText,
  CheckCircle2, ToggleLeft, ToggleRight,
  ArrowLeft, Printer, Pencil, MapPin, ExternalLink
} from 'lucide-react';

interface Vendor {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null;
  country: string; taxPin: string | null; paymentTerms: number | null;
  currency: string; notes: string | null; isActive: boolean; createdAt: string;
  balance?: number;
}

type FormState = {
  name: string; email: string; phone: string; address: string;
  city: string; state: string; country: string; taxPin: string;
  paymentTerms: string; currency: string; notes: string; openingBalance: string;
};

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', address: '',
  city: '', state: '', country: 'Nigeria',
  taxPin: '', paymentTerms: '30', currency: 'NGN', notes: '', openingBalance: '',
};

function initials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
const COLORS = ['bg-violet-100 text-violet-700','bg-blue-100 text-blue-700','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700'];
function colorFor(name: string) { return COLORS[name.charCodeAt(0) % COLORS.length]; }

function exportVendorsCSV(vendors: Vendor[]) {
  const headers = ['Name','Email','Phone','Address','City','State','Country','Tax PIN','Payment Terms','Currency','Opening Balance','Notes','Status'];
  const rows = vendors.map(v => [
    v.name, v.email||'', v.phone||'', v.address||'', v.city||'', v.state||'',
    v.country, v.taxPin||'', v.paymentTerms ? `Net ${v.paymentTerms}` : '',
    v.currency, v.balance ? (v.balance / 100).toFixed(2) : '', v.notes||'', v.isActive ? 'Active' : 'Inactive'
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

function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '₦0.00';
  const naira = kobo / 100;
  return '₦' + naira.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface StatementLine {
  id: string;
  date: string;
  type: string;
  number: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
}

interface StatementResponse {
  vendor: { id: string; name: string; email: string | null; phone: string | null; notes: string | null };
  ledgerStatement: StatementLine[];
  closingCreditorBalance: number;
}

export function VendorsPage() {
  const { id } = useParams();
  if (id) return <VendorDetail id={id} />;
  return <VendorsList />;
}

function VendorsList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      if (dateFrom && v.createdAt && v.createdAt < dateFrom) return false;
      if (dateTo && v.createdAt && v.createdAt > dateTo) return false;
      return matchSearch && matchStatus;
    });
  }, [vendors, search, statusFilter, dateFrom, dateTo]);

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(()=>setSuccessMsg(null),4000); }
  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }
  function openEdit(v: Vendor) {
    setEditingId(v.id);
    setForm({ name:v.name, email:v.email||'', phone:v.phone||'', address:v.address||'',
      city:v.city||'', state:v.state||'', country:v.country||'Nigeria',
      taxPin:v.taxPin||'', paymentTerms:v.paymentTerms?.toString()||'30',
      currency:v.currency||'NGN', notes:v.notes||'', openingBalance: v.balance ? (v.balance / 100).toFixed(2) : '' });
    setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Vendor name is required.'); return; }
    const payload = { ...form, email:form.email||null, phone:form.phone||null,
      address:form.address||null, city:form.city||null, state:form.state||null,
      taxPin:form.taxPin||null, notes:form.notes||null,
      paymentTerms:parseInt(form.paymentTerms)||null,
      balance: form.openingBalance ? Math.round(parseFloat(form.openingBalance) * 100) : 0 };
    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const activeCount = vendors.filter(v => v.isActive).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await api.post('/purchases/vendors/import-csv', { csvData: csvText });
      setImportMsg({ type: 'success', text: res.data.message || 'Vendors imported successfully.' });
      setCsvText('');
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Import failed.';
      const errors = err?.response?.data?.errors;
      setImportMsg({ type: 'error', text: errors ? `${msg}: ${errors.join(', ')}` : msg });
    } finally { setImporting(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vendors</h1>
          <p className="text-sm text-slate-500 mt-0.5">{vendors.length} vendors · {activeCount} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCsv('vendors-template.csv', ['Name','Email','Phone','Address','City','State','Country','Tax PIN','Payment Terms','Opening Balance','Currency','Notes'], ['ABC Supplies Ltd','vendor@company.com','+2348000000000','123 Marina Street','Lagos','Lagos State','Nigeria','TIN-1234567890','30','500000','NGN','Main supplier for office materials'])} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> Sample CSV
          </button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> Import CSV
          </button>
          <button onClick={() => exportVendorsCSV(filtered)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportVendorsPDF(filtered)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Plus size={15} /> Add Vendor
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow w-56" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
          {(['all','active','inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 font-medium capitalize transition-colors ${statusFilter===s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {s}
            </button>
          ))}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        <span className="text-xs text-slate-400 font-medium">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading vendors...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <AlertCircle size={18} /> Failed to load vendors.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Building2 size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No vendors match your search' : 'No vendors yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Add your first supplier to get started</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="px-3 py-3 text-left">Vendor</th>
                <th className="px-3 py-3 text-left">Contact</th>
                <th className="px-3 py-3 text-left">Location</th>
                <th className="px-3 py-3 text-left">Terms</th>
                <th className="px-3 py-3 text-left">Tax PIN</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(v => (
                <tr key={v.id} onClick={() => navigate(`/purchases/vendors/${v.id}`)} className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${!v.isActive ? 'opacity-60' : ''}`}>
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
                      {v.email && <div className="flex items-center gap-1 text-xs text-slate-500"><Mail size={11}/> <a href={`mailto:${v.email}`} onClick={e => e.stopPropagation()} className="hover:text-blue-600 transition-colors">{v.email}</a></div>}
                      {v.phone && <div className="flex items-center gap-1 text-xs text-slate-500"><Phone size={11}/> <a href={`tel:${v.phone}`} onClick={e => e.stopPropagation()} className="hover:text-blue-600 transition-colors">{v.phone}</a></div>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500">{[v.city,v.state,v.country].filter(Boolean).join(', ')||'—'}</td>
                  <td className="py-3 px-2">
                    {v.paymentTerms ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Net {v.paymentTerms}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500 font-mono">{v.taxPin||'—'}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${v.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50' : 'bg-slate-100 text-slate-500 border-slate-100/50'}`}>
                      {v.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={e => { e.stopPropagation(); openEdit(v); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all duration-200" title="Edit">
                        <Edit2 size={11}/> Edit
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleMutation.mutate({ id: v.id, isActive: !v.isActive }); }}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-xl border transition-all duration-200 ${v.isActive ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}`}
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
          </table></div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target===e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
              {formError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-2"><AlertCircle size={14}/> {formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor Name *</label>
                  <input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="e.g. ABC Supplies Ltd" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="vendor@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                  <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+234 800 000 0000" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                  <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Street address" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                  <input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="Lagos" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                  <input value={form.state} onChange={e=>setForm({...form,state:e.target.value})} placeholder="Lagos State" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tax PIN</label>
                  <input value={form.taxPin} onChange={e=>setForm({...form,taxPin:e.target.value})} placeholder="TIN-XXXXXXXXX" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow font-mono"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.paymentTerms} onChange={e=>setForm({...form,paymentTerms:e.target.value})} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (NGN)</label>
                  <input type="number" step="0.01" min="0" value={form.openingBalance} onChange={e=>setForm({...form,openingBalance:e.target.value})} placeholder="0.00" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow resize-none"/>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-2 transition-all duration-200">
                  {isSaving && <Loader2 size={14} className="animate-spin"/>}
                  {editingId ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => { setShowImport(false); setImportMsg(null); setCsvText(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Vendors</h2>
              <button onClick={() => { setShowImport(false); setImportMsg(null); setCsvText(''); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500">Upload a CSV file with columns: <code className="text-xs bg-slate-100 px-1 rounded">Name</code>, <code className="text-xs bg-slate-100 px-1 rounded">Email</code>, <code className="text-xs bg-slate-100 px-1 rounded">Phone</code>, <code className="text-xs bg-slate-100 px-1 rounded">Address</code>, <code className="text-xs bg-slate-100 px-1 rounded">City</code>, <code className="text-xs bg-slate-100 px-1 rounded">State</code>, <code className="text-xs bg-slate-100 px-1 rounded">Country</code>, <code className="text-xs bg-slate-100 px-1 rounded">Tax PIN</code>, <code className="text-xs bg-slate-100 px-1 rounded">Payment Terms</code>, <code className="text-xs bg-slate-100 px-1 rounded">Opening Balance</code>. Only <code className="text-xs bg-slate-100 px-1 rounded">Name</code> is required.</p>
            <button onClick={() => downloadCsv('vendors-template.csv', ['Name','Email','Phone','Address','City','State','Country','Tax PIN','Payment Terms','Opening Balance','Currency','Notes'], ['ABC Supplies Ltd','vendor@company.com','+2348000000000','123 Marina Street','Lagos','Lagos State','Nigeria','TIN-1234567890','30','500000','NGN','Main supplier for office materials'])} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              <FileText className="w-3.5 h-3.5" /> Download Sample CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
            {csvText && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded p-2 max-h-24 overflow-auto">{csvText.slice(0, 500)}{csvText.length > 500 ? '...' : ''}</div>
            )}
            {importMsg && (
              <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${importMsg.type === 'success' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                {importMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {importMsg.text}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setShowImport(false); setImportMsg(null); setCsvText(''); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
              <button type="button" disabled={!csvText.trim() || importing} onClick={handleImport} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-2 transition-all duration-200">
                {importing && <Loader2 size={14} className="animate-spin" />}
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VendorDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: vendor, isLoading: loadingVendor } = useQuery<any>({
    queryKey: ['purchases', 'vendor', id],
    queryFn: async () => {
      const res = await api.get(`/purchases/vendors/${id}`);
      return res.data;
    },
  });

  const { data: org } = useQuery<any>({
    queryKey: ['org'],
    queryFn: async () => { const r = await api.get('/org'); return r.data; },
    staleTime: 60000,
  });

  const { data: statement, isLoading: loadingStatement, isError: isStatementError, error: statementError } = useQuery<StatementResponse>({
    queryKey: ['purchases', 'vendor', id, 'statement'],
    queryFn: async () => {
      const res = await api.get(`/purchases/vendors/${id}/statement`);
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/purchases/vendors/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor', id] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setModalOpen(false);
    },
    onError: (err: any) => setFormError(err?.response?.data?.error || 'Failed to update vendor.'),
  });

  function openEditModal() {
    if (!vendor) return;
    setForm({
      name: vendor.name, email: vendor.email || '', phone: vendor.phone || '',
      address: vendor.address || '', city: vendor.city || '', state: vendor.state || '',
      country: vendor.country || 'Nigeria', taxPin: vendor.taxPin || '',
      paymentTerms: vendor.paymentTerms?.toString() || '30',
      currency: vendor.currency || 'NGN', notes: vendor.notes || '',
      openingBalance: vendor.balance ? (vendor.balance / 100).toFixed(2) : '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handlePrintStatement() {
    const el = document.getElementById('vendor-statement-pdf-container');
    if (el) window.print();
  }

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Vendor name is required.'); return; }
    const payload = { ...form, email: form.email || null, phone: form.phone || null,
      address: form.address || null, city: form.city || null, state: form.state || null,
      taxPin: form.taxPin || null, notes: form.notes || null,
      paymentTerms: parseInt(form.paymentTerms) || null,
      balance: form.openingBalance ? Math.round(parseFloat(form.openingBalance) * 100) : 0 };
    updateMutation.mutate(payload);
  }

  if (loadingVendor) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 flex items-center justify-center text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading vendor...
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16 text-center text-slate-500">
        Vendor not found.
        <div className="mt-3">
          <Link to="/purchases/vendors" className="text-indigo-600 hover:underline text-sm">
            Back to vendors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <button
        onClick={() => navigate('/purchases/vendors')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={14} />
        Back to vendors
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{vendor.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            {vendor.email && (
              <a href={`mailto:${vendor.email}`} className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                <Mail size={14} />
                {vendor.email}
              </a>
            )}
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="inline-flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                <Phone size={14} />
                {vendor.phone}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/purchases/payments-made?vendor=${vendor.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-all duration-200"
          >
            <ExternalLink size={14} />
            Make Payment
          </button>
          <button onClick={handlePrintStatement} className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Printer size={14} />
            Print Statement
          </button>
          <button onClick={openEditModal} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Pencil size={14} />
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Creditor Balance</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {formatNaira((vendor.balance || 0) + (vendor.outstanding || 0))}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Payment Terms</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {vendor.paymentTerms != null ? `Net ${vendor.paymentTerms}` : '—'}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Opening Balance</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {formatNaira(vendor.balance || 0)}
          </p>
        </div>
      </div>

      {(vendor.address || vendor.city || vendor.taxPin) && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-6 flex items-start gap-2.5 text-sm text-slate-600">
          <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            {[vendor.address, vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ')}
            {vendor.taxPin && <div className="text-xs text-slate-400 mt-0.5">Tax PIN: {vendor.taxPin}</div>}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <FileText size={16} className="text-slate-400" />
        Account Statement
      </h2>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loadingStatement ? (
          <div className="flex items-center justify-center py-12 text-slate-400 bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl">
            <Loader2 size={18} className="animate-spin mr-2" />
            Loading statement...
          </div>
        ) : isStatementError ? (
          <div className="text-center py-12 text-sm text-rose-500 flex flex-col items-center gap-2">
            <AlertCircle size={18} />
            <span>Failed to load statement.</span>
            {statementError && <span className="text-xs text-rose-400 max-w-md">{(statementError as any)?.response?.data?.error || (statementError as any)?.message}</span>}
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['purchases', 'vendor', id, 'statement'] })}
              className="text-xs text-indigo-600 hover:underline font-medium">Retry</button>
          </div>
        ) : !statement || statement.ledgerStatement.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No transactions yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Number</th>
                <th className="px-3 py-3 text-left">Reference</th>
                <th className="px-3 py-3 text-right">Debit</th>
                <th className="px-3 py-3 text-right">Credit</th>
                <th className="px-3 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {statement.ledgerStatement.map((line) => {
                const isBill = line.type === 'bill';
                const isPayment = line.type === 'payment';
                const isCredit = line.type === 'vendor_credit';
                const isOpening = line.type === 'opening_balance';
                const isDraftBill = isBill && line.status === 'draft';
                const isClickable = (isBill || isPayment || isCredit) && !isDraftBill;
                function handleRowClick() {
                  if (isBill && !isDraftBill) navigate(`/purchases/bills/${line.id}`);
                  else if (isPayment) navigate(`/purchases/payments-made?selected=${line.id}`);
                  else if (isCredit) navigate(`/purchases/credit-notes?selected=${line.id}`);
                }
                return (
                  <tr
                    key={line.id}
                    onClick={() => isClickable && handleRowClick()}
                    className={`hover:bg-slate-50/50 transition-colors ${isClickable ? "cursor-pointer hover:bg-indigo-50/60" : ""} ${isOpening ? "bg-slate-50 font-medium" : ""} ${isDraftBill ? "opacity-60" : ""}`}
                  >
                    <td className="py-2.5 pl-4 pr-3 text-sm text-slate-600">
                      {isOpening ? '—' : new Date(line.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${isBill ? "text-indigo-600" : isPayment ? "text-emerald-600" : isCredit ? "text-amber-600" : isOpening ? "text-slate-800" : "text-slate-500"}`}>
                        {line.type.replace('_', ' ')}
                        {line.status && line.status !== 'posted' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            line.status === 'draft' ? 'bg-slate-100 text-slate-500' :
                            line.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                            line.status === 'void' ? 'bg-rose-50 text-rose-500' :
                            'bg-slate-50 text-slate-400'
                          }`}>{line.status}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-sm font-mono">
                      {isClickable || isDraftBill ? (
                        <span className={`${isDraftBill ? 'text-slate-400' : 'text-indigo-600 hover:underline'} font-medium`}>{line.number}</span>
                      ) : (
                        <span className="text-slate-600">{line.number || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{line.reference}</td>
                    <td className="py-2.5 pr-3 text-sm text-right text-slate-700">
                      {line.debit > 0 ? formatNaira(line.debit) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-right text-slate-700">
                      {line.credit > 0 ? formatNaira(line.credit) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-sm text-right font-medium text-slate-900">
                      {formatNaira(line.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Edit Vendor</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
              {formError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-2"><AlertCircle size={14} /> {formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Supplies Ltd" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vendor@company.com" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 800 000 0000" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street address" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Lagos" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} placeholder="Lagos State" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tax PIN</label>
                  <input value={form.taxPin} onChange={e => setForm({ ...form, taxPin: e.target.value })} placeholder="TIN-XXXXXXXXX" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Opening Balance (NGN)</label>
                  <input type="number" step="0.01" min="0" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-2 transition-all duration-200">
                  {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print container for vendor statement PDF */}
      <div id="vendor-statement-pdf-container" className="bg-white" style={{ display: 'none' }}>
        <div className="p-8 sm:p-10 space-y-8">
          {/* Header gradient bar */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #818cf8)', borderRadius: '2px' }} />

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            <div className="flex items-start gap-3">
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt={org?.name || 'Logo'} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'contain', border: '1px solid #e2e8f0', background: 'white', padding: '4px' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', fontWeight: 'bold' }}>
                  {org?.name?.[0]?.toUpperCase() ?? 'S'}
                </div>
              )}
              <div className="space-y-0.5">
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{org?.name || 'Your Company'}</h2>
                {org?.address && <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>{org.address}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {org?.phone && <span style={{ fontSize: '10px', color: '#64748b' }}>{org.phone}</span>}
                  {org?.email && <span style={{ fontSize: '10px', color: '#64748b' }}>{org.email}</span>}
                  {org?.website && <span style={{ fontSize: '10px', color: '#4f46e5' }}>{org.website}</span>}
                </div>
                {(org?.rcNumber || org?.vatNumber) && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
                    {org?.rcNumber && <span style={{ fontSize: '9px', color: '#94a3b8' }}>RC: {org.rcNumber}</span>}
                    {org?.vatNumber && <span style={{ fontSize: '9px', color: '#94a3b8' }}>VAT: {org.vatNumber}</span>}
                  </div>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '10px', fontWeight: '600', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>Vendor Account Statement</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0' }}>{vendor.name}</p>
              {(vendor.email || vendor.phone) && (
                <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0' }}>
                  {[vendor.email, vendor.phone].filter(Boolean).join(' · ')}
                </p>
              )}
              {vendor.address && <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0' }}>{vendor.address}</p>}
              <p style={{ fontSize: '10px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Opening/closing summary */}
          <div style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <p style={{ fontSize: '9px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>Opening Balance</p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{formatNaira(vendor.balance || 0)}</p>
            </div>
            <div>
              <p style={{ fontSize: '9px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>Closing Balance</p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{formatNaira(statement?.closingCreditorBalance || 0)}</p>
            </div>
            <div>
              <p style={{ fontSize: '9px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px 0' }}>Total Transactions</p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{statement?.ledgerStatement.length || 0}</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Number</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reference</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Debit (₦)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Credit (₦)</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Balance (₦)</th>
              </tr>
            </thead>
            <tbody>
              {statement?.ledgerStatement.map((line, idx) => {
                const isLast = idx === (statement?.ledgerStatement.length || 0) - 1;
                const isDraft = line.status === 'draft';
                return (
                  <tr key={line.id} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: line.type === 'opening_balance' ? '#f8fafc' : isLast ? '#f0fdf4' : 'transparent',
                    fontWeight: isLast ? '600' : 'normal',
                    opacity: isDraft ? '0.5' : '1'
                  }}>
                    <td style={{ padding: '8px', color: '#475569', fontSize: '11px' }}>
                      {line.type === 'opening_balance' ? '—' : fmtDate(line.date)}
                    </td>
                    <td style={{ padding: '8px', color: '#475569', fontSize: '11px', textTransform: 'capitalize' }}>
                      {line.type.replace('_', ' ')}
                      {line.status && line.status !== 'posted' && (
                        <span style={{ display: 'inline-block', fontSize: '9px', padding: '1px 6px', borderRadius: '10px', fontWeight: '600', marginLeft: '4px', background: line.status === 'draft' ? '#f1f5f9' : '#dcfce7', color: line.status === 'draft' ? '#64748b' : '#166534', verticalAlign: 'middle' }}>{line.status}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', fontFamily: 'monospace', color: isDraft ? '#94a3b8' : '#334155', fontSize: '11px' }}>{line.number || '—'}</td>
                    <td style={{ padding: '8px', color: '#94a3b8', fontSize: '11px' }}>{line.reference || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626', fontSize: '11px' }}>{line.debit > 0 ? formatNaira(line.debit) : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#16a34a', fontSize: '11px' }}>{line.credit > 0 ? formatNaira(line.credit) : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#0f172a', fontSize: '11px' }}>{formatNaira(line.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="footer" style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            {org?.name || 'SkyBooks'} · This statement was generated electronically and reflects all transactions recorded in the system.
          </div>
        </div>
      </div>
    </div>
  );
}

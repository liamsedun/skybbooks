import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2,
  RefreshCw, Pause, Play, Trash2, Zap,
  Calendar, TrendingDown, Search, Download, FileText,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

interface Vendor { id: string; name: string; email: string | null; }
interface Item { id: string; name: string; purchasePrice: number | null; }
interface RecurringLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
}
interface RecurringBill {
  id: string; orgId: string; vendorId: string;
  frequency: Frequency; startDate: string; endDate: string | null;
  nextRunDate: string | null; isActive: boolean;
  template: { lines: RecurringLine[]; notes: string; terms: string; paymentTerms: number; } | null;
  createdAt: string;
}

const FREQ_META: Record<Frequency, { label: string; days: number }> = {
  daily:     { label: 'Daily',     days: 1 },
  weekly:    { label: 'Weekly',    days: 7 },
  monthly:   { label: 'Monthly',   days: 30 },
  quarterly: { label: 'Quarterly', days: 90 },
  annually:  { label: 'Annually',  days: 365 },
};

const EMPTY_LINE: RecurringLine = { itemId: null, description: '', quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 7.5 };

type FormState = {
  vendorId: string; frequency: Frequency;
  startDate: string; endDate: string;
  paymentTerms: string; notes: string; terms: string;
  lines: RecurringLine[];
};

const EMPTY_FORM: FormState = {
  vendorId: '', frequency: 'monthly',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '', paymentTerms: '30',
  notes: '', terms: '',
  lines: [{ ...EMPTY_LINE }],
};

function calcLine(line: RecurringLine) {
  const base = line.quantity * line.unitPrice;
  const disc = Math.round(base * (line.discountPct / 100));
  const afterDisc = base - disc;
  const vat = Math.round(afterDisc * (line.taxRate / 100));
  return { base, disc, afterDisc, vat, total: afterDisc + vat };
}

function formatNaira(naira: number): string {
  return `₦${naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function exportRecurringBillsCSV(bills: RecurringBill[], vendorMap: Map<string, Vendor>) {
  const headers = ['Vendor','Frequency','Start Date','End Date','Next Run','Status'];
  const rows = bills.map(r => [
    vendorMap.get(r.vendorId)?.name || r.vendorId, r.frequency, r.startDate,
    r.endDate||'', r.nextRunDate||'', r.isActive ? 'Active' : 'Inactive',
  ]);
  const csv = [headers,...rows].map(r => r.map(val => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`recurring-bills-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportRecurringBillsPDF(bills: RecurringBill[], vendorMap: Map<string, Vendor>) {
  const rows = bills.map(r => `
    <tr>
      <td>${vendorMap.get(r.vendorId)?.name || '\u2014'}</td>
      <td>${r.frequency}</td>
      <td>${new Date(r.startDate).toLocaleDateString('en-GB')}</td>
      <td>${r.endDate ? new Date(r.endDate).toLocaleDateString('en-GB') : '\u2014'}</td>
      <td>${r.nextRunDate ? new Date(r.nextRunDate).toLocaleDateString('en-GB') : '\u2014'}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;background:${r.isActive?'#dcfce7':'#f1f5f9'};color:${r.isActive?'#166534':'#64748b'}">${r.isActive?'Active':'Inactive'}</span></td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recurring Bills</title>
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
    td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="header">
    <div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div>
    <div style="text-align:right"><div class="title">Recurring Bills Report</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div><div class="date">${bills.length} schedules</div></div>
  </div>
  <table><thead><tr><th>Vendor</th><th>Frequency</th><th>Start</th><th>End</th><th>Next Run</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500); }
}

export function RecurringBillsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewLine, setViewLine] = useState<{ line: RecurringLine; template: RecurringBill } | null>(null);

  const { data: templates, isLoading, isError } = useQuery<RecurringBill[]>({
    queryKey: ['recurring-bills'],
    queryFn: async () => { const r = await api.get('/purchases/recurring-bills'); return r.data; },
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['purchases', 'vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: items } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const vendorMap = useMemo(() => {
    const m = new Map<string, Vendor>();
    (vendors || []).forEach(v => m.set(v.id, v));
    return m;
  }, [vendors]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/recurring-bills', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-bills'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create billing template.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/purchases/recurring-bills/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-bills'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update billing template.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/purchases/recurring-bills/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-bills'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/recurring-bills/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-bills'] }),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/recurring-bills/${id}/generate`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setGeneratingId(null);
      setSuccessMsg(`Bill ${res.data?.billNumber || ''} generated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (e: any) => {
      setGeneratingId(null);
      toast(e?.response?.data?.error || 'Failed to generate bill.', 'error');
    },
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (templates || []).filter(t => {
      if (!term) return true;
      const v = vendorMap.get(t.vendorId);
      return (v?.name || '').toLowerCase().includes(term);
    });
  }, [templates, searchTerm, vendorMap]);

  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    form.lines.forEach(l => { const c = calcLine(l); sub += c.base; disc += c.disc; tax += c.vat; });
    return { sub, disc, tax, total: sub - disc + tax };
  }, [form.lines]);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }

  function openEdit(t: RecurringBill) {
    setEditingId(t.id);
    setForm({
      vendorId: t.vendorId,
      frequency: t.frequency,
      startDate: t.startDate ? t.startDate.split('T')[0] : '',
      endDate: t.endDate ? t.endDate.split('T')[0] : '',
      paymentTerms: t.template?.paymentTerms?.toString() || '30',
      notes: t.template?.notes || '',
      terms: t.template?.terms || '',
      lines: t.template?.lines?.length ? t.template.lines.map(l => ({ ...l, unitPrice: l.unitPrice / 100 })) : [{ ...EMPTY_LINE }],
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function updateLine(idx: number, field: keyof RecurringLine, value: any) {
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], [field]: value };
    setForm({ ...form, lines: nl });
  }

  function selectItem(idx: number, itemId: string) {
    const item = (items || []).find(it => it.id === itemId);
    if (!item) return;
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], itemId, description: item.name, unitPrice: (item.purchasePrice ?? 0) / 100 };
    setForm({ ...form, lines: nl });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { setFormError('Please select a vendor.'); return; }
    if (form.lines.length === 0) { setFormError('Add at least one line item.'); return; }
    if (form.lines.some(l => !l.description.trim())) { setFormError('All line items need a description.'); return; }

    const payload = {
      vendorId: form.vendorId,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || null,
      template: {
        lines: form.lines.map(l => ({ ...l, unitPrice: Math.round(l.unitPrice * 100) })),
        notes: form.notes,
        terms: form.terms,
        paymentTerms: parseInt(form.paymentTerms) || 30,
      },
    };

    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const activeCount = (templates || []).filter(t => t.isActive).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => exportRecurringBillsCSV(filtered, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportRecurringBillsPDF(filtered, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 shadow-sm">
            <Plus size={14} /> +New
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by vendor..." className="w-full px-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
      </div>

      {/* Templates */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading templates...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <AlertCircle size={18} /> Failed to load billing templates.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <RefreshCw size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No recurring bill templates yet</p>
            <p className="text-xs mt-1">Create a template to auto-generate bills on a schedule</p>
          </div>
        ) : (
          filtered.map(t => {
            const v = vendorMap.get(t.vendorId);
            const freq = FREQ_META[t.frequency];
            const lines = t.template?.lines || [];
            const lineTotal = lines.reduce((sum, l) => {
              const c = calcLine(l);
              return sum + c.total / 100;
            }, 0);

            return (
              <div key={t.id} className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${t.isActive ? 'border-slate-200/80' : 'border-slate-200/80 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900">{v?.name || '\u2014'}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${t.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {t.isActive ? <><Play className="w-2.5 h-2.5" /> Active</> : <><Pause className="w-2.5 h-2.5" /> Paused</>}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Calendar className="w-2.5 h-2.5" /> {freq.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                      <span>Started: <span className="font-medium text-slate-700">{fmtDate(t.startDate)}</span></span>
                      {t.endDate && <span>Ends: <span className="font-medium text-slate-700">{fmtDate(t.endDate)}</span></span>}
                      <span>Next Run: <span className="font-medium text-slate-700">{fmtDate(t.nextRunDate)}</span></span>
                      <span>Value: <span className="font-mono font-semibold text-slate-900">{formatNaira(lineTotal)}</span> per bill</span>
                    </div>
                    {lines.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {lines.map((l, i) => (
                          <div key={i} onClick={() => setViewLine({ line: l, template: t })} className="text-xs text-slate-500 flex gap-2 cursor-pointer hover:text-slate-700 transition-colors">
                            <span className="text-slate-400">&bull;</span>
                            <span>{l.description}</span>
                            <span className="text-slate-400">&times;{l.quantity}</span>
                            <span className="font-mono text-slate-600">{formatNaira(calcLine(l).total / 100)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setGeneratingId(t.id); generateMutation.mutate(t.id); }}
                      disabled={generateMutation.isPending && generatingId === t.id}
                      className="px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-1"
                      title="Generate bill now"
                    >
                      {generateMutation.isPending && generatingId === t.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <><Zap size={12} /> Generate Now</>}
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                      title="Edit template"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate({ id: t.id, isActive: !t.isActive })}
                      className={`p-1.5 rounded-lg transition-all duration-200 ${t.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      title={t.isActive ? 'Pause' : 'Resume'}
                    >
                      {t.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Delete this recurring bill template? This cannot be undone.')) deleteMutation.mutate(t.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Recurring Bill Template' : 'New Recurring Bill Template'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              {/* Header fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
                    <option value="">Select vendor...</option>
                    {(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Frequency *</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as Frequency })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
                    {(Object.keys(FREQ_META) as Frequency[]).map(f => (
                      <option key={f} value={f}>{FREQ_META[f].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date (optional)</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Bill Line Items</label>
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-3 text-left w-44">Item</th>
                        <th className="px-3 py-3 text-left">Description</th>
                        <th className="px-3 py-3 text-center w-14">Qty</th>
                        <th className="px-3 py-3 text-right w-28">Unit Price (₦)</th>
                        <th className="px-3 py-3 text-center w-14">Disc %</th>
                        <th className="px-3 py-3 text-center w-14">VAT %</th>
                        <th className="px-3 py-3 text-right w-28">Amount</th>
                        <th className="px-3 py-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.lines.map((line, idx) => {
                        const c = calcLine(line);
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(idx, e.target.value) : updateLine(idx, 'itemId', null)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-300 transition-shadow bg-white">
                                <option value="">\u2014 Custom \u2014</option>
                                {(items || []).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-300 transition-shadow" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" min="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-300 transition-shadow" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" min="0" step="0.01" value={line.unitPrice === 0 ? '' : line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-300 transition-shadow" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" min="0" max="100" step="0.1" value={line.discountPct === 0 ? '' : line.discountPct} onChange={e => updateLine(idx, 'discountPct', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-300 transition-shadow" />
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-1 focus:ring-slate-900/20 focus:border-slate-300 transition-shadow" />
                            </td>
                            <td className="py-2 px-3 text-right text-xs font-semibold text-slate-900 font-mono">
                              {formatNaira(c.total)}
                            </td>
                            <td className="py-2 px-3">
                              <button type="button" onClick={() => { if (form.lines.length > 1) setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) }); }} disabled={form.lines.length === 1} className="text-slate-300 hover:text-rose-500 disabled:opacity-20 transition-colors p-1 rounded-lg hover:bg-rose-50">
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/80">
                    <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] })} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <Plus size={13} /> Add Line Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Notes (appears on each bill)</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Terms</label>
                    <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow resize-none" />
                  </div>
                </div>
                <div className="space-y-2 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 self-start">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Per Bill Amount</p>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatNaira(totals.sub)}</span>
                  </div>
                  {totals.disc > 0 && (
                    <div className="flex justify-between text-sm text-violet-600">
                      <span className="flex items-center gap-1"><TrendingDown size={13} /> Discount</span>
                      <span className="font-mono">\u2212 {formatNaira(totals.disc)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>VAT</span>
                    <span className="font-mono">{formatNaira(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-base font-bold text-slate-800">Total</span>
                    <span className="text-base font-black text-slate-900 font-mono">{formatNaira(totals.total)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Billed {FREQ_META[form.frequency]?.label?.toLowerCase()}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all duration-200">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Line Detail Modal */}
      {viewLine && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto" onClick={() => setViewLine(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Line Item Details</h2>
              <button onClick={() => setViewLine(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Item</p>
                  <p className="font-medium text-slate-800 mt-0.5">
                    {(() => {
                      const it = (items || []).find(i => i.id === viewLine.line.itemId);
                      return it?.name || viewLine.line.description;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Description</p>
                  <p className="text-slate-700 mt-0.5">{viewLine.line.description || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Quantity</p>
                  <p className="text-slate-700 mt-0.5">{viewLine.line.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Unit Price (₦)</p>
                  <p className="font-mono text-slate-700 mt-0.5">{formatNaira(viewLine.line.unitPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Discount</p>
                  <p className="font-mono text-slate-700 mt-0.5">{viewLine.line.discountPct}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">VAT Rate</p>
                  <p className="font-mono text-slate-700 mt-0.5">{viewLine.line.taxRate}%</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                {(() => {
                  const c = calcLine(viewLine.line);
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-mono text-slate-700">{formatNaira(c.base)}</span>
                      </div>
                      {c.disc > 0 && (
                        <div className="flex justify-between text-sm text-violet-600">
                          <span>Discount ({viewLine.line.discountPct}%)</span>
                          <span className="font-mono">\u2212 {formatNaira(c.disc)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>VAT ({viewLine.line.taxRate}%)</span>
                        <span className="font-mono">{formatNaira(c.vat)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200 text-base">
                        <span className="font-semibold text-slate-800">Line Total</span>
                        <span className="font-black text-slate-900 font-mono">{formatNaira(c.total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {viewLine.template && (
                <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
                  Part of <span className="font-medium text-slate-600">{(vendorMap.get(viewLine.template.vendorId)?.name || '\u2014')}</span> &middot; {FREQ_META[viewLine.template.frequency]?.label} billing
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

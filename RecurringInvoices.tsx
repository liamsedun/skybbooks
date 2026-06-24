/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, CheckCircle2,
  RefreshCw, Pause, Play, Trash2, Zap,
  Calendar, TrendingDown, Search,
} from 'lucide-react';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

interface Customer { id: string; name: string; email: string | null; }
interface Item { id: string; name: string; salesPrice: number | null; }
interface RecurringLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
}
interface RecurringInvoice {
  id: string; orgId: string; customerId: string;
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
  customerId: string; frequency: Frequency;
  startDate: string; endDate: string;
  paymentTerms: string; notes: string; terms: string;
  lines: RecurringLine[];
};

const EMPTY_FORM: FormState = {
  customerId: '', frequency: 'monthly',
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
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function RecurringInvoicesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: templates, isLoading, isError } = useQuery<RecurringInvoice[]>({
    queryKey: ['recurring-invoices'],
    queryFn: async () => { const r = await api.get('/sales/recurring-invoices'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: items } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/sales/recurring-invoices', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create billing template.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/sales/recurring-invoices/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update billing template.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/sales/recurring-invoices/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/recurring-invoices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] }),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/recurring-invoices/${id}/generate`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setGeneratingId(null);
      setSuccessMsg(`Invoice ${res.data?.invoiceNumber || ''} generated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (e: any) => {
      setGeneratingId(null);
      alert(e?.response?.data?.error || 'Failed to generate invoice.');
    },
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (templates || []).filter(t => {
      if (!term) return true;
      const cust = customerMap.get(t.customerId);
      return (cust?.name || '').toLowerCase().includes(term);
    });
  }, [templates, searchTerm, customerMap]);

  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0;
    form.lines.forEach(l => { const c = calcLine(l); sub += c.base; disc += c.disc; tax += c.vat; });
    return { sub, disc, tax, total: sub - disc + tax };
  }, [form.lines]);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }

  function openEdit(t: RecurringInvoice) {
    setEditingId(t.id);
    setForm({
      customerId: t.customerId,
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
    nl[idx] = { ...nl[idx], itemId, description: item.name, unitPrice: item.salesPrice ?? 0 };
    setForm({ ...form, lines: nl });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    if (form.lines.length === 0) { setFormError('Add at least one line item.'); return; }
    if (form.lines.some(l => !l.description.trim())) { setFormError('All line items need a description.'); return; }

    const payload = {
      customerId: form.customerId,
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recurring Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {templates?.length || 0} templates · {activeCount} active
          </p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} /> New Billing Template
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by customer..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {/* Templates */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading templates...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
            <AlertCircle size={18} /> Failed to load billing templates.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
            <RefreshCw size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No billing templates yet</p>
            <p className="text-xs mt-1">Create a template to auto-generate invoices on a schedule</p>
          </div>
        ) : (
          filtered.map(t => {
            const cust = customerMap.get(t.customerId);
            const freq = FREQ_META[t.frequency];
            const lines = t.template?.lines || [];
            const lineTotal = lines.reduce((sum, l) => {
              const c = calcLine(l);
              return sum + c.total;
            }, 0);

            return (
              <div key={t.id} className={`bg-white border rounded-xl p-5 transition-all ${t.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900">{cust?.name || '—'}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {t.isActive ? <><Play className="w-2.5 h-2.5" /> Active</> : <><Pause className="w-2.5 h-2.5" /> Paused</>}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        <Calendar className="w-2.5 h-2.5" /> {freq.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                      <span>Started: <span className="font-medium text-slate-700">{fmtDate(t.startDate)}</span></span>
                      {t.endDate && <span>Ends: <span className="font-medium text-slate-700">{fmtDate(t.endDate)}</span></span>}
                      <span>Next Run: <span className="font-medium text-slate-700">{fmtDate(t.nextRunDate)}</span></span>
                      <span>Value: <span className="font-mono font-semibold text-slate-900">{formatNaira(lineTotal)}</span> per invoice</span>
                    </div>
                    {lines.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {lines.map((l, i) => (
                          <div key={i} className="text-xs text-slate-500 flex gap-2">
                            <span className="text-slate-400">•</span>
                            <span>{l.description}</span>
                            <span className="text-slate-400">×{l.quantity}</span>
                            <span className="font-mono text-slate-600">{formatNaira(calcLine(l).total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setGeneratingId(t.id); generateMutation.mutate(t.id); }}
                      disabled={generateMutation.isPending && generatingId === t.id}
                      className="px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                      title="Generate invoice now"
                    >
                      {generateMutation.isPending && generatingId === t.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <><Zap size={12} /> Generate Now</>}
                    </button>
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit template"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate({ id: t.id, isActive: !t.isActive })}
                      className={`p-1.5 rounded-lg transition-colors ${t.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      title={t.isActive ? 'Pause' : 'Resume'}
                    >
                      {t.isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Delete this billing template? This cannot be undone.')) deleteMutation.mutate(t.id); }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Billing Template' : 'New Billing Template'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}

              {/* Header fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer *</label>
                  <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Frequency *</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as Frequency })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {(Object.keys(FREQ_META) as Frequency[]).map(f => (
                      <option key={f} value={f}>{FREQ_META[f].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date (optional)</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Invoice Line Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <th className="py-2.5 pl-3 pr-2 text-left w-44">Item</th>
                        <th className="py-2.5 px-2 text-left">Description</th>
                        <th className="py-2.5 px-2 text-center w-14">Qty</th>
                        <th className="py-2.5 px-2 text-right w-28">Unit Price (₦)</th>
                        <th className="py-2.5 px-2 text-center w-14">Disc %</th>
                        <th className="py-2.5 px-2 text-center w-14">VAT %</th>
                        <th className="py-2.5 px-2 text-right w-28">Amount</th>
                        <th className="py-2.5 pl-2 pr-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.lines.map((line, idx) => {
                        const c = calcLine(line);
                        return (
                          <tr key={idx}>
                            <td className="py-2 pl-3 pr-2">
                              <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(idx, e.target.value) : updateLine(idx, 'itemId', null)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 bg-white">
                                <option value="">— Custom —</option>
                                {(items || []).map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-2">
                              <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" step="0.01" value={line.unitPrice === 0 ? '' : line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" max="100" step="0.1" value={line.discountPct === 0 ? '' : line.discountPct} onChange={e => updateLine(idx, 'discountPct', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2 text-right text-xs font-medium text-slate-900 font-mono">
                              {formatNaira(c.total)}
                            </td>
                            <td className="py-2 pl-2 pr-3">
                              <button type="button" onClick={() => { if (form.lines.length > 1) setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) }); }} disabled={form.lines.length === 1} className="text-slate-300 hover:text-rose-500 disabled:opacity-20 transition-colors">
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
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
                    <label className="block text-xs font-medium text-slate-500 mb-1">Notes (appears on each invoice)</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Terms</label>
                    <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none" />
                  </div>
                </div>
                <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-100 self-start">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Per Invoice Amount</p>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatNaira(totals.sub)}</span>
                  </div>
                  {totals.disc > 0 && (
                    <div className="flex justify-between text-sm text-violet-600">
                      <span className="flex items-center gap-1"><TrendingDown size={13} /> Discount</span>
                      <span className="font-mono">− {formatNaira(totals.disc)}</span>
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
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

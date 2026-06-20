/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, Search, Pencil, Trash2, X, Loader2, AlertCircle,
  FileText, ArrowRight, CheckCircle2, Clock, XCircle, RefreshCw,
} from 'lucide-react';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted';

interface Customer { id: string; name: string; email: string | null; }
interface Quote {
  id: string; orgId: string; quoteNumber: string; customerId: string;
  date: string; expiryDate: string | null; status: QuoteStatus;
  currency: string; subtotal: number; discount: number; tax: number;
  total: number; notes: string | null; terms: string | null;
  convertedToId: string | null; createdAt: string;
}

type QuoteFormState = {
  customerId: string; date: string; expiryDate: string;
  status: QuoteStatus; subtotal: string; discount: string;
  tax: string; notes: string; terms: string;
};

const EMPTY_FORM: QuoteFormState = {
  customerId: '', date: new Date().toISOString().split('T')[0],
  expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'draft', subtotal: '', discount: '0', tax: '', notes: '', terms: '',
};

const STATUS_META: Record<QuoteStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft:     { label: 'Draft',     color: 'text-slate-600',   bg: 'bg-slate-100',   icon: FileText },
  sent:      { label: 'Sent',      color: 'text-blue-700',    bg: 'bg-blue-50',     icon: ArrowRight },
  accepted:  { label: 'Accepted',  color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: CheckCircle2 },
  declined:  { label: 'Declined',  color: 'text-rose-700',    bg: 'bg-rose-50',     icon: XCircle },
  expired:   { label: 'Expired',   color: 'text-amber-700',   bg: 'bg-amber-50',    icon: Clock },
  converted: { label: 'Converted', color: 'text-violet-700',  bg: 'bg-violet-50',   icon: RefreshCw },
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildPayload(form: QuoteFormState) {
  const subtotal = form.subtotal ? Math.round(parseFloat(form.subtotal) * 100) : 0;
  const discount = form.discount ? Math.round(parseFloat(form.discount) * 100) : 0;
  const tax      = form.tax      ? Math.round(parseFloat(form.tax)      * 100) : 0;
  return {
    customerId:  form.customerId,
    date:        form.date || undefined,
    expiryDate:  form.expiryDate || null,
    status:      form.status,
    subtotal,
    discount,
    tax,
    total: subtotal - discount + tax,
    notes: form.notes.trim() || null,
    terms: form.terms.trim() || null,
  };
}

function formFromQuote(q: Quote): QuoteFormState {
  return {
    customerId: q.customerId,
    date:       q.date ? q.date.split('T')[0] : '',
    expiryDate: q.expiryDate ? q.expiryDate.split('T')[0] : '',
    status:     q.status,
    subtotal:   q.subtotal ? (q.subtotal / 100).toString() : '',
    discount:   q.discount ? (q.discount / 100).toString() : '0',
    tax:        q.tax      ? (q.tax      / 100).toString() : '',
    notes:      q.notes  || '',
    terms:      q.terms  || '',
  };
}

export function QuotesPage() {
  const queryClient = useQueryClient();
  const [searchTerm,  setSearchTerm]  = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState<QuoteFormState>(EMPTY_FORM);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  const { data: quotesData, isLoading, isError } = useQuery<Quote[]>({
    queryKey: ['sales', 'quotes'],
    queryFn: async () => { const r = await api.get('/sales/quotes'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/sales/quotes', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'quotes'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create quote.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/sales/quotes/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'quotes'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update quote.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/quotes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales', 'quotes'] }); setDeleteTarget(null); setDeleteError(null); },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to delete quote.'),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/quotes/${id}/convert`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setConvertingId(null);
      setConvertSuccess(`Converted to ${res.data?.invoice?.invoiceNumber || 'invoice'} successfully.`);
      setTimeout(() => setConvertSuccess(null), 4000);
    },
    onError: (e: any) => { setConvertingId(null); alert(e?.response?.data?.error || 'Conversion failed.'); },
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (quotesData || []).filter(q => {
      if (statusFilter !== 'all' && q.status !== statusFilter) return false;
      if (!term) return true;
      const cust = customerMap.get(q.customerId);
      return q.quoteNumber.toLowerCase().includes(term) || (cust?.name || '').toLowerCase().includes(term);
    });
  }, [quotesData, searchTerm, statusFilter, customerMap]);

  const counts = useMemo(() => {
    const all = quotesData?.length || 0;
    const byStatus: Record<string, number> = {};
    (quotesData || []).forEach(q => { byStatus[q.status] = (byStatus[q.status] || 0) + 1; });
    return { all, byStatus };
  }, [quotesData]);

  function openAddModal() { setForm(EMPTY_FORM); setEditingId(null); setFormError(null); setModalOpen(true); }
  function openEditModal(q: Quote) { setForm(formFromQuote(q)); setEditingId(q.id); setFormError(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    const p = buildPayload(form);
    if (editingId) updateMutation.mutate({ id: editingId, p });
    else createMutation.mutate(p);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Computed total preview in modal
  const previewSubtotal = parseFloat(form.subtotal) || 0;
  const previewDiscount = parseFloat(form.discount) || 0;
  const previewTax      = parseFloat(form.tax)      || 0;
  const previewTotal    = previewSubtotal - previewDiscount + previewTax;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500 mt-1">
            {counts.all} quotes · {counts.byStatus['accepted'] || 0} accepted · {counts.byStatus['converted'] || 0} converted
          </p>
        </div>
        <button onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={16} />New Quote
        </button>
      </div>

      {convertSuccess && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
          <CheckCircle2 size={16} />{convertSuccess}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'draft', 'sent', 'accepted', 'declined', 'expired', 'converted'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {s === 'all' ? `All (${counts.all})` : `${STATUS_META[s].label} (${counts.byStatus[s] || 0})`}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by quote number or customer..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />Loading quotes...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />Failed to load quotes.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <FileText size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No quotes yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first quote to send to a customer.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Quote #</th>
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Expires</th>
                <th className="py-2.5 pr-3">Amount</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(q => {
                const meta = STATUS_META[q.status];
                const Icon = meta.icon;
                const cust = customerMap.get(q.customerId);
                return (
                  <tr key={q.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{q.quoteNumber}</td>
                    <td className="py-2.5 pr-3">
                      <p className="text-sm font-medium text-slate-800">{cust?.name || '—'}</p>
                      {cust?.email && <p className="text-xs text-slate-400">{cust.email}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(q.date)}</td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(q.expiryDate)}</td>
                    <td className="py-2.5 pr-3 text-sm font-medium text-slate-700">{formatNaira(q.total)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
                        <Icon className="w-3 h-3" />{meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity">
                        {(q.status === 'accepted') && (
                          <button onClick={() => { setConvertingId(q.id); convertMutation.mutate(q.id); }}
                            disabled={convertingId === q.id}
                            className="px-2 py-1 rounded text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-50"
                            title="Convert to Invoice">
                            {convertingId === q.id ? <Loader2 size={12} className="animate-spin" /> : 'Convert'}
                          </button>
                        )}
                        {q.status !== 'converted' && (
                          <>
                            <button onClick={() => openEditModal(q)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Edit quote">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { setDeleteTarget(q); setDeleteError(null); }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Delete quote">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Quote' : 'New Quote'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  <option value="">Select a customer...</option>
                  {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quote Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as QuoteStatus })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  {(['draft','sent','accepted','declined','expired'] as QuoteStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Subtotal (₦)</label>
                  <input type="number" step="0.01" value={form.subtotal}
                    onChange={e => setForm({ ...form, subtotal: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Discount (₦)</label>
                  <input type="number" step="0.01" value={form.discount}
                    onChange={e => setForm({ ...form, discount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">VAT (₦)</label>
                  <input type="number" step="0.01" value={form.tax}
                    onChange={e => setForm({ ...form, tax: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              {/* Live total preview */}
              <div className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg text-sm">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-slate-900">
                  ₦{previewTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms</label>
                <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Quote</h2>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <span className="font-medium text-slate-700">{deleteTarget.quoteNumber}</span>? This cannot be undone.
            </p>
            {deleteError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{deleteError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

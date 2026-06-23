/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, FileText,
  CheckCircle2, XCircle, Clock, ChevronDown, Copy,
  TrendingDown, MoreVertical, Eye
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Item { id: string; name: string; purchasePrice: number | null; }
interface BillLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  accountId: string | null;
}
interface Bill {
  id: string; billNumber: string; vendorId: string;
  date: string; dueDate: string; status: string;
  subtotal: number; taxAmount: number; total: number;
  amountPaid: number; balanceDue: number; currency: string;
}

const EMPTY_LINE: BillLine = { itemId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 7.5, accountId: null };

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }

function calcLine(l: BillLine) {
  const base = l.quantity * l.unitPrice;
  const tax = Math.round(base * (l.taxRate / 100));
  return { base, tax, total: base + tax };
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  open: 'bg-blue-50 text-blue-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-rose-50 text-rose-700',
  void: 'bg-slate-100 text-slate-400',
};

type FormState = {
  vendorId: string; date: string; dueDate: string;
  currency: string; lines: BillLine[];
};

const today = new Date().toISOString().split('T')[0];
const due30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

const EMPTY_FORM: FormState = {
  vendorId: '', date: today, dueDate: due30, currency: 'NGN',
  lines: [{ ...EMPTY_LINE }],
};

export function BillsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: billsData, isLoading, isError } = useQuery({
    queryKey: ['bills', statusFilter, search],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const r = await api.get('/purchases/bills', { params });
      return r.data;
    },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const bills: Bill[] = billsData?.bills || [];

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/bills', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      closeModal();
      showSuccess('Bill created successfully.');
    },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to create bill.'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bills'] }); showSuccess('Bill approved and posted to ledger.'); setMenuOpen(null); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to approve bill.'),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/void`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bills'] }); setMenuOpen(null); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to void bill.'),
  });

  const dupMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/duplicate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bills'] }); showSuccess('Bill duplicated as draft.'); setMenuOpen(null); },
  });

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }
  function closeModal() { setModalOpen(false); setForm(EMPTY_FORM); setFormError(null); }

  function updateLine(idx: number, field: keyof BillLine, value: any) {
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], [field]: value };
    setForm({ ...form, lines: nl });
  }

  function selectItem(idx: number, itemId: string) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;
    const nl = [...form.lines];
    nl[idx] = { ...nl[idx], itemId, description: item.name, unitPrice: item.purchasePrice ?? 0 };
    setForm({ ...form, lines: nl });
  }

  const totals = useMemo(() => {
    let sub = 0, tax = 0;
    form.lines.forEach(l => { const c = calcLine(l); sub += c.base; tax += c.tax; });
    return { sub, tax, total: sub + tax };
  }, [form.lines]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { setFormError('Please select a vendor.'); return; }
    if (form.lines.some(l => !l.description.trim())) { setFormError('All lines need a description.'); return; }
    createMutation.mutate({
      vendorId: form.vendorId,
      date: form.date,
      dueDate: form.dueDate,
      currency: form.currency,
      lines: form.lines.map(l => ({
        ...l,
        unitPrice: Math.round(l.unitPrice * 100),
      })),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vendor invoices and payables</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} /> New Bill
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills..." className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 w-56" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading bills...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load bills.
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No bills yet</p>
          <p className="text-xs text-slate-400 mt-1">Create your first vendor bill to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">Bill #</th>
                <th className="py-3 px-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Due</th>
                <th className="py-3 px-2 text-left">Status</th>
                <th className="py-3 px-2 text-right">Total</th>
                <th className="py-3 px-2 text-right">Balance Due</th>
                <th className="py-3 pl-2 pr-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.map(b => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs font-medium text-slate-700">{b.billNumber}</td>
                  <td className="py-3 px-2 font-medium text-slate-900">{vendorMap.get(b.vendorId) || '—'}</td>
                  <td className="py-3 px-2 text-slate-500 text-xs">{fmtDate(b.date)}</td>
                  <td className="py-3 px-2 text-slate-500 text-xs">{fmtDate(b.dueDate)}</td>
                  <td className="py-3 px-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[b.status] || 'bg-slate-100 text-slate-500'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-900">{formatNaira(b.total)}</td>
                  <td className="py-3 px-2 text-right font-mono text-slate-700">{formatNaira(b.balanceDue)}</td>
                  <td className="py-3 pl-2 pr-4 relative">
                    <button onClick={() => setMenuOpen(menuOpen === b.id ? null : b.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreVertical size={14} />
                    </button>
                    {menuOpen === b.id && (
                      <div className="absolute right-4 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg text-xs w-40 py-1">
                        {b.status === 'draft' && (
                          <button onClick={() => approveMutation.mutate(b.id)} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700">
                            <CheckCircle2 size={12} /> Approve & Post
                          </button>
                        )}
                        <button onClick={() => dupMutation.mutate(b.id)} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700">
                          <Copy size={12} /> Duplicate
                        </button>
                        {b.status !== 'void' && b.amountPaid === 0 && (
                          <button onClick={() => { if (confirm('Void this bill?')) voidMutation.mutate(b.id); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600">
                            <XCircle size={12} /> Void
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Bill Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">New Bill</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Bill Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">Line Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <th className="py-2.5 pl-3 pr-2 text-left w-44">Item</th>
                        <th className="py-2.5 px-2 text-left">Description</th>
                        <th className="py-2.5 px-2 text-center w-14">Qty</th>
                        <th className="py-2.5 px-2 text-right w-32">Unit Price (₦)</th>
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
                              <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(idx, e.target.value) : updateLine(idx, 'itemId', null)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none bg-white">
                                <option value="">— Custom —</option>
                                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-2">
                              <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="1" value={line.quantity} onChange={e => updateLine(idx, 'quantity', parseFloat(e.target.value) || 1)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" step="0.01" value={line.unitPrice || ''} onChange={e => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-right focus:outline-none" />
                            </td>
                            <td className="py-2 px-2">
                              <input type="number" min="0" max="100" step="0.1" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded text-center focus:outline-none" />
                            </td>
                            <td className="py-2 px-2 text-right text-xs font-mono font-medium text-slate-900">
                              ₦{(c.total).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
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
                  </table>
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={() => setForm({ ...form, lines: [...form.lines, { ...EMPTY_LINE }] })} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                      <Plus size={13} /> Add Line
                    </button>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-64">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span><span className="font-mono">₦{totals.sub.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>VAT</span><span className="font-mono">₦{totals.tax.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-800">Total</span>
                    <span className="font-black text-slate-900 font-mono">₦{totals.total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Save as Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

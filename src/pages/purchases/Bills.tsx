/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, FileText,
  CheckCircle2, Download, Ban, ChevronDown, ChevronUp
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; }
interface BillLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  accountId: string | null;
}
interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes: string | null;
}

const EMPTY_LINE: BillLine = { itemId: null, description: '', quantity: 1, unitPrice: 0, taxRate: 7.5, accountId: null };
const today = new Date().toISOString().split('T')[0];
const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

function formatNaira(kobo: number) {
  return `\u20a6${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function calcLine(l: BillLine) {
  const base = l.quantity * l.unitPrice;
  const tax = Math.round(base * (l.taxRate / 100));
  return { base, tax, total: base + tax };
}

function exportBillsCSV(bills: Bill[], vendorMap: Map<string, string>) {
  const headers = ['Bill #', 'Vendor', 'Date', 'Due Date', 'Status', 'Total', 'Paid', 'Balance Due'];
  const rows = bills.map(b => [
    b.billNumber, vendorMap.get(b.vendorId) || '', fmtDate(b.date), fmtDate(b.dueDate),
    b.status, (b.total / 100).toFixed(2), (b.amountPaid / 100).toFixed(2), (b.balanceDue / 100).toFixed(2)
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bills-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  open: 'bg-blue-50 text-blue-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
  void: 'bg-slate-100 text-slate-400',
};

export function BillsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendorId: '', date: today, dueDate: thirtyDaysOut, notes: '', currency: 'NGN',
    lines: [{ ...EMPTY_LINE }] as BillLine[],
  });
  const [formError, setFormError] = useState('');

  const { data: billsRaw, isLoading, error } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.get('/purchases/bills').then(r => r.data),
  });
  const { data: vendorsRaw } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/purchases/vendors').then(r => r.data),
  });
  const { data: accountsRaw } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accountant/accounts').then(r => r.data),
  });

  const bills: Bill[] = useMemo(() => {
    const arr = Array.isArray(billsRaw) ? billsRaw : (billsRaw?.bills || billsRaw?.data || []);
    return arr;
  }, [billsRaw]);

  const vendors: Vendor[] = useMemo(() =>
    Array.isArray(vendorsRaw) ? vendorsRaw : (vendorsRaw?.vendors || vendorsRaw?.data || []),
    [vendorsRaw]);
  const accounts: Account[] = useMemo(() =>
    Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw?.accounts || accountsRaw?.data || []),
    [accountsRaw]);

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);

  const filtered = useMemo(() => bills.filter(b => {
    const vendorName = vendorMap.get(b.vendorId) || '';
    const matchesSearch = !search
      || b.billNumber.toLowerCase().includes(search.toLowerCase())
      || vendorName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [bills, search, statusFilter, vendorMap]);

  const totals = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((s, b) => s + b.total, 0),
    paid: filtered.reduce((s, b) => s + b.amountPaid, 0),
    outstanding: filtered.reduce((s, b) => s + b.balanceDue, 0),
    overdue: filtered.filter(b => b.status === 'overdue').reduce((s, b) => s + b.balanceDue, 0),
  }), [filtered]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/purchases/bills', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.message || 'Failed to create bill'),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/approve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/void`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });

  function openCreate() {
    setForm({ vendorId: vendors[0]?.id || '', date: today, dueDate: thirtyDaysOut, notes: '', currency: 'NGN', lines: [{ ...EMPTY_LINE }] });
    setFormError('');
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setFormError(''); }
  function addLine() { setForm(f => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] })); }
  function removeLine(i: number) { setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) })); }
  function setLine(i: number, patch: Partial<BillLine>) {
    setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  }

  const subtotal = form.lines.reduce((s, l) => s + calcLine(l).base, 0);
  const taxTotal = form.lines.reduce((s, l) => s + calcLine(l).tax, 0);
  const grandTotal = subtotal + taxTotal;

  function handleSubmit() {
    setFormError('');
    if (!form.vendorId) return setFormError('Please select a vendor.');
    if (!form.date || !form.dueDate) return setFormError('Date and due date are required.');
    const validLines = form.lines.filter(l => l.description || l.unitPrice > 0);
    if (validLines.length === 0) return setFormError('Add at least one line item.');
    createMutation.mutate({
      vendorId: form.vendorId,
      date: new Date(form.date).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      currency: form.currency,
      notes: form.notes || null,
      lines: validLines.map(l => ({
        itemId: l.itemId || null,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Math.round(Number(l.unitPrice) * 100),
        taxRate: Number(l.taxRate),
        accountId: l.accountId || null,
      })),
    });
  }

  const expenseAccounts = accounts.filter(a => ['expense', 'cost_of_goods'].includes(a.type));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and pay supplier bills</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportBillsCSV(filtered, vendorMap)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={15} /> CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors">
            <Plus size={16} /> New Bill
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Bills', value: formatNaira(totals.total), sub: `${totals.count} bills` },
          { label: 'Amount Paid', value: formatNaira(totals.paid), sub: 'settled', color: 'text-green-600' },
          { label: 'Outstanding', value: formatNaira(totals.outstanding), sub: 'balance due', color: 'text-blue-600' },
          { label: 'Overdue', value: formatNaira(totals.overdue), sub: 'past due', color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-lg font-bold mt-1 ${card.color || 'text-slate-900'}`}>{card.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bills or vendor..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Table / States */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl gap-3">
          <Loader2 size={20} className="animate-spin" /> Loading bills...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16 text-red-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load bills
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <FileText size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">{search || statusFilter !== 'all' ? 'No matching bills' : 'No bills yet'}</p>
          {!search && statusFilter === 'all' && <p className="text-xs text-slate-400 mt-1">Record supplier bills to track what you owe</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-3 text-left">Bill #</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(bill => (
                  <React.Fragment key={bill.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        <button
                          onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          {expandedId === bill.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          {bill.billNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{vendorMap.get(bill.vendorId) || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(bill.date)}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(bill.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[bill.status] || 'bg-slate-100 text-slate-600'}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatNaira(bill.total)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatNaira(bill.balanceDue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {bill.status === 'draft' && (
                            <button
                              onClick={() => approveMutation.mutate(bill.id)}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} /> Approve
                            </button>
                          )}
                          {['open', 'draft', 'partial'].includes(bill.status) && (
                            <button
                              onClick={() => { if (window.confirm('Void this bill?')) voidMutation.mutate(bill.id); }}
                              disabled={voidMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-50"
                            >
                              <Ban size={12} /> Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === bill.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div><span className="text-slate-400 uppercase font-semibold tracking-wide">Subtotal</span><p className="font-semibold mt-1">{formatNaira(bill.subtotal)}</p></div>
                            <div><span className="text-slate-400 uppercase font-semibold tracking-wide">Tax</span><p className="font-semibold mt-1">{formatNaira(bill.taxAmount)}</p></div>
                            <div><span className="text-slate-400 uppercase font-semibold tracking-wide">Amount Paid</span><p className="font-semibold mt-1 text-green-600">{formatNaira(bill.amountPaid)}</p></div>
                            <div><span className="text-slate-400 uppercase font-semibold tracking-wide">Currency</span><p className="font-semibold mt-1">{bill.currency}</p></div>
                          </div>
                          {bill.notes && <p className="mt-3 text-xs text-slate-500 italic">Notes: {bill.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-sm">
                  <td colSpan={5} className="px-4 py-3 text-slate-600">Totals ({filtered.length} bills)</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatNaira(totals.total)}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{formatNaira(totals.outstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Create Bill Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">New Bill</h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor *</label>
                  <select
                    value={form.vendorId}
                    onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bill Date *</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date *</label>
                  <input type="date" value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Line Items</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left w-16">Qty</th>
                          <th className="px-3 py-2 text-left w-28">Unit Price</th>
                          <th className="px-3 py-2 text-left w-16">Tax %</th>
                          <th className="px-3 py-2 text-left">Account</th>
                          <th className="px-3 py-2 text-right w-24">Total</th>
                          <th className="px-2 py-2 w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {form.lines.map((line, i) => {
                          const { total: lineTotal } = calcLine(line);
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2">
                                <input value={line.description} onChange={e => setLine(i, { description: e.target.value })}
                                  placeholder="Description"
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" value={line.quantity}
                                  onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                                  className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="0.01" value={line.unitPrice}
                                  onChange={e => setLine(i, { unitPrice: Number(e.target.value) })}
                                  className="w-24 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" max="100" value={line.taxRate}
                                  onChange={e => setLine(i, { taxRate: Number(e.target.value) })}
                                  className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <select value={line.accountId || ''} onChange={e => setLine(i, { accountId: e.target.value || null })}
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary">
                                  <option value="">No account</option>
                                  {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">
                                {(lineTotal / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-2 py-2">
                                {form.lines.length > 1 && (
                                  <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <X size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={addLine} className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1">
                      <Plus size={13} /> Add Line
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes + Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Optional notes..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm self-start">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-medium">{(subtotal / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Tax</span><span className="font-medium">{(taxTotal / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200"><span>Total</span><span>{(grandTotal / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={createMutation.isPending}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Save Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BillsPage;

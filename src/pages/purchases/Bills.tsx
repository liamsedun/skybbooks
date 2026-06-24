/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, FileText,
  CheckCircle2, Download, Ban, ChevronDown, ChevronUp,
  Pencil, Trash2, Copy, Upload, Package
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; }
interface Item { id: string; name: string; purchasePrice: number | null; }
interface BillLine {
  itemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number; // naira in form, kobo in DB
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
  const tax = base * (l.taxRate / 100);
  return { base, tax, total: base + tax };
}
function toISO(dateStr: string) {
  return new Date(dateStr).toISOString();
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
  a.href = url; a.download = `bills-${today}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLES: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-600',
  open:    'bg-blue-50 text-blue-700',
  partial: 'bg-amber-50 text-amber-700',
  paid:    'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700',
  void:    'bg-slate-100 text-slate-400',
};

type ModalMode = 'create' | 'edit';

interface FormState {
  vendorId: string;
  date: string;
  dueDate: string;
  notes: string;
  currency: string;
  lines: BillLine[];
}

const EMPTY_FORM: FormState = {
  vendorId: '', date: today, dueDate: thirtyDaysOut, notes: '', currency: 'NGN',
  lines: [{ ...EMPTY_LINE }],
};

export function BillsPage() {
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [modalMode, setModalMode]     = useState<ModalMode | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [form, setForm]               = useState<FormState>({ ...EMPTY_FORM });
  const [formError, setFormError]     = useState('');
  const [importOpen, setImportOpen]   = useState(false);
  // ── Queries ──────────────────────────────────────────────────────────────
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

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  // New item inline creation
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const createItemMutation = useMutation({
    mutationFn: (data: any) => api.post('/inventory/items', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); setShowNewItem(false); setNewItemName(''); setNewItemPrice(''); },
  });

  const bills: Bill[]     = useMemo(() => Array.isArray(billsRaw) ? billsRaw : (billsRaw?.bills || billsRaw?.data || []), [billsRaw]);
  const vendors: Vendor[] = useMemo(() => Array.isArray(vendorsRaw) ? vendorsRaw : (vendorsRaw?.vendors || vendorsRaw?.data || []), [vendorsRaw]);
  const accounts: Account[] = useMemo(() => Array.isArray(accountsRaw) ? accountsRaw : (accountsRaw?.accounts || accountsRaw?.data || []), [accountsRaw]);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const expenseAccounts = useMemo(() => accounts.filter(a => ['expense', 'cost_of_goods'].includes(a.type)), [accounts]);

  const filtered = useMemo(() => bills.filter(b => {
    const vendorName = vendorMap.get(b.vendorId) || '';
    const matchSearch = !search || b.billNumber.toLowerCase().includes(search.toLowerCase()) || vendorName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  }), [bills, search, statusFilter, vendorMap]);

  const totals = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((s, b) => s + b.total, 0),
    paid: filtered.reduce((s, b) => s + b.amountPaid, 0),
    outstanding: filtered.reduce((s, b) => s + b.balanceDue, 0),
    overdue: filtered.filter(b => b.status === 'overdue').reduce((s, b) => s + b.balanceDue, 0),
  }), [filtered]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/purchases/bills', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.message || 'Failed to create bill'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/purchases/bills/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.message || 'Failed to update bill'),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/approve`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to approve bill'),
  });
  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/void`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to void bill'),
  });
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/duplicate`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to duplicate bill'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/bills/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to delete bill'),
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openCreate() {
    setEditingBill(null);
    setForm({ ...EMPTY_FORM, vendorId: vendors[0]?.id || '' });
    setFormError('');
    setModalMode('create');
  }

  async function openEdit(bill: Bill) {
    setFormError('');
    setEditingBill(bill);
    // Fetch the bill with its lines
    try {
      const res = await api.get(`/purchases/bills/${bill.id}`);
      const full = res.data;
      const lines: BillLine[] = (full.lines || []).map((l: any) => ({
        itemId: l.itemId || null,
        description: l.description || '',
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) / 100, // kobo → naira for display
        taxRate: Number(l.taxRate ?? 7.5),
        accountId: l.accountId || null,
      }));
      setForm({
        vendorId: bill.vendorId,
        date: bill.date ? bill.date.split('T')[0] : today,
        dueDate: bill.dueDate ? bill.dueDate.split('T')[0] : thirtyDaysOut,
        notes: bill.notes || '',
        currency: bill.currency || 'NGN',
        lines: lines.length > 0 ? lines : [{ ...EMPTY_LINE }],
      });
      setModalMode('edit');
    } catch {
      alert('Could not load bill details. Please try again.');
    }
  }

  function closeModal() { setModalMode(null); setEditingBill(null); setFormError(''); }

  // ── Line helpers ──────────────────────────────────────────────────────────
  function selectItem(idx: number, itemId: string) {
    const item = items.find(it => it.id === itemId);
    if (!item) return;
    setLine(idx, { itemId, description: item.name, unitPrice: item.purchasePrice ?? 0 });
  }
  function addLine() { setForm(f => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] })); }
  function removeLine(i: number) { setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) })); }
  function setLine(i: number, patch: Partial<BillLine>) {
    setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  }

  // ── Live totals (form) ────────────────────────────────────────────────────
  const subtotal  = form.lines.reduce((s, l) => s + calcLine(l).base, 0);
  const taxTotal  = form.lines.reduce((s, l) => s + calcLine(l).tax, 0);
  const grandTotal = subtotal + taxTotal;

  // ── Submit bill (create or edit) ──────────────────────────────────────────
  function handleSubmit() {
    setFormError('');
    if (!form.vendorId) return setFormError('Please select a vendor.');
    if (!form.date || !form.dueDate) return setFormError('Date and due date are required.');
    const validLines = form.lines.filter(l => l.description || l.unitPrice > 0);
    if (validLines.length === 0) return setFormError('Add at least one line item.');

    const payload = {
      vendorId: form.vendorId,
      date: toISO(form.date),
      dueDate: toISO(form.dueDate),
      currency: form.currency,
      notes: form.notes || null,
      lines: validLines.map(l => ({
        itemId: l.itemId || null,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Math.round(Number(l.unitPrice) * 100), // naira → kobo
        taxRate: Number(l.taxRate),
        accountId: l.accountId || null,
      })),
    };

    if (modalMode === 'edit' && editingBill) {
      updateMutation.mutate({ id: editingBill.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and pay supplier bills</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportBillsCSV(filtered, vendorMap)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={15} /> CSV
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={15} /> Import CSV
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors">
            <Plus size={16} /> New Bill
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Bills',    value: formatNaira(totals.total),       sub: `${totals.count} bills` },
          { label: 'Amount Paid',    value: formatNaira(totals.paid),        sub: 'settled',      color: 'text-green-600' },
          { label: 'Outstanding',    value: formatNaira(totals.outstanding), sub: 'balance due',  color: 'text-blue-600' },
          { label: 'Overdue',        value: formatNaira(totals.overdue),     sub: 'past due',     color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-lg font-bold mt-1 ${card.color || 'text-slate-900'}`}>{card.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bills or vendor..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-700">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin" /> Loading bills...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16 gap-2 text-red-500 bg-white border border-slate-200 rounded-xl">
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
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-4 py-3 text-left">Bill #</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center min-w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(bill => (
                  <React.Fragment key={bill.id}>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      {/* Bill number + expand */}
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        <button onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                          className="flex items-center gap-1 hover:text-primary transition-colors">
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

                      {/* ── Action buttons ── */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">

                          {/* Edit — all except paid and void */}
                          {!['paid', 'void'].includes(bill.status) && (
                            <button onClick={() => openEdit(bill)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors"
                              title="Edit bill">
                              <Pencil size={12} /> Edit
                            </button>
                          )}

                          {/* Approve — only on draft */}
                          {bill.status === 'draft' && (
                            <button onClick={() => approveMutation.mutate(bill.id)}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors disabled:opacity-50"
                              title="Approve bill">
                              <CheckCircle2 size={12} /> Approve
                            </button>
                          )}

                          {/* Duplicate — always */}
                          <button onClick={() => { if (window.confirm('Duplicate this bill as a new draft?')) duplicateMutation.mutate(bill.id); }}
                            disabled={duplicateMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
                            title="Duplicate bill">
                            <Copy size={12} /> Copy
                          </button>

                          {/* Void — draft, open, partial */}
                          {['draft', 'open', 'partial', 'overdue'].includes(bill.status) && (
                            <button onClick={() => { if (window.confirm('Void this bill? This cannot be undone.')) voidMutation.mutate(bill.id); }}
                              disabled={voidMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-md transition-colors disabled:opacity-50"
                              title="Void bill">
                              <Ban size={12} /> Void
                            </button>
                          )}

                          {/* Delete — only draft bills */}
                          {bill.status === 'draft' && (
                            <button onClick={() => { if (window.confirm('Permanently delete this draft bill?')) deleteMutation.mutate(bill.id); }}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors disabled:opacity-50"
                              title="Delete bill">
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === bill.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-slate-50/80 border-b border-slate-100">
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

      {/* =========================================================== */}
      {/* CREATE / EDIT BILL MODAL                                     */}
      {/* =========================================================== */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === 'edit' ? `Edit ${editingBill?.billNumber}` : 'New Bill'}
              </h2>
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
                  <select value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bill Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>

              {/* Line items */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Line Items</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                          <th className="px-3 py-2 text-left w-44">Item</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left w-16">Qty</th>
                          <th className="px-3 py-2 text-left w-28">Unit Price (₦)</th>
                          <th className="px-3 py-2 text-left w-16">Tax %</th>
                          <th className="px-3 py-2 text-left">Account</th>
                          <th className="px-3 py-2 text-right w-28">Total (₦)</th>
                          <th className="px-2 py-2 w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {form.lines.map((line, i) => {
                          const { total: lineTotal } = calcLine(line);
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2">
                                <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(i, e.target.value) : setLine(i, { itemId: null })}
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary bg-white">
                                  <option value="">— Custom —</option>
                                  {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                                </select>
                                <button type="button" onClick={() => { setShowNewItem(true); }}
                                  className="mt-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                                  <Plus size={10} /> New Item
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <input value={line.description} onChange={e => setLine(i, { description: e.target.value })}
                                  placeholder="Description"
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="1" value={line.quantity}
                                  onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                                  className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="0.01" value={line.unitPrice}
                                  onChange={e => setLine(i, { unitPrice: Number(e.target.value) })}
                                  className="w-24 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" max="100" step="0.5" value={line.taxRate}
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
                                {lineTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
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
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span className="font-medium">₦{taxTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span>₦{grandTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={isSaving}
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                {modalMode === 'edit' ? 'Save Changes' : 'Save Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV */}
      {importOpen && (
        <CsvImportModal
          entity="bills"
          endpoint="/purchases/bills"
          onClose={() => setImportOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['bills'] })}
          transformRow={(row, headers) => {
            const vendorVal = row[headers.indexOf('vendorId (or name)')]?.trim();
            const vendor = (vendors || []).find(v => v.id === vendorVal || v.name === vendorVal);
            return {
              vendorId: vendor?.id || vendorVal,
              date: row[headers.indexOf('date (YYYY-MM-DD)')] || undefined,
              dueDate: row[headers.indexOf('dueDate')] || undefined,
              currency: row[headers.indexOf('currency')] || 'NGN',
              notes: row[headers.indexOf('notes')] || null,
              lines: [{
                description: row[headers.indexOf('line_description')] || '',
                quantity: parseFloat(row[headers.indexOf('line_quantity')]) || 1,
                unitPrice: Math.round((parseFloat(row[headers.indexOf('line_unitPrice (NGN)')]) || 0) * 100),
                taxRate: parseFloat(row[headers.indexOf('line_taxRate')]) || 0,
              }],
            };
          }}
        />
      )}

      {/* New Item Modal */}
      {showNewItem && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Add New Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Item Name *</label>
                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g. Office Chair"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Price (₦)</label>
                <input type="number" min="0" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button onClick={() => { setShowNewItem(false); setNewItemName(''); setNewItemPrice(''); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => { if (newItemName.trim()) createItemMutation.mutate({ name: newItemName.trim(), purchasePrice: Math.round(parseFloat(newItemPrice || '0') * 100), type: 'inventory' }); }}
                disabled={!newItemName.trim() || createItemMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 flex items-center gap-1">
                {createItemMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Create Item
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default BillsPage;

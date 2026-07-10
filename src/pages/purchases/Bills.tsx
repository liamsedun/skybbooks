/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, printWindow } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, FileText,
  CheckCircle2, Download, Ban, ChevronDown, ChevronUp,
  Pencil, Trash2, Copy, Upload, Package, ArrowLeft, Eye, ExternalLink, Undo2
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { CurrencySelector } from '../../components/ui/CurrencySelector';

interface Vendor { id: string; name: string; }
interface Account { id: string; code: string; name: string; type: string; }
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
  fxRate?: string | number | null;
  notes: string | null;
  vendorName?: string;
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
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
  fxRate: string | null;
  projectId: string;
  lines: BillLine[];
}

const EMPTY_FORM: FormState = {
  vendorId: '', date: today, dueDate: thirtyDaysOut, notes: '', currency: 'NGN', fxRate: '1.00000000', projectId: '',
  lines: [{ ...EMPTY_LINE }],
};

export function BillsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  if (id) return <BillDetail id={id} onBack={() => navigate('/purchases/bills')} />;
  return <BillList />;
}

function BillList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountCode = searchParams.get('account') || '';
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [modalMode, setModalMode]     = useState<ModalMode | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [form, setForm]               = useState<FormState>({ ...EMPTY_FORM });
  const [formError, setFormError]     = useState('');
  const [importOpen, setImportOpen]   = useState(false);
  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: billsRaw, isLoading, error } = useQuery({
    queryKey: ['bills', accountCode],
    queryFn: () => api.get('/purchases/bills', { params: { accountCode: accountCode || undefined } }).then(r => r.data),
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

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
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
  const accountName = useMemo(() => { const a = accounts.find(a => a.code === accountCode); return a?.name || ''; }, [accounts, accountCode]);

  const filtered = useMemo(() => bills.filter(b => {
    const vendorName = vendorMap.get(b.vendorId) || '';
    const matchSearch = !search || b.billNumber.toLowerCase().includes(search.toLowerCase()) || vendorName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    if (!matchSearch || !matchStatus) return false;
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    return true;
  }), [bills, search, statusFilter, dateFrom, dateTo, vendorMap]);

  const totals = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((s, b) => s + b.total, 0),
    paid: filtered.reduce((s, b) => s + b.amountPaid, 0),
    outstanding: filtered.reduce((s, b) => s + b.balanceDue, 0),
    overdue: filtered.filter(b => b.status === 'overdue').reduce((s, b) => s + b.balanceDue, 0),
  }), [filtered]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateBank = () => qc.invalidateQueries({ queryKey: ['bankAccounts'] });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/purchases/bills', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.message || 'Failed to create bill'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/purchases/bills/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); closeModal(); },
    onError: (e: any) => setFormError(e?.response?.data?.message || 'Failed to update bill'),
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to approve bill'),
  });
  const unapproveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/unapprove`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to unapprove bill'),
  });
  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/void`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to void bill'),
  });
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/purchases/bills/${id}/duplicate`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to duplicate bill'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/bills/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
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
        fxRate: bill.fxRate ? String(bill.fxRate) : (bill.currency && bill.currency !== 'NGN' ? null : '1.00000000'),
        projectId: (bill as any).projectId || '',
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
    setLine(idx, { itemId, description: item.name, unitPrice: (item.purchasePrice ?? 0) / 100 });
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
      fxRate: form.fxRate ? parseFloat(form.fxRate) : undefined,
      projectId: form.projectId || undefined,
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
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

      {/* ── Header ── */}
      {accountCode && (
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200/80 rounded-2xl text-sm text-indigo-800 shadow-sm">
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          <span>Showing bills for <strong>{accountName || `Account ${accountCode}`}</strong></span>
          <button onClick={() => navigate('/purchases/bills')} className="ml-auto text-xs font-medium text-indigo-600 hover:text-indigo-800 underline">Clear filter</button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bills</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and pay supplier bills</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
              try {
                const rows = filtered.map((b: any) =>
                  `<tr><td>${b.billNumber||''}</td><td>${vendorMap.get(b.vendorId)||''}</td><td>${new Date(b.date).toLocaleDateString('en-GB')}</td><td>${new Date(b.dueDate).toLocaleDateString('en-GB')}</td><td class="c">${b.status||''}</td><td class="r">₦${(b.total/100).toLocaleString()}</td><td class="r">₦${(b.amountPaid/100).toLocaleString()}</td><td class="r">₦${(b.balanceDue/100).toLocaleString()}</td></tr>`
                ).join('');
                printWindow('Bills', `<table><thead><tr><th>Bill #</th><th>Vendor</th><th>Date</th><th>Due Date</th><th class="c">Status</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>${rows}</tbody></table>`, `${filtered.length} bills`);
              } catch (err) {
                alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
                console.error('Print error:', err);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => exportBillsCSV(filtered, vendorMap)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Plus size={14} /> New Bill
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setSearch(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-left cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Bills</p>
          <p className="text-lg font-bold mt-1 text-slate-900">{formatNaira(totals.total)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{totals.count} bills</p>
        </button>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('paid'); setSearch(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-left cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amount Paid</p>
          <p className="text-lg font-bold mt-1 text-green-600">{formatNaira(totals.paid)}</p>
          <p className="text-xs text-slate-400 mt-0.5">settled</p>
        </button>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('open'); setSearch(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-left cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Outstanding</p>
          <p className="text-lg font-bold mt-1 text-blue-600">{formatNaira(totals.outstanding)}</p>
          <p className="text-xs text-slate-400 mt-0.5">balance due</p>
        </button>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('overdue'); setSearch(''); }} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 text-left cursor-pointer hover:border-red-300 hover:shadow-md transition-all duration-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Overdue</p>
          <p className="text-lg font-bold mt-1 text-red-600">{formatNaira(totals.overdue)}</p>
          <p className="text-xs text-slate-400 mt-0.5">past due</p>
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search bills or vendor..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white text-slate-700">
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
        <span className="text-xs text-slate-400 font-medium self-center">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white" />
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400 bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl">
          <Loader2 size={20} className="animate-spin" /> Loading bills...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16 gap-2 text-red-500 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <AlertCircle size={18} /> Failed to load bills
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <FileText size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">{search || statusFilter !== 'all' ? 'No matching bills' : 'No bills yet'}</p>
          {!search && statusFilter === 'all' && <p className="text-xs text-slate-400 mt-1">Record supplier bills to track what you owe</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-3 py-3 text-left">Bill #</th>
                  <th className="px-3 py-3 text-left">Vendor</th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-left">Due Date</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-right">Balance Due</th>
                  <th className="px-3 py-3 text-center min-w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(bill => (
                  <React.Fragment key={bill.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      {/* Bill number + expand */}
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
                            className="flex items-center gap-1 hover:text-primary transition-colors">
                            {expandedId === bill.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                          <button onClick={() => navigate(`/purchases/bills/${bill.id}`)}
                            className="hover:text-primary transition-colors">
                            {bill.billNumber}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{vendorMap.get(bill.vendorId) || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(bill.date)}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(bill.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[bill.status] || 'bg-slate-100 text-slate-600 border-slate-100/50'}`}>
                          {bill.status}
                        </span>
                        <div className="mt-1">
                          {bill.journalEntryId ? (
                            <button
                              onClick={() => navigate(`/accountant/journals?entry=${bill.journalEntryNumber || ''}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-100/50 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all duration-200"
                            ><CheckCircle2 className="w-3 h-3" /> Posted</button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-100/50 bg-slate-100 text-slate-500">Not posted</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">{formatNaira(bill.total)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatNaira(bill.balanceDue)}</td>

                      {/* ── Action buttons ── */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">

                          {/* View — always */}
                          <button onClick={() => navigate(`/purchases/bills/${bill.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all duration-200"
                            title="View bill details">
                            <Eye size={12} /> View
                          </button>

                          {/* Edit — all except paid and void */}
                          {!['paid', 'void'].includes(bill.status) && (
                            <button onClick={() => openEdit(bill)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all duration-200"
                              title="Edit bill">
                              <Pencil size={12} /> Edit
                            </button>
                          )}

                          {/* Approve — only on draft */}
                          {bill.status === 'draft' && (
                            <button onClick={() => approveMutation.mutate(bill.id)}
                              disabled={approveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                              title="Approve bill">
                              <CheckCircle2 size={12} /> Approve
                            </button>
                          )}

                          {/* Unapprove — only on open (approved) bills */}
                          {bill.status === 'open' && (
                            <button onClick={() => { if (window.confirm('Unapprove this bill? It will revert to draft for editing.')) unapproveMutation.mutate(bill.id); }}
                              disabled={unapproveMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                              title="Unapprove bill">
                              <Undo2 size={12} /> Unapprove
                            </button>
                          )}

                          {/* Duplicate — always */}
                          <button onClick={() => { if (window.confirm('Duplicate this bill as a new draft?')) duplicateMutation.mutate(bill.id); }}
                            disabled={duplicateMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                            title="Duplicate bill">
                            <Copy size={12} /> Copy
                          </button>

                          {/* Void — draft, open, partial */}
                          {['draft', 'open', 'partial', 'overdue'].includes(bill.status) && (
                            <button onClick={() => { if (window.confirm('Void this bill? This cannot be undone.')) voidMutation.mutate(bill.id); }}
                              disabled={voidMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                              title="Void bill">
                              <Ban size={12} /> Void
                            </button>
                          )}

                          {/* Delete — only draft bills */}
                          {bill.status === 'draft' && (
                            <button onClick={() => { if (window.confirm('Permanently delete this draft bill?')) deleteMutation.mutate(bill.id); }}
                              disabled={deleteMutation.isPending}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all duration-200 disabled:opacity-50"
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
                        <td colSpan={8} className="px-3 py-4 bg-slate-50/80 border-b border-slate-100">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div><span className="text-slate-400 uppercase font-semibold tracking-wide">Subtotal</span><p className="font-semibold mt-1">{formatNaira(bill.subtotal)}</p></div>
                            <div><span className="text-slate-400 uppercase font-semibold tracking-wide">VAT</span><p className="font-semibold mt-1">{formatNaira(bill.taxAmount)}</p></div>
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
                  <td colSpan={5} className="px-3 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Totals ({filtered.length} bills)</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatNaira(totals.total)}</td>
                  <td className="px-3 py-3 text-right text-slate-900">{formatNaira(totals.outstanding)}</td>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === 'edit' ? `Edit ${editingBill?.billNumber}` : 'New Bill'}
              </h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

                <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <CurrencySelector
                    currency={form.currency}
                    onCurrencyChange={c => setForm(f => ({ ...f, currency: c }))}
                    fxRate={form.fxRate}
                    onFxRateChange={r => setForm(f => ({ ...f, fxRate: r }))}
                    date={form.date}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Project</label>
                  <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
                    <option value="">None (no project)</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bill Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
              </div>

              {/* Line items */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Line Items</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="px-3 py-3 text-left w-44">Item</th>
                          <th className="px-3 py-3 text-left">Description</th>
                          <th className="px-3 py-3 text-left w-16">Qty</th>
                          <th className="px-3 py-3 text-left w-28">Unit Price (₦)</th>
                          <th className="px-3 py-3 text-left w-16">VAT %</th>
                          <th className="px-3 py-3 text-left">Account</th>
                          <th className="px-3 py-3 text-right w-28">Total (₦)</th>
                          <th className="px-3 py-3 w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {form.lines.map((line, i) => {
                          const { total: lineTotal } = calcLine(line);
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2">
                                <select value={line.itemId || ''} onChange={e => e.target.value ? selectItem(i, e.target.value) : setLine(i, { itemId: null })}
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
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
                                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="1" value={line.quantity}
                                  onChange={e => setLine(i, { quantity: Number(e.target.value) })}
                                  className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" step="0.01" value={line.unitPrice}
                                  onChange={e => setLine(i, { unitPrice: Number(e.target.value) })}
                                  className="w-24 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" min="0" max="100" step="0.5" value={line.taxRate}
                                  onChange={e => setLine(i, { taxRate: Number(e.target.value) })}
                                  className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                              </td>
                              <td className="px-3 py-2">
                                <AccountSearchSelect
                                  accounts={expenseAccounts}
                                  value={line.accountId || ''}
                                  onChange={id => setLine(i, { accountId: id || null })}
                                  placeholder="No account"
                                  searchPlaceholder="Search expense accounts..."
                                />
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
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2 text-sm self-start">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VAT</span>
                    <span className="font-medium">₦{taxTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total</span>
                    <span>₦{grandTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/80 bg-slate-50 rounded-b-2xl">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-all duration-200">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={isSaving}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-60 flex items-center gap-2">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Add New Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Item Name *</label>
                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g. Office Chair"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Price (₦)</label>
                <input type="number" min="0" step="0.01" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-200/80">
                <button onClick={() => { setShowNewItem(false); setNewItemName(''); setNewItemPrice(''); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button onClick={() => { if (newItemName.trim()) createItemMutation.mutate({ name: newItemName.trim(), purchasePrice: Math.round(parseFloat(newItemPrice || '0') * 100), type: 'inventory' }); }}
                  disabled={!newItemName.trim() || createItemMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-1 transition-all duration-200">
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

interface DetailBill extends Bill {
  vendor?: Vendor;
  lines?: (BillLine & { id: string })[];
}

function BillDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: billRaw, isLoading, error } = useQuery({
    queryKey: ['bill', id],
    queryFn: () => api.get(`/purchases/bills/${id}`).then(r => r.data),
  });

  const { data: org } = useQuery<any>({
    queryKey: ['org'],
    queryFn: async () => { const r = await api.get('/org'); return r.data; },
    staleTime: 60000,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: async () => { const r = await api.get('/inventory/items'); return r.data; },
  });

  const invalidateBank = () => qc.invalidateQueries({ queryKey: ['bankAccounts'] });

  const voidMutation = useMutation({
    mutationFn: (bid: string) => api.post(`/purchases/bills/${bid}/void`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bill', id] }); qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to void bill'),
  });
  const approveMutation = useMutation({
    mutationFn: (bid: string) => api.post(`/purchases/bills/${bid}/approve`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bill', id] }); qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to approve bill'),
  });
  const unapproveMutation = useMutation({
    mutationFn: (bid: string) => api.post(`/purchases/bills/${bid}/unapprove`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bill', id] }); qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to unapprove bill'),
  });
  const duplicateMutation = useMutation({
    mutationFn: (bid: string) => api.post(`/purchases/bills/${bid}/duplicate`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); navigate('/purchases/bills'); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to duplicate bill'),
  });
  const deleteMutation = useMutation({
    mutationFn: (bid: string) => api.delete(`/purchases/bills/${bid}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); invalidateBank(); navigate('/purchases/bills'); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to delete bill'),
  });

  const bill = billRaw as DetailBill | undefined;
  const vendorName = bill?.vendor?.name || 'Unknown Vendor';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-400 max-w-7xl mx-auto px-6 py-6">
        <Loader2 size={20} className="animate-spin" /> Loading bill...
      </div>
    );
  }
  if (error || !bill) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-red-500 max-w-7xl mx-auto px-6 py-6">
        <AlertCircle size={18} /> Failed to load bill
        <button onClick={onBack} className="ml-4 text-sm text-primary hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-all duration-200">
            <ArrowLeft size={18} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{bill.billNumber}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{vendorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[bill.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {bill.status}
          </span>
          <button onClick={() => {
              try {
                const lines = (bill.lines || []).map((l: any) => {
                  const base = l.quantity * l.unitPrice;
                  const tax = base * (l.taxRate / 100);
                  return `<tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;font-weight:500">${l.description||'—'}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;text-align:right">${l.quantity}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;text-align:right;font-family:monospace">₦${(l.unitPrice/100).toLocaleString('en-NG',{minimumFractionDigits:2})}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;text-align:right;font-family:monospace">₦${(Math.round(base)/100).toLocaleString('en-NG',{minimumFractionDigits:2})}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;text-align:right">${l.taxRate}%</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#0f172a;text-align:right;font-family:monospace;font-weight:700">₦${(Math.round(base+tax)/100).toLocaleString('en-NG',{minimumFractionDigits:2})}</td>
                  </tr>`;
                }).join('');
                const logoHtml = org?.logoUrl
                  ? `<img src="${org.logoUrl}" alt="${org?.name||'Logo'}" style="width:56px;height:56px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0;background:white;padding:4px"/>`
                  : `<div style="width:56px;height:56px;border-radius:10px;background:#4f46e5;display:flex;align-items:center;justify-content:center;color:white;font-size:26px;font-weight:bold">${(org?.name||'S')[0].toUpperCase()}</div>`;
                const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill ${bill.billNumber}</title>
                <style>
                  *{margin:0;padding:0;box-sizing:border-box}
                  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;padding:40px;font-size:13px}
                  @media print{body{padding:20px}}
                </style></head><body>
                  <div style="height:4px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#818cf8);border-radius:2px;margin-bottom:32px"></div>
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px">
                    <div style="display:flex;align-items:flex-start;gap:14px">
                      ${logoHtml}
                      <div>
                        <h2 style="font-size:16px;font-weight:bold;color:#0f172a;margin:0">${org?.name||'Your Company'}</h2>
                        ${org?.address ? `<p style="font-size:11px;color:#64748b;margin:3px 0">${org.address}</p>` : ''}
                        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px">
                          ${org?.phone ? `<span style="font-size:10px;color:#64748b">${org.phone}</span>` : ''}
                          ${org?.email ? `<span style="font-size:10px;color:#64748b">${org.email}</span>` : ''}
                          ${org?.website ? `<span style="font-size:10px;color:#4f46e5">${org.website}</span>` : ''}
                        </div>
                        ${(org?.rcNumber||org?.vatNumber) ? `<div style="display:flex;gap:14px;margin-top:3px">${org?.rcNumber?`<span style="font-size:9px;color:#94a3b8">RC: ${org.rcNumber}</span>`:''}${org?.vatNumber?`<span style="font-size:9px;color:#94a3b8">VAT: ${org.vatNumber}</span>`:''}</div>` : ''}
                      </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                      <p style="font-size:11px;font-weight:600;color:#4f46e5;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 6px 0">Bill</p>
                      <p style="font-size:24px;font-weight:bold;color:#0f172a;margin:0;letter-spacing:-0.02em">${bill.billNumber}</p>
                      <span style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;text-transform:capitalize;background:${bill.status==='open'?'#e0e7ff':bill.status==='paid'?'#dcfce7':bill.status==='overdue'?'#fee2e2':bill.status==='draft'?'#f1f5f9':'#f8fafc'};color:${bill.status==='open'?'#4338ca':bill.status==='paid'?'#166534':bill.status==='overdue'?'#dc2626':bill.status==='draft'?'#64748b':'#94a3b8'}">${bill.status}</span>
                    </div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:20px 24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px">
                    <div>
                      <p style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px 0">Vendor</p>
                      <p style="font-size:14px;font-weight:bold;color:#0f172a;margin:0">${vendorName}</p>
                      ${bill.vendor?.email ? `<p style="font-size:11px;color:#64748b;margin:2px 0">${bill.vendor.email}</p>` : ''}
                      ${bill.vendor?.phone ? `<p style="font-size:11px;color:#64748b;margin:2px 0">${bill.vendor.phone}</p>` : ''}
                    </div>
                    <div style="text-align:right">
                      <p style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px 0">Bill Info</p>
                      <div style="display:flex;justify-content:flex-end;gap:16px;font-size:11px;margin:2px 0">
                        <span style="color:#94a3b8">Date</span>
                        <span style="font-weight:500;color:#334155">${fmtDate(bill.date)}</span>
                      </div>
                      <div style="display:flex;justify-content:flex-end;gap:16px;font-size:11px;margin:2px 0">
                        <span style="color:#94a3b8">Due Date</span>
                        <span style="font-weight:500;color:#334155">${fmtDate(bill.dueDate)}</span>
                      </div>
                      <div style="display:flex;justify-content:flex-end;gap:16px;font-size:11px;margin:2px 0">
                        <span style="color:#94a3b8">Currency</span>
                        <span style="font-weight:500;color:#334155">${bill.currency||'NGN'}</span>
                      </div>
                    </div>
                  </div>
                  <table style="width:100%;border-collapse:collapse">
                    <thead>
                      <tr style="background:#0f172a">
                        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Description</th>
                        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Qty</th>
                        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Unit Price</th>
                        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Subtotal</th>
                        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">VAT</th>
                        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.06em">Total</th>
                      </tr>
                    </thead>
                    <tbody>${lines||'<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8">No line items</td></tr>'}</tbody>
                  </table>
                  <div style="margin-top:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;padding:16px 20px;max-width:320px;margin-left:auto">
                    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
                      <span style="color:#64748b">Subtotal</span>
                      <span style="font-weight:600;color:#334155;font-family:monospace">${formatNaira(bill.subtotal)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
                      <span style="color:#64748b">VAT</span>
                      <span style="font-weight:600;color:#334155;font-family:monospace">${formatNaira(bill.taxAmount)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-top:1px solid #e2e8f0;margin-top:4px;padding-top:8px">
                      <span style="font-weight:700;color:#0f172a">Total</span>
                      <span style="font-weight:700;color:#0f172a;font-family:monospace">${formatNaira(bill.total)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
                      <span style="color:#16a34a">Amount Paid</span>
                      <span style="font-weight:600;color:#16a34a;font-family:monospace">${formatNaira(bill.amountPaid)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-top:2px solid #0f172a;margin-top:4px;padding-top:8px">
                      <span style="font-weight:700;color:#0f172a">Balance Due</span>
                      <span style="font-weight:800;color:#0f172a;font-family:monospace">${formatNaira(bill.balanceDue)}</span>
                    </div>
                  </div>
                  ${bill.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#92400e"><strong style="font-weight:600">Notes:</strong> ${bill.notes}</div>` : ''}
                  <div style="text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:40px">${org?.name||'SkyBooks'} · This bill was generated electronically. · ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
                </body></html>`;
                const w = window.open('','_blank');
                if(w){w.document.write(fullHtml);w.document.close();setTimeout(()=>w.print(),500);}
              } catch (err) {
                alert('Failed to open print window: ' + (err instanceof Error ? err.message : 'Unknown error'));
                console.error('Print error:', err);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          {bill.status !== 'paid' && bill.status !== 'void' && (
            <button onClick={() => navigate(`/purchases/payments-made?vendor=${bill.vendor?.id || bill.vendorId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all duration-200">
              Make Payment
            </button>
          )}
          {bill.status === 'draft' && (
            <button onClick={() => approveMutation.mutate(bill.id)}
              disabled={approveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-all duration-200 disabled:opacity-50">
              <CheckCircle2 size={14} /> Approve
            </button>
          )}
          {bill.status === 'open' && (
            <button onClick={() => { if (window.confirm('Unapprove this bill? It will revert to draft for editing.')) unapproveMutation.mutate(bill.id); }}
              disabled={unapproveMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all duration-200 disabled:opacity-50">
              <Undo2 size={14} /> Unapprove
            </button>
          )}
          {['draft', 'open', 'partial', 'overdue'].includes(bill.status) && (
            <button onClick={() => { if (window.confirm('Void this bill? This cannot be undone.')) voidMutation.mutate(bill.id); }}
              disabled={voidMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all duration-200 disabled:opacity-50">
              <Ban size={14} /> Void
            </button>
          )}
          <button onClick={() => { if (window.confirm('Duplicate this bill as a new draft?')) duplicateMutation.mutate(bill.id); }}
            disabled={duplicateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all duration-200 disabled:opacity-50">
            <Copy size={14} /> Copy
          </button>
          {bill.status === 'draft' && (
            <button onClick={() => { if (window.confirm('Permanently delete this draft bill?')) deleteMutation.mutate(bill.id); }}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all duration-200 disabled:opacity-50">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
          <p className="text-lg font-bold mt-1 text-slate-900">{formatNaira(bill.total)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Amount Paid</p>
          <p className="text-lg font-bold mt-1 text-green-600">{formatNaira(bill.amountPaid)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Balance Due</p>
          <p className="text-lg font-bold mt-1 text-blue-600">{formatNaira(bill.balanceDue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</p>
          <p className="text-lg font-bold mt-1 text-slate-900">{fmtDate(bill.dueDate)}</p>
        </div>
      </div>

      {/* Bill details + Line Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3 text-sm">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bill Info</h3>
          <div className="space-y-2">
            <div><span className="text-slate-400 text-xs block">Bill Number</span><span className="font-medium">{bill.billNumber}</span></div>
            <div><span className="text-slate-400 text-xs block">Vendor</span><span className="font-medium">{vendorName}</span></div>
            <div><span className="text-slate-400 text-xs block">Date</span><span className="font-medium">{fmtDate(bill.date)}</span></div>
            <div><span className="text-slate-400 text-xs block">Due Date</span><span className="font-medium">{fmtDate(bill.dueDate)}</span></div>
            <div><span className="text-slate-400 text-xs block">Status</span><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[bill.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{bill.status}</span></div>
            <div><span className="text-slate-400 text-xs block">Currency</span><span className="font-medium">{bill.currency}</span></div>
            {bill.notes && <div><span className="text-slate-400 text-xs block">Notes</span><span className="font-medium italic">{bill.notes}</span></div>}
          </div>
        </div>

        {/* Line items table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Line Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-3 py-3 text-left">Item</th>
                  <th className="px-3 py-3 text-left">Description</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Unit Price</th>
                  <th className="px-3 py-3 text-right">VAT %</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(bill.lines || []).map((line, i) => {
                  const base = line.quantity * line.unitPrice;
                  const tax = base * (line.taxRate / 100);
                  const lineTotal = base + tax;
                  return (
                    <tr key={line.id || i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-3 text-slate-700 font-medium">{items.find(it => it.id === line.itemId)?.name || '—'}</td>
                      <td className="px-3 py-3 text-slate-500">{line.description || '—'}</td>
                      <td className="px-3 py-3 text-right text-slate-700 font-medium">{line.quantity}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNaira(line.unitPrice)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{line.taxRate}%</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatNaira(Math.round(lineTotal))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200/80 text-sm font-semibold">
                  <td colSpan={5} className="px-3 py-3 text-slate-600 text-right">Subtotal</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatNaira(bill.subtotal)}</td>
                </tr>
                <tr className="bg-slate-50 text-sm">
                  <td colSpan={5} className="px-3 py-3 text-slate-600 text-right">VAT</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatNaira(bill.taxAmount)}</td>
                </tr>
                <tr className="bg-slate-50 border-t border-slate-200/80 text-sm font-bold">
                  <td colSpan={5} className="px-3 py-3 text-slate-900 text-right">Total</td>
                  <td className="px-3 py-3 text-right text-slate-900">{formatNaira(bill.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillsPage;

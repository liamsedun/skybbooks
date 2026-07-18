/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, orgApi } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, Receipt, Eye,
  CheckCircle2, Trash2, Edit2, Download, FileText, Upload
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';
import { CurrencySelector } from '../../components/ui/CurrencySelector';

interface Vendor { id: string; name: string; }
interface Customer { id: string; name: string; }
interface Account { id: string; name: string; type: string; code: string | null; }
interface Expense {
  id: string; expenseNumber: string; vendorId: string | null;
  date: string; accountId: string; amount: number; taxAmount: number;
  currency: string; fxRate?: string | number | null;
  paymentMethod: string; reference: string | null;
  description: string | null; isBillable: boolean;
  customerId?: string | null;
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
  creditAccountName?: string | null;
}

function formatNaira(kobo: number) {
  return `\u20a6${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}
function fmtDual(cents: number, currency?: string, fxRate?: number | string | null): string {
  const ngn = formatNaira(cents);
  if (!currency || currency === 'NGN' || !fxRate || Number(fxRate) <= 1) return ngn;
  const original = (cents / 100) / Number(fxRate);
  const cur = original.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${cur}  \u2022  ${ngn}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd'];

type FormState = {
  accountId: string; vendorId: string; date: string;
  amount: string; taxAmount: string; paymentMethod: string;
  reference: string; description: string; isBillable: boolean;
  customerId: string;
  paymentAccountId: string; onAccount: boolean;
  currency: string; fxRate: string | null;
  projectId?: string;
};




const EMPTY_FORM: FormState = {
  accountId: '', vendorId: '', date: new Date().toISOString().split('T')[0],
  amount: '', taxAmount: '0', paymentMethod: 'cash',
  reference: '', description: '', isBillable: false,
  customerId: '', paymentAccountId: '', onAccount: false,
  currency: 'NGN', fxRate: '1.00000000', projectId: '',
};

function exportCSV(expenses: Expense[], vendorMap: Map<string,string>, accountMap: Map<string,string>) {
  const headers = ['Ref #','Date','Description','Account','Vendor','Method','Bank/Cash','Amount (₦)','VAT (₦)','Billable'];
  const rows = expenses.map(e => [
    e.expenseNumber,
    fmtDate(e.date),
    e.description || '',
    accountMap.get(e.accountId) || '',
    e.vendorId ? (vendorMap.get(e.vendorId) || '') : '',
    e.paymentMethod?.replace('_',' '),
    e.creditAccountName || '',
    (e.amount / 100).toFixed(2),
    (e.taxAmount / 100).toFixed(2),
    e.isBillable ? 'Yes' : 'No',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportPDF(expenses: Expense[], vendorMap: Map<string,string>, accountMap: Map<string,string>, total: number) {
  const rows = expenses.map(e => `
    <tr>
      <td>${e.expenseNumber}</td>
      <td>${fmtDate(e.date)}</td>
      <td>${e.description || '—'}</td>
      <td>${accountMap.get(e.accountId) || '—'}</td>
      <td>${e.vendorId ? (vendorMap.get(e.vendorId) || '—') : '—'}</td>
      <td>${e.paymentMethod?.replace('_',' ')}</td>
      <td>${e.creditAccountName || '—'}</td>
      <td style="text-align:right">${formatNaira(e.amount)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Expenses Report</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', sans-serif; color:#1e293b; padding:40px; font-size:13px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:2px solid #0f172a; }
    .company { font-size:22px; font-weight:800; color:#0f172a; }
    .subtitle { font-size:11px; color:#64748b; margin-top:4px; }
    .title { font-size:18px; font-weight:700; color:#0f172a; }
    .date { font-size:11px; color:#64748b; margin-top:4px; }
    table { width:100%; border-collapse:collapse; margin-top:16px; }
    th { background:#0f172a; color:#fff; padding:10px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; }
    td { padding:10px 12px; border-bottom:1px solid #e2e8f0; font-size:12px; }
    tr:nth-child(even) td { background:#f8fafc; }
    .total-row td { font-weight:700; background:#f1f5f9; font-size:13px; border-top:2px solid #0f172a; }
    .footer { margin-top:40px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:16px; }
    @media print { body { padding:20px; } }
  </style></head><body>
  <div class="header">
    <div><div class="company">SkyBooks</div><div class="subtitle">By Skyhouse Accountants &amp; Technologies</div></div>
    <div style="text-align:right"><div class="title">Expenses Report</div><div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
  </div>
  <table>
    <thead><tr><th>Ref #</th><th>Date</th><th>Description</th><th>Account</th><th>Vendor</th><th>Method</th><th>Bank/Cash</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td colspan="7"><strong>Total (${expenses.length} records)</strong></td><td style="text-align:right">${formatNaira(total)}</td></tr></tfoot>
  </table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

export function ExpensesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);

  const { data: expenses = [], isLoading, isError } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => { const r = await api.get('/purchases/expenses'); return r.data; },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const { data: org } = useQuery({ queryKey: ['org'], queryFn: orgApi.getOrg, staleTime: 60000 });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
    staleTime: 60000,
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const customersMap = useMemo(() => new Map(customers.map(c => [c.id, c.name])), [customers]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === 'expense'), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'asset'), [accounts]);

  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && expenses.length > 0) {
      const exp = expenses.find(e => e.id === selectedId);
      if (exp) openView(exp);
    }
  }, [searchParams, expenses]);

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return expenses.filter(e => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return !t || (e.description || '').toLowerCase().includes(t) ||
        e.expenseNumber.toLowerCase().includes(t) ||
        (vendorMap.get(e.vendorId || '') || '').toLowerCase().includes(t);
    });
  }, [expenses, search, vendorMap, dateFrom, dateTo]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/expenses', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); closeModal(); showSuccess('Expense recorded.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to save expense.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/purchases/expenses/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); closeModal(); showSuccess('Expense updated.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update expense.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/expenses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); showSuccess('Expense deleted and journal reversed.'); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to delete expense.'),
  });

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }

  function openEdit(exp: Expense) {
    setEditingId(exp.id);
    setForm({
      accountId: exp.accountId,
      vendorId: exp.vendorId || '',
      date: exp.date ? exp.date.split('T')[0] : new Date().toISOString().split('T')[0],
      amount: (exp.amount / 100).toFixed(2),
      taxAmount: (exp.taxAmount / 100).toFixed(2),
      paymentMethod: exp.paymentMethod || 'cash',
      reference: exp.reference || '',
      description: exp.description || '',
      isBillable: exp.isBillable || false,
      customerId: exp.customerId || '',
      paymentAccountId: '',
      onAccount: false,
      currency: exp.currency || 'NGN',
      fxRate: exp.fxRate ? String(exp.fxRate) : (exp.currency && exp.currency !== 'NGN' ? null : '1.00000000'),
    });
    setFormError(null);
    setModalOpen(true);
  }

  function openView(exp: Expense) {
    setViewingExpense(exp);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId) { setFormError('Please select an expense account.'); return; }
    const amtKobo = Math.round(parseFloat(form.amount) * 100);
    const taxKobo = Math.round(parseFloat(form.taxAmount || '0') * 100);
    if (!amtKobo || amtKobo <= 0) { setFormError('Amount must be greater than zero.'); return; }
    const payload = {
      accountId: form.accountId,
      vendorId: form.vendorId || null,
      date: form.date,
      amount: amtKobo,
      taxAmount: taxKobo,
      paymentMethod: form.paymentMethod,
      reference: form.reference || null,
      description: form.description || null,
      isBillable: form.isBillable,
      customerId: form.isBillable ? (form.customerId || null) : null,
      onAccount: form.onAccount,
      paymentAccountId: form.paymentAccountId || null,
      currency: form.currency,
      fxRate: form.fxRate ? parseFloat(form.fxRate) : undefined,
      projectId: form.projectId || undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const totalVat = filtered.reduce((s, e) => s + e.taxAmount, 0);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase">Total Expenses</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatNaira(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase">Recorded</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase">Input VAT</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{formatNaira(totalVat)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase">Net Expense</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatNaira(totalExpenses - totalVat)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(filtered, vendorMap, accountMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportPDF(filtered, vendorMap, accountMap, totalExpenses)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-all duration-200">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-xs font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200">
            <Plus size={14} /> +New
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
        <span className="text-xs text-slate-400 font-medium">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-gradient-to-r from-slate-200 to-slate-100 animate-pulse rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading expenses...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <AlertCircle size={18} /> Failed to load expenses.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <Receipt size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No matching expenses' : 'No expenses yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Record your first expense to track outgoings</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="px-3 py-3 text-left">Ref #</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-left">Account</th>
                <th className="px-3 py-3 text-left">Vendor</th>
    <th className="px-3 py-3 text-left">Method</th>
    <th className="px-3 py-3 text-left">Bank/Cash</th>
    <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3 text-center">Ledger</th>
                <th className="px-3 py-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs text-slate-600">{exp.expenseNumber}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(exp.date)}</td>
                  <td className="py-3 px-2 text-slate-700 max-w-[180px] truncate">{exp.description || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500 max-w-[120px] truncate">{accountMap.get(exp.accountId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{exp.vendorId ? (vendorMap.get(exp.vendorId) || '—') : '—'}</td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-100/50 bg-slate-100 text-slate-600 capitalize">{exp.paymentMethod?.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500 max-w-[140px] truncate">{exp.creditAccountName || '—'}</td>
                  <td className="py-3 px-2 text-right font-mono text-slate-900 font-medium">{formatNaira(exp.amount)}</td>
                  <td className="py-3 px-2">
                    {exp.journalEntryId ? (
                      <button
                        onClick={() => navigate(`/accountant/journals?entry=${exp.journalEntryNumber || ''}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-100/50 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all duration-200"
                      ><CheckCircle2 className="w-3 h-3" /> Posted</button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-100/50 bg-slate-100 text-slate-500">Not posted</span>
                    )}
                  </td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openView(exp)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(exp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all duration-200"
                        title="Edit expense"
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete ${exp.expenseNumber}? This will reverse the journal entry.`)) deleteMutation.mutate(exp.id); }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all duration-200 disabled:opacity-50"
                        title="Delete expense"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={7} className="px-3 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total ({filtered.length} records)</td>
                <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">{formatNaira(totalExpenses)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {viewingExpense && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setViewingExpense(null)} />
      )}
      {viewingExpense && (
        <div className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">

            {/* Company header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {org?.logoUrl ? (
                    <img src={org.logoUrl} alt="" className="w-12 h-12 rounded-xl object-contain border border-slate-100 bg-white p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                      {org?.name?.[0]?.toUpperCase() ?? 'E'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{org?.name || 'Your Company'}</h2>
                    {org?.address && <p className="text-[11px] text-slate-500 mt-0.5">{org.address}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5">
                      {org?.phone && <span className="text-[11px] text-slate-400">{org.phone}</span>}
                      {org?.email && <span className="text-[11px] text-slate-400">{org.email}</span>}
                      {(org as any)?.website && <span className="text-[11px] text-slate-400">{(org as any).website}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Expense</p>
                  <p className="text-lg font-black text-slate-900 mt-0.5">{viewingExpense.expenseNumber}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <CheckCircle2 size={10} /> Posted
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    const el = document.getElementById('expense-pdf-container');
                    if (el) { el.style.display = 'block'; requestAnimationFrame(() => { window.print(); el.style.display = 'none'; }); }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <FileText size={14} /> Print PDF
                </button>
                <button onClick={() => setViewingExpense(null)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 ml-auto">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Header card */}
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">{new Date(viewingExpense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    {viewingExpense.journalEntryNumber && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                        <FileText size={11} /> Ledger: {viewingExpense.journalEntryNumber}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Total Amount</p>
                    <p className="text-xl font-bold text-slate-900">{fmtDual(viewingExpense.amount, viewingExpense.currency, viewingExpense.fxRate)}</p>
                    {viewingExpense.currency && viewingExpense.currency !== 'NGN' && (
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 rounded">{viewingExpense.currency}</span>
                        {viewingExpense.fxRate && <span className="text-[10px] text-slate-400">Rate: {Number(viewingExpense.fxRate).toFixed(4)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Account</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                      <Receipt size={12} className="text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">{accounts.find((a: any) => a.id === viewingExpense.accountId)?.name || viewingExpense.accountId}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vendor</p>
                  <p className="text-sm font-medium text-slate-800">{viewingExpense.vendorId ? (vendorMap.get(viewingExpense.vendorId) || viewingExpense.vendorId) : <span className="text-slate-300 italic">None</span>}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Payment Method</p>
                  <p className="text-sm font-medium capitalize text-slate-800">{viewingExpense.paymentMethod.replace('_', ' ')}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Reference</p>
                  <p className="text-sm font-medium text-slate-800 font-mono">{viewingExpense.reference || <span className="text-slate-300 italic">—</span>}</p>
                </div>
              </div>

              {/* Financial summary */}
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Financial Summary</p>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-600">Subtotal</span>
                  <span className="text-sm font-mono font-medium text-slate-800">{fmtDual(viewingExpense.amount - viewingExpense.taxAmount, viewingExpense.currency, viewingExpense.fxRate)}</span>
                </div>
                {viewingExpense.taxAmount > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">VAT (7.5%)</span>
                    <span className="text-sm font-mono text-slate-600">{fmtDual(viewingExpense.taxAmount, viewingExpense.currency, viewingExpense.fxRate)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-base font-bold font-mono text-slate-900">{fmtDual(viewingExpense.amount, viewingExpense.currency, viewingExpense.fxRate)}</span>
                </div>
              </div>

              {/* Billable badge */}
              {viewingExpense.isBillable && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center">
                    <Receipt size={12} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-800">Billable to Customer</p>
                    {viewingExpense.customerId && customersMap.has(viewingExpense.customerId) && (
                      <p className="text-sm font-medium text-amber-700">{customersMap.get(viewingExpense.customerId)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {viewingExpense.description && (
                <div className="bg-white rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{viewingExpense.description}</p>
                </div>
              )}

              {/* Linked PO */}
              {(viewingExpense as any).poId && (
                <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                  <FileText size={14} />
                  Linked to Purchase Order
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print container for expense PDF */}
      <div id="expense-pdf-container" className="bg-white" style={{ display: 'none' }}>
        <div className="p-10 space-y-8">
          {/* Header with org identity */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
            <div className="flex items-start gap-3">
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt="" className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                  {org?.name?.[0]?.toUpperCase() ?? 'S'}
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-slate-900">{org?.name || 'Your Company'}</h1>
                <div className="flex flex-col gap-y-0 mt-0.5">
                  {org?.address && <span className="text-[11px] text-slate-500 leading-snug">{org.address}</span>}
                  {(org as any)?.city && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).city}</span>}
                  {(org as any)?.state && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).state}</span>}
                  {(org as any)?.country && <span className="text-[11px] text-slate-500 leading-snug">{(org as any).country}</span>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0 mt-1">
                  {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                  {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                  {(org as any)?.website && <span className="text-[11px] text-slate-500">{(org as any).website}</span>}
                </div>
              </div>
            </div>
            <div className="sm:text-right shrink-0">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Expense</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5 tracking-tight">{viewingExpense?.expenseNumber}</p>
              <p className="text-xs text-slate-400 mt-1">{viewingExpense ? new Date(viewingExpense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</p>
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 size={10} /> Posted
              </span>
            </div>
          </div>
          {viewingExpense && (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 rounded-lg">
                    <th className="text-left py-3 pl-3 pr-2 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-l-lg">Account</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
                    <th className="text-left py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Method</th>
                    <th className="text-right py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                    <th className="text-right py-3 pl-2 pr-3 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-r-lg">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pl-3 pr-2 text-slate-700">{accounts.find((a: any) => a.id === viewingExpense.accountId)?.name || viewingExpense.accountId}</td>
                    <td className="py-3 px-2 text-slate-700">{viewingExpense.vendorId ? (vendorMap.get(viewingExpense.vendorId) || viewingExpense.vendorId) : '—'}</td>
                    <td className="py-3 px-2 text-slate-700 capitalize">{viewingExpense.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-3 px-2 text-right font-mono text-slate-600">{viewingExpense.reference || '—'}</td>
                    <td className="py-3 pl-2 pr-3 text-right font-mono font-bold text-slate-900">{formatNaira(viewingExpense.amount)}</td>
                  </tr>
                </tbody>
              </table>
              {viewingExpense.taxAmount > 0 && (
                <div className="flex justify-end">
                  <div className="w-64 border-t border-slate-200 pt-2 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatNaira(viewingExpense.amount - viewingExpense.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>VAT (7.5%)</span>
                      <span className="font-mono">{formatNaira(viewingExpense.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
                      <span>Total</span>
                      <span className="font-mono">{formatNaira(viewingExpense.amount)}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row justify-between gap-8 pt-2">
                <div className="flex-1 max-w-sm">
                  {viewingExpense.description && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{viewingExpense.description}</p>
                    </div>
                  )}
                  {viewingExpense.isBillable && viewingExpense.customerId && (
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Billable to</p>
                      <p className="text-sm font-medium text-amber-700">{customersMap.has(viewingExpense.customerId) ? customersMap.get(viewingExpense.customerId) : 'Customer'}</p>
                    </div>
                  )}
                  {org && ((org as any)?.vatNumber || (org as any)?.rcNumber) && (
                    <div className="mt-3 space-y-0.5">
                      {(org as any)?.vatNumber && <p className="text-xs text-slate-400">VAT Reg: {(org as any).vatNumber}</p>}
                      {(org as any)?.rcNumber && <p className="text-xs text-slate-400">RC: {(org as any).rcNumber}</p>}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4">
            {org?.name || 'SkyBooks'} — {org?.address || ''} — {org?.phone || ''} — {org?.email || ''}
            {(org as any)?.website && <span> — {(org as any).website}</span>}
          </div>
        </div>
      </div>

      {/* Import CSV */}
      {importOpen && (
        <CsvImportModal
          entity="expenses"
          endpoint="/purchases/expenses"
          onClose={() => setImportOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); queryClient.invalidateQueries({ queryKey: ['bankAccounts'] }); }}
          transformRow={(row, headers) => {
            const vendorName = row[headers.indexOf('vendorId (or name)')]?.trim();
            const vendor = (vendors || []).find(v => v.id === vendorName || v.name === vendorName);
            const accountName = row[headers.indexOf('accountId (or name)')]?.trim();
            const account = (accounts || []).find(a => a.id === accountName || a.name === accountName);
            return {
              accountId: account?.id || accountName,
              vendorId: vendor?.id || vendorName || null,
              date: row[headers.indexOf('date (YYYY-MM-DD)')],
              amount: Math.round(parseFloat(row[headers.indexOf('amount (NGN)')]) * 100),
              taxAmount: Math.round(parseFloat(row[headers.indexOf('taxAmount (NGN)')] || '0') * 100),
              paymentMethod: row[headers.indexOf('paymentMethod')],
              reference: row[headers.indexOf('reference')] || null,
              description: row[headers.indexOf('description')] || null,
              isBillable: row[headers.indexOf('isBillable (yes/no)')]?.toLowerCase() === 'yes',
              onAccount: false,
              currency: 'NGN',
            };
          }}
        />
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Expense' : 'Record Expense'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expense Account *</label>
                  <AccountSearchSelect
                    accounts={expenseAccounts}
                    value={form.accountId}
                    onChange={id => setForm({ ...form, accountId: id })}
                    placeholder="Search and select account..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">VAT Amount (₦)</label>
                  <input type="number" min="0" step="0.01" value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <CurrencySelector
                    currency={form.currency}
                    onCurrencyChange={c => setForm({ ...form, currency: c })}
                    fxRate={form.fxRate}
                    onFxRateChange={r => setForm({ ...form, fxRate: r })}
                    date={form.date}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Project</label>
                  <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow mt-1 bg-white">
                    <option value="">None (no project)</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor (optional)</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white">
                    <option value="">No vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Receipt / ref number" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?" className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow" />
                </div>
{!form.onAccount && (
  <div className="col-span-2">
    <label className="block text-xs font-medium text-slate-500 mb-1">Paid from Account (Bank/Cash)</label>
    <AccountSearchSelect
      accounts={assetAccounts}
      value={form.paymentAccountId}
      onChange={id => setForm({ ...form, paymentAccountId: id })}
      placeholder="Auto-resolve bank/cash account"
    />
  </div>
)}
                <div className="col-span-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={form.isBillable} onChange={e => setForm({ ...form, isBillable: e.target.checked })} className="rounded" />
                    Billable to customer
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={form.onAccount} onChange={e => setForm({ ...form, onAccount: e.target.checked, paymentAccountId: e.target.checked ? '' : form.paymentAccountId })} className="rounded" />
                    On account (unpaid)
                  </label>
                </div>
                {form.isBillable && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                    <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow">
                      <option value="">Select customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-all duration-200">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 flex items-center gap-2 transition-all duration-200">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

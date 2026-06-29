/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, Receipt, Eye,
  CheckCircle2, Trash2, Edit2, Download, FileText, Upload
} from 'lucide-react';
import { CsvImportModal } from '../../components/ui/CsvImportModal';
import { AccountSearchSelect } from '../../components/ui/AccountSearchSelect';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; code: string | null; }
interface Expense {
  id: string; expenseNumber: string; vendorId: string | null;
  date: string; accountId: string; amount: number; taxAmount: number;
  currency: string; paymentMethod: string; reference: string | null;
  description: string | null; isBillable: boolean;
  journalEntryId?: string | null;
  journalEntryNumber?: string | null;
}

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd'];

type FormState = {
  accountId: string; vendorId: string; date: string;
  amount: string; taxAmount: string; paymentMethod: string;
  reference: string; description: string; isBillable: boolean;
  paymentAccountId: string; onAccount: boolean;
};




const EMPTY_FORM: FormState = {
  accountId: '', vendorId: '', date: new Date().toISOString().split('T')[0],
  amount: '', taxAmount: '0', paymentMethod: 'cash',
  reference: '', description: '', isBillable: false,
  paymentAccountId: '', onAccount: false,
};

function exportCSV(expenses: Expense[], vendorMap: Map<string,string>, accountMap: Map<string,string>) {
  const headers = ['Ref #','Date','Description','Account','Vendor','Method','Amount (₦)','VAT (₦)','Billable'];
  const rows = expenses.map(e => [
    e.expenseNumber,
    fmtDate(e.date),
    e.description || '',
    accountMap.get(e.accountId) || '',
    e.vendorId ? (vendorMap.get(e.vendorId) || '') : '',
    e.paymentMethod?.replace('_',' '),
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
    <thead><tr><th>Ref #</th><th>Date</th><th>Description</th><th>Account</th><th>Vendor</th><th>Method</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td colspan="6"><strong>Total (${expenses.length} records)</strong></td><td style="text-align:right">${formatNaira(total)}</td></tr></tfoot>
  </table>
  <div class="footer">SkyBooks By Skyhouse Accountants &amp; Technologies (Olalekan Williams Edun) &bull; Confidential</div>
  </body></html>`;
  const w = window.open('','_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

export function ExpensesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
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

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter(a => a.type === 'expense'), [accounts]);
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'asset'), [accounts]);

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return expenses.filter(e =>
      !t || (e.description || '').toLowerCase().includes(t) ||
      e.expenseNumber.toLowerCase().includes(t) ||
      (vendorMap.get(e.vendorId || '') || '').toLowerCase().includes(t)
    );
  }, [expenses, search, vendorMap]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/expenses', p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeModal(); showSuccess('Expense recorded.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to save expense.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: string; p: any }) => api.patch(`/purchases/expenses/${id}`, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeModal(); showSuccess('Expense updated.'); },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to update expense.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/expenses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); showSuccess('Expense deleted and journal reversed.'); },
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
      paymentAccountId: '',
      onAccount: false,
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
      onAccount: form.onAccount,
      paymentAccountId: form.paymentAccountId || null,
      currency: 'NGN',
    };
    if (editingId) updateMutation.mutate({ id: editingId, p: payload });
    else createMutation.mutate(payload);
  }

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">{expenses.length} records · {formatNaira(expenses.reduce((s,e)=>s+e.amount,0))} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(filtered, vendorMap, accountMap)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={() => exportPDF(filtered, vendorMap, accountMap, totalExpenses)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <FileText size={14} /> PDF
          </button>
          <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={14} /> Record Expense
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading expenses...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load expenses.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <Receipt size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No matching expenses' : 'No expenses yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Record your first expense to track outgoings</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">Ref #</th>
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Description</th>
                <th className="py-3 px-2 text-left">Account</th>
                <th className="py-3 px-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Method</th>
                <th className="py-3 px-2 text-right">Amount</th>
                <th className="py-3 px-2 text-center">Ledger</th>
                <th className="py-3 pl-2 pr-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs text-slate-600">{exp.expenseNumber}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(exp.date)}</td>
                  <td className="py-3 px-2 text-slate-700 max-w-[180px] truncate">{exp.description || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500 max-w-[120px] truncate">{accountMap.get(exp.accountId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{exp.vendorId ? (vendorMap.get(exp.vendorId) || '—') : '—'}</td>
                  <td className="py-3 px-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{exp.paymentMethod?.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-900 font-medium">{formatNaira(exp.amount)}</td>
                  <td className="py-3 px-2">
                    {exp.journalEntryId ? (
                      <button
                        onClick={() => navigate(`/accountant/journals?entry=${exp.journalEntryNumber || ''}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      ><CheckCircle2 className="w-3 h-3" /> Posted</button>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Not posted</span>
                    )}
                  </td>
                  <td className="py-3 pl-2 pr-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openView(exp)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(exp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                        title="Edit expense"
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete ${exp.expenseNumber}? This will reverse the journal entry.`)) deleteMutation.mutate(exp.id); }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors disabled:opacity-50"
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
                <td colSpan={6} className="py-3 pl-4 pr-2 text-xs font-bold text-slate-700 uppercase tracking-wide">Total ({filtered.length} records)</td>
                <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">{formatNaira(totalExpenses)}</td>
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
        <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Expense Details</h2>
            <button onClick={() => setViewingExpense(null)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="font-mono text-sm font-semibold text-slate-700">{viewingExpense.expenseNumber}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(viewingExpense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Account</p>
                <p className="font-medium text-slate-800">{accounts.find((a: any) => a.id === viewingExpense.accountId)?.name || viewingExpense.accountId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Vendor</p>
                <p className="font-medium text-slate-800">{viewingExpense.vendorId ? (vendorMap.get(viewingExpense.vendorId) || viewingExpense.vendorId) : '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Amount</p>
                <p className="font-mono font-semibold text-slate-800">{formatNaira(viewingExpense.amount)}</p>
              </div>
              {viewingExpense.taxAmount > 0 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Tax</p>
                  <p className="font-mono text-slate-600">{formatNaira(viewingExpense.taxAmount)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Payment Method</p>
                <p className="capitalize text-slate-700">{viewingExpense.paymentMethod}</p>
              </div>
              {viewingExpense.reference && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Reference</p>
                  <p className="font-mono text-slate-700">{viewingExpense.reference}</p>
                </div>
              )}
              {viewingExpense.isBillable && (
                <div className="col-span-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Billable to Customer</span>
                </div>
              )}
            </div>

            {viewingExpense.description && (
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Description</p>
                {viewingExpense.description}
              </div>
            )}

            {(viewingExpense as any).poId && (
              <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                <FileText size={14} />
                Linked to Purchase Order
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import CSV */}
      {importOpen && (
        <CsvImportModal
          entity="expenses"
          endpoint="/purchases/expenses"
          onClose={() => setImportOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
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
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Expense' : 'Record Expense'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center gap-2">
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
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">VAT Amount (₦)</label>
                  <input type="number" min="0" step="0.01" value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor (optional)</label>
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">No vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Receipt / ref number" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
{!editingId && (
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
                  {!editingId && (
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={form.onAccount} onChange={e => setForm({ ...form, onAccount: e.target.checked })} className="rounded" />
                      On account (unpaid)
                    </label>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
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

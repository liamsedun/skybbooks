/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, Receipt,
  CheckCircle2, Trash2, Edit2, MoreVertical
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; code: string | null; }
interface Expense {
  id: string; expenseNumber: string; vendorId: string | null;
  date: string; accountId: string; amount: number; taxAmount: number;
  currency: string; paymentMethod: string; reference: string | null;
  description: string | null; isBillable: boolean;
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

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/expenses/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setMenuOpen(null); },
    onError: (e: any) => alert(e?.response?.data?.error || 'Failed to delete expense.'),
  });

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }
  function closeModal() { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId) { setFormError('Please select an expense account.'); return; }
    const amtKobo = Math.round(parseFloat(form.amount) * 100);
    const taxKobo = Math.round(parseFloat(form.taxAmount || '0') * 100);
    if (!amtKobo || amtKobo <= 0) { setFormError('Amount must be greater than zero.'); return; }
    createMutation.mutate({
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
    });
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">{expenses.length} records · {formatNaira(totalExpenses)} total</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} /> Record Expense
        </button>
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
                <th className="py-3 pl-2 pr-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs text-slate-600">{exp.expenseNumber}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(exp.date)}</td>
                  <td className="py-3 px-2 text-slate-700 max-w-[200px] truncate">{exp.description || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{accountMap.get(exp.accountId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{exp.vendorId ? (vendorMap.get(exp.vendorId) || '—') : '—'}</td>
                  <td className="py-3 px-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{exp.paymentMethod?.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-900 font-medium">{formatNaira(exp.amount)}</td>
                  <td className="py-3 pl-2 pr-4 relative">
                    <button onClick={() => setMenuOpen(menuOpen === exp.id ? null : exp.id)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreVertical size={14} />
                    </button>
                    {menuOpen === exp.id && (
                      <div className="absolute right-4 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg text-xs w-36 py-1">
                        <button onClick={() => { if (confirm('Delete this expense and reverse journal?')) deleteMutation.mutate(exp.id); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600">
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Record Expense</h2>
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
                  <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select account...</option>
                    {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>)}
                  </select>
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
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Paid from Account (Bank/Cash)</label>
                  <select value={form.paymentAccountId} onChange={e => setForm({ ...form, paymentAccountId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Auto-resolve bank/cash account</option>
                    {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={form.isBillable} onChange={e => setForm({ ...form, isBillable: e.target.checked })} className="rounded" />
                    Billable to customer
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={form.onAccount} onChange={e => setForm({ ...form, onAccount: e.target.checked })} className="rounded" />
                    On account (unpaid)
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

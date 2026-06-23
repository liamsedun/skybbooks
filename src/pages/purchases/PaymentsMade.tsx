/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, X, Loader2, AlertCircle, Search, CreditCard,
  CheckCircle2, Minus
} from 'lucide-react';

interface Vendor { id: string; name: string; }
interface Account { id: string; name: string; type: string; }
interface Bill { id: string; billNumber: string; vendorId: string; balanceDue: number; total: number; }
interface Payment {
  id: string; paymentNumber: string; vendorId: string;
  date: string; amount: number; currency: string;
  paymentMethod: string; reference: string | null; notes: string | null;
}

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque', 'pos', 'ussd'];

export function PaymentsMadePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    vendorId: '', date: new Date().toISOString().split('T')[0],
    amount: '', paymentMethod: 'bank_transfer',
    reference: '', notes: '', accountId: '',
    allocations: [] as { billId: string; amount: string }[],
  });

  const { data: payments = [], isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['payments-made'],
    queryFn: async () => { const r = await api.get('/purchases/payments'); return r.data; },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => { const r = await api.get('/purchases/vendors'); return r.data; },
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const { data: allBills = [] } = useQuery<Bill[]>({
    queryKey: ['bills-open'],
    queryFn: async () => {
      const r = await api.get('/purchases/bills', { params: { status: 'open', limit: 100 } });
      return r.data?.bills || [];
    },
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);
  const assetAccounts = useMemo(() => accounts.filter(a => a.type === 'asset'), [accounts]);

  const vendorBills = useMemo(() =>
    allBills.filter(b => b.vendorId === form.vendorId && b.balanceDue > 0),
    [allBills, form.vendorId]
  );

  const filtered = useMemo(() => {
    const t = search.toLowerCase();
    return payments.filter(p =>
      !t || p.paymentNumber.toLowerCase().includes(t) ||
      (vendorMap.get(p.vendorId) || '').toLowerCase().includes(t) ||
      (p.reference || '').toLowerCase().includes(t)
    );
  }, [payments, search, vendorMap]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/purchases/payments', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-made'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills-open'] });
      closeModal();
      showSuccess('Payment recorded successfully.');
    },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to record payment.'),
  });

  function showSuccess(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); }
  function closeModal() {
    setModalOpen(false);
    setForm({ vendorId: '', date: new Date().toISOString().split('T')[0], amount: '', paymentMethod: 'bank_transfer', reference: '', notes: '', accountId: '', allocations: [] });
    setFormError(null);
  }

  function onVendorChange(vendorId: string) {
    setForm({ ...form, vendorId, allocations: [] });
  }

  function toggleBillAllocation(billId: string, balanceDue: number) {
    const existing = form.allocations.find(a => a.billId === billId);
    if (existing) {
      setForm({ ...form, allocations: form.allocations.filter(a => a.billId !== billId) });
    } else {
      setForm({ ...form, allocations: [...form.allocations, { billId, amount: (balanceDue / 100).toFixed(2) }] });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId) { setFormError('Please select a vendor.'); return; }
    if (!form.accountId) { setFormError('Please select a bank/cash account.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormError('Amount must be greater than zero.'); return; }
    if (form.allocations.length === 0) { setFormError('Please allocate this payment to at least one bill.'); return; }

    createMutation.mutate({
      vendorId: form.vendorId,
      date: form.date,
      amount: Math.round(parseFloat(form.amount) * 100),
      currency: 'NGN',
      paymentMethod: form.paymentMethod,
      reference: form.reference || null,
      notes: form.notes || null,
      accountId: form.accountId,
      allocations: form.allocations.map(a => ({
        billId: a.billId,
        amount: Math.round(parseFloat(a.amount) * 100),
      })),
    });
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments Made</h1>
          <p className="text-sm text-slate-500 mt-0.5">{payments.length} payments · {formatNaira(totalPaid)} total disbursed</p>
        </div>
        <button onClick={() => { setModalOpen(true); setFormError(null); }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} /> Record Payment
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white border border-slate-200 rounded-xl">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading payments...
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 gap-2 bg-white border border-slate-200 rounded-xl">
          <AlertCircle size={18} /> Failed to load payments.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
          <CreditCard size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No matching payments' : 'No payments recorded yet'}</p>
          {!search && <p className="text-xs text-slate-400 mt-1">Record a payment to track vendor disbursements</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="py-3 pl-4 pr-2 text-left">Payment #</th>
                <th className="py-3 px-2 text-left">Vendor</th>
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Method</th>
                <th className="py-3 px-2 text-left">Reference</th>
                <th className="py-3 px-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pl-4 pr-2 font-mono text-xs font-medium text-slate-700">{p.paymentNumber}</td>
                  <td className="py-3 px-2 font-medium text-slate-900">{vendorMap.get(p.vendorId) || '—'}</td>
                  <td className="py-3 px-2 text-xs text-slate-500">{fmtDate(p.date)}</td>
                  <td className="py-3 px-2">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{p.paymentMethod?.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-2 text-xs text-slate-500 font-mono">{p.reference || '—'}</td>
                  <td className="py-3 px-2 text-right font-mono font-medium text-slate-900">{formatNaira(p.amount)}</td>
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
              <h2 className="text-base font-semibold text-slate-900">Record Payment to Vendor</h2>
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vendor *</label>
                  <select value={form.vendorId} onChange={e => onVendorChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Paid From Account *</label>
                  <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select account...</option>
                    {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Transfer ref / cheque no." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              {/* Bill Allocations */}
              {form.vendorId && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Allocate to Bills *</label>
                  {vendorBills.length === 0 ? (
                    <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3">No open bills for this vendor.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                      {vendorBills.map(b => {
                        const alloc = form.allocations.find(a => a.billId === b.id);
                        return (
                          <div key={b.id} className={`px-3 py-2.5 flex items-center gap-3 ${alloc ? 'bg-indigo-50' : 'bg-white'}`}>
                            <input type="checkbox" checked={!!alloc} onChange={() => toggleBillAllocation(b.id, b.balanceDue)} className="rounded" />
                            <div className="flex-1">
                              <span className="text-xs font-mono font-medium text-slate-700">{b.billNumber}</span>
                              <span className="text-xs text-slate-400 ml-2">Balance: {formatNaira(b.balanceDue)}</span>
                            </div>
                            {alloc && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">₦</span>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={alloc.amount}
                                  onChange={e => {
                                    const updated = form.allocations.map(a => a.billId === b.id ? { ...a, amount: e.target.value } : a);
                                    setForm({ ...form, allocations: updated });
                                  }}
                                  className="w-28 px-2 py-1 text-xs border border-indigo-200 rounded focus:outline-none text-right bg-white"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

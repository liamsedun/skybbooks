/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Plus, Search, X, Loader2, AlertCircle, CheckCircle2,
  CreditCard, Building2, Banknote, Smartphone, FileText,
} from 'lucide-react';

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'pos' | 'ussd';

interface Customer { id: string; name: string; email: string | null; }
interface Invoice { id: string; invoiceNumber: string; balanceDue: number; total: number; status: string; customerId: string; }
interface BankAccount { id: string; accountName: string; bankName: string; accountNumber: string; }
interface Payment {
  id: string; orgId: string; paymentNumber: string; customerId: string;
  date: string; amount: number; currency: string;
  paymentMethod: PaymentMethod; reference: string | null;
  accountId: string; notes: string | null; createdAt: string;
}

const METHOD_META: Record<PaymentMethod, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  cash:          { label: 'Cash',          icon: Banknote },
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  card:          { label: 'Card',          icon: CreditCard },
  cheque:        { label: 'Cheque',        icon: FileText },
  pos:           { label: 'POS',           icon: CreditCard },
  ussd:          { label: 'USSD',          icon: Smartphone },
};

function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface AllocationLine { invoiceId: string; amount: string; }

type FormState = {
  customerId: string;
  date: string;
  amount: string;
  paymentMethod: PaymentMethod;
  accountId: string;
  reference: string;
  notes: string;
  allocations: AllocationLine[];
};

const EMPTY_FORM: FormState = {
  customerId: '', date: new Date().toISOString().split('T')[0],
  amount: '', paymentMethod: 'bank_transfer',
  accountId: '', reference: '', notes: '',
  allocations: [],
};

export function PaymentsReceivedPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: payments, isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['payments-received'],
    queryFn: async () => { const r = await api.get('/sales/payments-received'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ['bankAccounts'],
    queryFn: async () => { const r = await api.get('/banking/accounts'); return r.data; },
  });

  // Fetch open invoices for selected customer
  const { data: customerInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices', 'open', form.customerId],
    queryFn: async () => {
      const r = await api.get(`/sales/invoices?customerId=${form.customerId}&status=sent`);
      return r.data?.invoices || [];
    },
    enabled: !!form.customerId,
  });

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const createMutation = useMutation({
    mutationFn: (p: any) => api.post('/sales/payments-received', p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-received'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'customers'] });
      closeModal();
    },
    onError: (e: any) => setFormError(e?.response?.data?.error || 'Failed to record payment.'),
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (payments || []).filter(p => {
      if (!term) return true;
      const cust = customerMap.get(p.customerId);
      return p.paymentNumber.toLowerCase().includes(term) ||
        (cust?.name || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term);
    });
  }, [payments, searchTerm, customerMap]);

  const totalReceived = useMemo(() =>
    (payments || []).reduce((sum, p) => sum + p.amount, 0), [payments]);

  function openCreate() { setForm(EMPTY_FORM); setFormError(null); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setFormError(null); }

  function handleCustomerChange(customerId: string) {
    setForm({ ...form, customerId, allocations: [] });
  }

  function addAllocation() {
    setForm({ ...form, allocations: [...form.allocations, { invoiceId: '', amount: '' }] });
  }

  function updateAllocation(idx: number, field: keyof AllocationLine, value: string) {
    const newAllocs = [...form.allocations];
    newAllocs[idx] = { ...newAllocs[idx], [field]: value };
    setForm({ ...form, allocations: newAllocs });
  }

  function removeAllocation(idx: number) {
    setForm({ ...form, allocations: form.allocations.filter((_, i) => i !== idx) });
  }

  function autoAllocate() {
    if (!customerInvoices || !form.amount) return;
    let remaining = Math.round(parseFloat(form.amount) * 100);
    const allocs: AllocationLine[] = [];
    for (const inv of customerInvoices) {
      if (remaining <= 0) break;
      if (inv.balanceDue <= 0) continue;
      const allocated = Math.min(remaining, inv.balanceDue);
      allocs.push({ invoiceId: inv.id, amount: (allocated / 100).toString() });
      remaining -= allocated;
    }
    setForm({ ...form, allocations: allocs });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId) { setFormError('Please select a customer.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormError('Please enter a valid payment amount.'); return; }
    if (!form.accountId) { setFormError('Please select a bank account.'); return; }

    const amountKobo = Math.round(parseFloat(form.amount) * 100);
    const allocations = form.allocations
      .filter(a => a.invoiceId && a.amount)
      .map(a => ({ invoiceId: a.invoiceId, amount: Math.round(parseFloat(a.amount) * 100) }));

    const allocatedSum = allocations.reduce((s, a) => s + a.amount, 0);
    if (allocatedSum !== amountKobo) {
      setFormError(`Allocated total (₦${(allocatedSum/100).toLocaleString()}) must equal payment amount (₦${(amountKobo/100).toLocaleString()}).`);
      return;
    }

    createMutation.mutate({
      customerId: form.customerId,
      date: form.date,
      amount: amountKobo,
      paymentMethod: form.paymentMethod,
      accountId: form.accountId,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      allocations,
    });
  }

  const allocatedTotal = form.allocations
    .filter(a => a.amount)
    .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const paymentAmount = parseFloat(form.amount) || 0;
  const unallocated = paymentAmount - allocatedTotal;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payments Received</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {payments?.length || 0} payments · Total: {formatNaira(totalReceived)}
          </p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
          <Plus size={15} /> Record Payment
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search payments..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> Loading payments...</div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-rose-500 gap-2"><AlertCircle size={18} /> Failed to load payments.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CreditCard size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">No payments recorded yet</p>
            <p className="text-xs mt-1">Record your first customer payment to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-3 pl-4 pr-3">Payment #</th>
                <th className="py-3 pr-3">Customer</th>
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3">Method</th>
                <th className="py-3 pr-3">Reference</th>
                <th className="py-3 pr-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => {
                const cust = customerMap.get(p.customerId);
                const meta = METHOD_META[p.paymentMethod] || METHOD_META.bank_transfer;
                const Icon = meta.icon;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pl-4 pr-3 text-sm font-mono font-medium text-slate-700">{p.paymentNumber}</td>
                    <td className="py-3 pr-3 text-sm text-slate-700">{cust?.name || '—'}</td>
                    <td className="py-3 pr-3 text-sm text-slate-500">{fmtDate(p.date)}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-sm text-slate-500 font-mono">{p.reference || '—'}</td>
                    <td className="py-3 pr-4 text-sm text-right font-bold text-emerald-700 font-mono">{formatNaira(p.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={5} className="py-3 pl-4 text-sm font-semibold text-slate-700">Total</td>
                <td className="py-3 pr-4 text-right text-sm font-black text-emerald-700 font-mono">{formatNaira(totalReceived)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Record Payment Received</h2>
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer *</label>
                  <select value={form.customerId} onChange={e => handleCustomerChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method *</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    {(Object.keys(METHOD_META) as PaymentMethod[]).map(m => (
                      <option key={m} value={m}>{METHOD_META[m].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Deposit To (Bank Account) *</label>
                  <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white">
                    <option value="">Select account...</option>
                    {(bankAccounts || []).map(a => <option key={a.id} value={a.id}>{a.accountName} — {a.bankName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference / Cheque No.</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="e.g. NIBSS-123456" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none" />
                </div>
              </div>

              {/* Invoice Allocations */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Allocate to Invoices *</label>
                  {form.customerId && form.amount && (
                    <button type="button" onClick={autoAllocate} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Auto-allocate
                    </button>
                  )}
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {form.allocations.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400 text-center">No allocations added. Add an invoice to allocate this payment against.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase">
                          <th className="py-2 pl-3 pr-2 text-left">Invoice</th>
                          <th className="py-2 px-2 text-left">Balance Due</th>
                          <th className="py-2 px-2 text-right">Amount to Allocate (₦)</th>
                          <th className="py-2 pl-2 pr-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {form.allocations.map((alloc, idx) => {
                          const inv = (customerInvoices || []).find(i => i.id === alloc.invoiceId);
                          return (
                            <tr key={idx}>
                              <td className="py-2 pl-3 pr-2">
                                <select value={alloc.invoiceId} onChange={e => updateAllocation(idx, 'invoiceId', e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 bg-white">
                                  <option value="">Select invoice...</option>
                                  {(customerInvoices || []).map(i => (
                                    <option key={i.id} value={i.id}>{i.invoiceNumber} — {formatNaira(i.balanceDue)} due</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2 text-xs text-slate-500 font-mono">
                                {inv ? formatNaira(inv.balanceDue) : '—'}
                              </td>
                              <td className="py-2 px-2">
                                <input type="number" min="0" step="0.01" value={alloc.amount} onChange={e => updateAllocation(idx, 'amount', e.target.value)} placeholder="0.00" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20 text-right" />
                              </td>
                              <td className="py-2 pl-2 pr-3">
                                <button type="button" onClick={() => removeAllocation(idx)} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={14} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <button type="button" onClick={addAllocation} disabled={!form.customerId} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 flex items-center gap-1">
                      <Plus size={13} /> Add Invoice
                    </button>
                    <div className="text-xs text-slate-500">
                      Allocated: <span className={`font-mono font-semibold ${Math.abs(unallocated) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ₦{allocatedTotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                      {Math.abs(unallocated) >= 0.01 && (
                        <span className="ml-2 text-rose-500">· Unallocated: ₦{Math.abs(unallocated).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
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

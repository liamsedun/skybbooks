/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Search, Loader2, AlertCircle, CreditCard, Plus, Pencil,
  Banknote, Smartphone, Building2, Receipt, Trash2, X,
  FileText, ChevronRight, Download,
} from 'lucide-react';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  orgId: string;
  paymentNumber: string;
  category: 'sales_invoice' | 'other_income';
  customerId: string | null;
  payerName: string | null;
  date: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string | null;
  accountId: string;
  incomeAccountId: string | null;
  notes: string | null;
  createdAt: string;
}

interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
}

interface PaymentDetail extends Payment {
  allocations: PaymentAllocation[];
  type: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes: string | null;
  lines: any[];
  customer?: Customer;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

interface GLAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface Org {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  vatNumber: string | null;
  rcNumber: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const METHOD_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  cash:          { label: 'Cash',          icon: Banknote },
  card:          { label: 'Card',          icon: CreditCard },
  cheque:        { label: 'Cheque',        icon: Receipt },
  pos:           { label: 'POS',           icon: CreditCard },
  ussd:          { label: 'USSD',          icon: Smartphone },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:   { label: 'Draft',          className: 'bg-slate-100 text-slate-600' },
  sent:    { label: 'Sent',           className: 'bg-blue-50 text-blue-600' },
  paid:    { label: 'Paid',           className: 'bg-emerald-50 text-emerald-700' },
  partial: { label: 'Partially Paid', className: 'bg-amber-50 text-amber-700' },
  overdue: { label: 'Overdue',        className: 'bg-rose-50 text-rose-600' },
  void:    { label: 'Void',           className: 'bg-slate-100 text-slate-400' },
};

const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'cheque', 'pos', 'ussd'];

type AddFormState = {
  category: 'sales_invoice' | 'other_income';
  payerName: string;
  customerId: string;
  date: string;
  amount: string;
  paymentMethod: string;
  reference: string;
  accountId: string;
  incomeAccountId: string;
  notes: string;
};

const EMPTY_ADD_FORM: AddFormState = {
  category: 'other_income',
  payerName: '',
  customerId: '',
  date: new Date().toISOString().split('T')[0],
  amount: '',
  paymentMethod: 'bank_transfer',
  reference: '',
  accountId: '',
  incomeAccountId: '',
  notes: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function PaymentsReceivedPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm]           = useState('');
  const [methodFilter, setMethodFilter]       = useState('all');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [receiptPaymentId, setReceiptPaymentId]   = useState<string | null>(null);

  // Add modal
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState<AddFormState>(EMPTY_ADD_FORM);
  const [addError, setAddError]   = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [editForm, setEditForm]     = useState<Partial<AddFormState>>({});
  const [editError, setEditError]   = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: payments, isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['sales', 'payments'],
    queryFn: async () => { const r = await api.get('/sales/payments'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: org } = useQuery<Org>({
    queryKey: ['org'],
    queryFn: async () => { const r = await api.get('/org'); return r.data; },
    staleTime: 60000,
  });

  const { data: glAccounts } = useQuery<GLAccount[]>({
    queryKey: ['accountant', 'accounts'],
    queryFn: async () => { const r = await api.get('/accountant/accounts'); return r.data; },
  });

  const { data: bankAccounts } = useQuery<any[]>({
    queryKey: ['bankAccounts'],
    queryFn: async () => { const r = await api.get('/banking/accounts'); return r.data; },
  });

  const { data: detail, isLoading: loadingDetail } = useQuery<PaymentDetail>({
    queryKey: ['sales', 'payment-detail', selectedPaymentId],
    queryFn: async () => { const r = await api.get(`/sales/payments/${selectedPaymentId}`); return r.data; },
    enabled: !!selectedPaymentId,
  });

  const allocationInvoiceIds = detail?.allocations?.map(a => a.invoiceId) || [];
  const { data: allocationInvoices } = useQuery<InvoiceDetail[]>({
    queryKey: ['allocation-invoices', allocationInvoiceIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        allocationInvoiceIds.map(id => api.get(`/sales/invoices/${id}`).then(r => r.data))
      );
      return results;
    },
    enabled: allocationInvoiceIds.length > 0,
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const invoiceMap = useMemo(() => {
    const m = new Map<string, InvoiceDetail>();
    (allocationInvoices || []).forEach(inv => m.set(inv.id, inv));
    return m;
  }, [allocationInvoices]);

  const revenueAccounts = (glAccounts || []).filter(a => a.type === 'revenue' && a.isActive);
  const assetAccounts   = (glAccounts || []).filter(a => a.type === 'asset'   && a.isActive);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (payments || []).filter(p => {
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (!term) return true;
      const cust = p.customerId ? customerMap.get(p.customerId) : null;
      return (
        p.paymentNumber.toLowerCase().includes(term) ||
        (cust?.name || '').toLowerCase().includes(term) ||
        (p.payerName || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term)
      );
    });
  }, [payments, searchTerm, methodFilter, customerMap]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sum: filtered.reduce((s, p) => s + p.amount, 0),
  }), [filtered]);

  const methods = useMemo(() => Array.from(new Set((payments || []).map(p => p.paymentMethod))), [payments]);

  const selectedPayment = selectedPaymentId ? (payments || []).find(p => p.id === selectedPaymentId) : null;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      setAddOpen(false);
      setAddForm(EMPTY_ADD_FORM);
      setAddError(null);
    },
    onError: (e: any) => setAddError(e?.response?.data?.error || 'Failed to record payment.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/sales/payments/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      setEditTarget(null);
      setEditError(null);
    },
    onError: (e: any) => setEditError(e?.response?.data?.error || 'Failed to update payment.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteTarget(null);
      setDeleteError(null);
      if (selectedPaymentId === deleteTarget?.id) setSelectedPaymentId(null);
    },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to reverse payment.'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addForm.amount || parseFloat(addForm.amount) <= 0) { setAddError('Amount is required.'); return; }
    if (!addForm.accountId) { setAddError('Bank / deposit account is required.'); return; }
    if (addForm.category === 'other_income' && !addForm.payerName.trim() && !addForm.customerId) {
      setAddError('Payer name or customer is required.'); return;
    }
    const payload: any = {
      category: addForm.category,
      payerName: addForm.payerName.trim() || null,
      customerId: addForm.customerId || null,
      date: addForm.date,
      amount: Math.round(parseFloat(addForm.amount) * 100),
      paymentMethod: addForm.paymentMethod,
      reference: addForm.reference.trim() || null,
      accountId: addForm.accountId,
      incomeAccountId: addForm.incomeAccountId || null,
      notes: addForm.notes.trim() || null,
      allocations: [],
    };
    createMutation.mutate(payload);
  }

  function openEditModal(p: Payment) {
    setEditTarget(p);
    const cust = p.customerId ? customerMap.get(p.customerId) : null;
    setEditForm({
      payerName: p.payerName || cust?.name || '',
      date: p.date.split('T')[0],
      amount: (p.amount / 100).toString(),
      paymentMethod: p.paymentMethod,
      reference: p.reference || '',
      notes: p.notes || '',
    });
    setEditError(null);
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const payload: any = {
      payerName: editForm.payerName?.trim() || null,
      date: editForm.date,
      reference: editForm.reference?.trim() || null,
      notes: editForm.notes?.trim() || null,
    };
    if (editForm.amount) payload.amount = Math.round(parseFloat(editForm.amount) * 100);
    updateMutation.mutate({ id: editTarget.id, payload });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-receipt { display: block !important; position: fixed; inset: 0; background: white; z-index: 9999; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payments Received</h1>
            <p className="text-sm text-slate-500 mt-1">
              {totals.count} payments · {formatNaira(totals.sum)} total received
            </p>
          </div>
          <button
            onClick={() => { setAddForm(EMPTY_ADD_FORM); setAddError(null); setAddOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={16} />Record Payment
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Receipts</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira((payments || []).reduce((s, p) => s + p.amount, 0))}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">This Month</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {formatNaira((payments || []).filter(p => {
                const d = new Date(p.date); const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).reduce((s, p) => s + p.amount, 0))}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Count</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{(payments || []).length} payments</p>
          </div>
        </div>

        <div className="flex gap-6">
          {/* List panel */}
          <div className={`flex-1 min-w-0 ${selectedPaymentId ? 'hidden lg:block' : ''}`}>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setMethodFilter('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${methodFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                All Methods
              </button>
              {methods.map(m => (
                <button key={m} onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${methodFilter === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {METHOD_META[m]?.label || m}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by payment number, customer, or reference..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 size={20} className="animate-spin mr-2" />Loading payments...
                </div>
              ) : isError ? (
                <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
                  <AlertCircle size={16} />Failed to load payments.
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <Banknote size={28} className="text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-600">No payments yet</p>
                  <p className="text-xs text-slate-400 mt-1">Record your first payment using the button above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                      <th className="py-2.5 pl-4 pr-3">Payment #</th>
                      <th className="py-2.5 pr-3">From</th>
                      <th className="py-2.5 pr-3">Date</th>
                      <th className="py-2.5 pr-3">Method</th>
                      <th className="py-2.5 pr-3 text-right">Amount</th>
                      <th className="py-2.5 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(p => {
                      const cust = p.customerId ? customerMap.get(p.customerId) : null;
                      const displayName = cust?.name || p.payerName || '—';
                      const displayEmail = cust?.email || null;
                      const meta = METHOD_META[p.paymentMethod] || { label: p.paymentMethod, icon: Banknote };
                      const Icon = meta.icon;
                      const isSelected = p.id === selectedPaymentId;
                      return (
                        <tr key={p.id} onClick={() => setSelectedPaymentId(isSelected ? null : p.id)}
                          className={`group cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50'}`}>
                          <td className="py-2.5 pl-4 pr-3">
                            <p className="font-mono text-sm font-semibold text-slate-700">{p.paymentNumber}</p>
                            {p.category === 'other_income' && (
                              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Other Income</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <p className="text-sm font-medium text-slate-800">{displayName}</p>
                            {displayEmail && <p className="text-xs text-slate-400">{displayEmail}</p>}
                          </td>
                          <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(p.date)}</td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <Icon className="w-3.5 h-3.5 text-slate-400" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold text-emerald-700 font-mono">
                            {formatNaira(p.amount)}
                          </td>
                          <td className="py-2.5 pr-2">
                            <div className="opacity-0 group-hover:opacity-100 flex items-center justify-end gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
                              {p.category === 'sales_invoice' && (
                                <button onClick={() => setReceiptPaymentId(p.id)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Download receipt">
                                  <Download size={14} />
                                </button>
                              )}
                              <button onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Edit payment">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => { setDeleteTarget(p); setDeleteError(null); }}
                                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Reverse payment">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={4} className="py-2.5 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {filtered.length} payments shown
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-slate-800 font-mono">{formatNaira(totals.sum)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table></div>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selectedPaymentId && (
            <div className="w-full lg:w-96 shrink-0">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Payment Detail</p>
                    <p className="text-base font-bold text-slate-900 mt-0.5">{selectedPayment?.paymentNumber}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedPayment?.category === 'sales_invoice' && (
                      <button onClick={() => setReceiptPaymentId(selectedPaymentId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Download receipt">
                        <Download size={16} />
                      </button>
                    )}
                    <button onClick={() => selectedPayment && openEditModal(selectedPayment)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setSelectedPaymentId(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <Loader2 size={18} className="animate-spin mr-2" />Loading...
                  </div>
                ) : detail ? (
                  <div className="p-5 space-y-5">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">From</span>
                        <span className="font-medium text-slate-800">
                          {detail.customerId ? (customerMap.get(detail.customerId)?.name || '—') : (detail.payerName || '—')}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Category</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${detail.category === 'sales_invoice' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                          {detail.category === 'sales_invoice' ? 'Invoice Payment' : 'Other Income'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Date</span>
                        <span className="font-medium text-slate-800">{fmtDate(detail.date)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Method</span>
                        <span className="font-medium text-slate-800">{METHOD_META[detail.paymentMethod]?.label || detail.paymentMethod}</span>
                      </div>
                      {detail.reference && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Reference</span>
                          <span className="font-medium text-slate-800 font-mono">{detail.reference}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-3 border-t border-slate-100">
                        <span className="text-sm font-semibold text-slate-700">Total Received</span>
                        <span className="text-lg font-black text-emerald-700 font-mono">{formatNaira(detail.amount)}</span>
                      </div>
                    </div>

                    {detail.allocations && detail.allocations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                          <FileText size={12} />Allocated To
                        </p>
                        <div className="space-y-2">
                          {detail.allocations.map(alloc => {
                            const inv = invoiceMap.get(alloc.invoiceId);
                            const statusMeta = inv ? STATUS_META[inv.status] : null;
                            return (
                              <div key={alloc.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-800 font-mono">
                                      {inv?.invoiceNumber || alloc.invoiceId.substring(0, 8) + '...'}
                                    </span>
                                    {statusMeta && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${statusMeta.className}`}>
                                        {statusMeta.label}
                                      </span>
                                    )}
                                  </div>
                                  {inv && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      Total {formatNaira(inv.total)} · Due {formatNaira(inv.balanceDue)}
                                    </p>
                                  )}
                                  <p className="text-xs font-medium text-emerald-700 mt-0.5">
                                    Applied: {formatNaira(alloc.amount)}
                                  </p>
                                </div>
                                <button onClick={() => navigate(`/sales/invoices/${alloc.invoiceId}`)}
                                  className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0">
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {detail.notes && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{detail.notes}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">
                      <button onClick={() => { setDeleteTarget(selectedPayment!); setDeleteError(null); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors">
                        <Trash2 size={14} />Reverse Payment
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Payment Modal ────────────────────────────────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Record Payment Received</h2>
              <button onClick={() => { setAddOpen(false); setAddError(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="px-5 py-4 space-y-3 max-h-[75vh] overflow-y-auto">
              {addError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{addError}</div>}

              {/* Category toggle */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['other_income', 'sales_invoice'] as const).map(cat => (
                    <button key={cat} type="button"
                      onClick={() => setAddForm(f => ({ ...f, category: cat }))}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${addForm.category === cat ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {cat === 'sales_invoice' ? 'Invoice Payment' : 'Other Income'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {addForm.category === 'other_income'
                    ? 'Use for grants, donations, asset sales, or any non-invoice income.'
                    : 'Records payment and allocates it to an invoice via the invoice detail page.'}
                </p>
              </div>

              {addForm.category === 'other_income' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payer Name</label>
                  <input value={addForm.payerName} onChange={e => setAddForm(f => ({ ...f, payerName: e.target.value }))}
                    placeholder="e.g. Federal Government Grant, Asset Disposal"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                  <select value={addForm.customerId} onChange={e => setAddForm(f => ({ ...f, customerId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="">Select customer...</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">After saving, open the invoice to allocate this payment against it.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦)</label>
                  <input type="number" step="0.01" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                  <select value={addForm.paymentMethod} onChange={e => setAddForm(f => ({ ...f, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_META[m]?.label || m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={addForm.reference} onChange={e => setAddForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="TXN-xxxxx"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Deposit Into (Bank Account / GL)</label>
                <select value={addForm.accountId} onChange={e => setAddForm(f => ({ ...f, accountId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  <option value="">Select account...</option>
                  {(bankAccounts || []).map((ba: any) => (
                    <option key={ba.accountId} value={ba.accountId}>{ba.bankName} — {ba.name}</option>
                  ))}
                  {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>

              {addForm.category === 'other_income' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Income Account (Revenue GL)</label>
                  <select value={addForm.incomeAccountId} onChange={e => setAddForm(f => ({ ...f, incomeAccountId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                    <option value="">Select income account...</option>
                    {revenueAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setAddOpen(false); setAddError(null); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {createMutation.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Edit Payment — {editTarget.paymentNumber}</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-5 py-4 space-y-3">
              {editError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{editError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input type="date" value={editForm.date || ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
                  <input value={editForm.reference || ''} onChange={e => setEditForm(f => ({ ...f, reference: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              </div>
              {editTarget.category === 'other_income' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Payer Name</label>
                  <input value={editForm.payerName || ''} onChange={e => setEditForm(f => ({ ...f, payerName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
              <p className="text-xs text-slate-400">Note: Amount and allocation cannot be edited after recording. Reverse and re-record if needed.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit" disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Reverse Payment</h2>
            <p className="text-sm text-slate-500 mb-4">
              Reverse <span className="font-medium text-slate-700">{deleteTarget.paymentNumber}</span> ({formatNaira(deleteTarget.amount)})?
              This will restore any invoice balance due and reverse the journal entries.
            </p>
            {deleteError && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{deleteError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Reversing...' : 'Reverse Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal (sales_invoice only) ─────────────────────────────── */}
      <ReceiptModal
        paymentId={receiptPaymentId}
        onClose={() => setReceiptPaymentId(null)}
        customerMap={customerMap}
        org={org}
      />
    </>
  );
}

// ── Receipt Modal Component ───────────────────────────────────────────────────

function ReceiptModal({ paymentId, onClose, customerMap, org }: {
  paymentId: string | null;
  onClose: () => void;
  customerMap: Map<string, Customer>;
  org?: Org;
}) {
  const { data: payment, isLoading: paymentLoading } = useQuery<PaymentDetail>({
    queryKey: ['sales', 'payments', paymentId],
    queryFn: async () => { const r = await api.get(`/sales/payments/${paymentId}`); return r.data; },
    enabled: !!paymentId,
  });

  const invoiceIds = useMemo(
    () => Array.from(new Set((payment?.allocations || []).map(a => a.invoiceId))),
    [payment]
  );

  const invoiceQueries = useQueries({
    queries: invoiceIds.map(invId => ({
      queryKey: ['sales', 'invoices', invId],
      queryFn: async () => { const r = await api.get(`/sales/invoices/${invId}`); return r.data as InvoiceDetail; },
      enabled: !!invId,
    })),
  });

  const invoiceNumbers = useMemo(
    () => invoiceQueries.map(q => q.data?.invoiceNumber).filter(Boolean) as string[],
    [invoiceQueries]
  );

  if (!paymentId) return null;

  const cust = payment?.customerId ? customerMap.get(payment.customerId) : undefined;
  const meta = payment ? (METHOD_META[payment.paymentMethod] || { label: payment.paymentMethod, icon: Banknote }) : null;
  const isLoading = paymentLoading || invoiceQueries.some(q => q.isLoading);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4 py-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 print:hidden">
          <h2 className="text-base font-semibold text-slate-900">Payment Receipt</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              <Download size={14} />Download PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading || !payment ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" />Loading receipt...
            </div>
          ) : (
            <div id="receipt-pdf-container" className="bg-white">
              <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />
              <div className="p-8 sm:p-10 space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
                  <div className="flex items-start gap-3">
                    {org?.logoUrl ? (
                      <img src={org.logoUrl} alt={org?.name || 'Logo'} className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                        {org?.name?.[0]?.toUpperCase() ?? 'S'}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-slate-900 leading-tight">{org?.name || 'Your Company'}</h2>
                      {org?.address && <p className="text-[11px] text-slate-500">{org.address}</p>}
                      <div className="flex flex-wrap gap-x-3 mt-1">
                        {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                        {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                        {org?.website && <span className="text-[11px] text-indigo-500">{org.website}</span>}
                      </div>
                      {(org?.rcNumber || org?.vatNumber) && (
                        <div className="flex gap-3 mt-1">
                          {org?.rcNumber && <span className="text-[10px] text-slate-400">RC: {org.rcNumber}</span>}
                          {org?.vatNumber && <span className="text-[10px] text-slate-400">VAT: {org.vatNumber}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0 space-y-1">
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Payment Receipt</p>
                    <p className="text-2xl font-black text-slate-900 tracking-tight">{payment.paymentNumber}</p>
                    <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Received
                    </span>
                  </div>
                </div>

                {/* From / Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-6 border-y border-slate-100">
                  <div className="sm:col-span-2 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Received From</p>
                    <p className="text-sm font-bold text-slate-900">{cust?.name || payment.payerName || '—'}</p>
                    {cust?.address && <p className="text-[11px] text-slate-500">{cust.address}</p>}
                    {cust?.city    && <p className="text-[11px] text-slate-500">{cust.city}{cust?.state ? `, ${cust.state}` : ''}</p>}
                    {cust?.country && <p className="text-[11px] text-slate-500">{cust.country}</p>}
                    <div className="flex flex-wrap gap-x-3 mt-1">
                      {cust?.phone && <span className="text-[11px] text-slate-500">{cust.phone}</span>}
                      {cust?.email && <span className="text-[11px] text-slate-500">{cust.email}</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Receipt Details</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex sm:justify-end gap-2">
                        <span className="text-slate-400 w-24 sm:w-auto">Date</span>
                        <span className="font-medium text-slate-700">{fmtDate(payment.date)}</span>
                      </div>
                      <div className="flex sm:justify-end gap-2">
                        <span className="text-slate-400 w-24 sm:w-auto">Method</span>
                        <span className="font-medium text-slate-700">{meta?.label}</span>
                      </div>
                      {payment.reference && (
                        <div className="flex sm:justify-end gap-2">
                          <span className="text-slate-400 w-24 sm:w-auto">Reference</span>
                          <span className="font-medium text-slate-700 font-mono">{payment.reference}</span>
                        </div>
                      )}
                      {invoiceNumbers.length > 0 && (
                        <div className="flex sm:justify-end gap-2">
                          <span className="text-slate-400 w-24 sm:w-auto">Invoice{invoiceNumbers.length > 1 ? 's' : ''}</span>
                          <span className="font-medium text-slate-700 font-mono">{invoiceNumbers.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount Received</p>
                  <p className="text-3xl font-black text-emerald-700 font-mono tracking-tight">{formatNaira(payment.amount)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{payment.currency}</p>
                </div>

                {payment.notes && (
                  <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1">Notes</p>
                    {payment.notes}
                  </div>
                )}

                <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                  {org?.name} · This receipt was generated electronically and confirms the payment recorded above.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

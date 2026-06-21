/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, bankingApi } from '../../lib/api';
import {
  Search, Loader2, AlertCircle, CreditCard,
  Banknote, Smartphone, Building2, Receipt, Trash2, X, FileText, ChevronRight, Download,
  Plus, Pencil, Gift, ShoppingBag,
} from 'lucide-react';
import { RecordPaymentDrawer } from '../../components/sales/RecordPaymentDrawer';

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

interface InvoiceLine {
  id: string;
  invoiceId: string;
  itemId: string | null;
  description: string | null;
  quantity: string;
  unitPrice: number;
  discountPct: string | null;
  taxRate: string | null;
  taxAmount: number;
  lineTotal: number;
  accountId: string | null;
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
  lines: InvoiceLine[];
  customer: Customer;
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

const METHOD_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  bank_transfer: { label: 'Bank Transfer', icon: Building2 },
  cash:          { label: 'Cash',          icon: Banknote },
  card:          { label: 'Card',          icon: CreditCard },
  cheque:        { label: 'Cheque',        icon: Receipt },
  pos:           { label: 'POS',           icon: CreditCard },
  ussd:          { label: 'USSD',          icon: Smartphone },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:   { label: 'Draft',           className: 'bg-slate-100 text-slate-600' },
  sent:    { label: 'Sent',            className: 'bg-blue-50 text-blue-600' },
  paid:    { label: 'Paid',            className: 'bg-emerald-50 text-emerald-700' },
  partial: { label: 'Partially Paid',  className: 'bg-amber-50 text-amber-700' },
  overdue: { label: 'Overdue',         className: 'bg-rose-50 text-rose-600' },
  void:    { label: 'Void',            className: 'bg-slate-100 text-slate-400' },
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PaymentsReceivedPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sales_invoice' | 'other_income'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [otherIncomeModalOpen, setOtherIncomeModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Payment | null>(null);

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

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers || []).forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || 'Failed to delete payment.'),
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (payments || []).filter(p => {
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!term) return true;
      const cust = p.customerId ? customerMap.get(p.customerId) : undefined;
      return (
        p.paymentNumber.toLowerCase().includes(term) ||
        (cust?.name || '').toLowerCase().includes(term) ||
        (p.payerName || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term)
      );
    });
  }, [payments, searchTerm, methodFilter, customerMap]);

  const totals = useMemo(() => {
    const count = filtered.length;
    const sum = filtered.reduce((s, p) => s + p.amount, 0);
    return { count, sum };
  }, [filtered]);

  const methods = useMemo(() => {
    const s = new Set((payments || []).map(p => p.paymentMethod));
    return Array.from(s);
  }, [payments]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments Received</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totals.count} payments · {formatNaira(totals.sum)} total received
          </p>
        </div>
        <button
          onClick={() => setShowCategoryPicker(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition shadow-sm"
        >
          <Plus size={16} />
          New Payment
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
              const d = new Date(p.date);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).reduce((s, p) => s + p.amount, 0))}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Count</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{(payments || []).length} payments</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            categoryFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}>
          All Receipts
        </button>
        <button onClick={() => setCategoryFilter('sales_invoice')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            categoryFilter === 'sales_invoice' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}>
          Sales (Invoices)
        </button>
        <button onClick={() => setCategoryFilter('other_income')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            categoryFilter === 'other_income' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}>
          Other Income
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setMethodFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            methodFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}>
          All Methods
        </button>
        {methods.map(m => (
          <button key={m} onClick={() => setMethodFilter(m)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              methodFilter === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
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
            <p className="text-xs text-slate-400 mt-1">Payments recorded against invoices will appear here.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Payment #</th>
                <th className="py-2.5 pr-3">Source</th>
                <th className="py-2.5 pr-3">Customer / Payer</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Method</th>
                <th className="py-2.5 pr-3">Reference</th>
                <th className="py-2.5 pr-3 text-right">Amount</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => {
                const cust = p.customerId ? customerMap.get(p.customerId) : undefined;
                const meta = METHOD_META[p.paymentMethod] || { label: p.paymentMethod, icon: Banknote };
                const Icon = meta.icon;
                const isSales = p.category === 'sales_invoice';
                return (
                  <tr
                    key={p.id}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPaymentId(p.id)}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{p.paymentNumber}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        isSales ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isSales ? <ShoppingBag size={11} /> : <Gift size={11} />}
                        {isSales ? 'Sales' : 'Other Income'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="text-sm font-medium text-slate-800">{cust?.name || p.payerName || '—'}</p>
                      {cust?.email && <p className="text-xs text-slate-400">{cust.email}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(p.date)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500 font-mono">{p.reference || '—'}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-emerald-700 font-mono">
                      {formatNaira(p.amount)}
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center justify-end gap-1">
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          {isSales && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setReceiptPaymentId(p.id); }}
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              title="Download receipt">
                              <Download size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditTarget(p); }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Edit payment">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteError(null); }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete payment">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={6} className="py-2.5 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {filtered.length} payments shown
                </td>
                <td className="py-2.5 pr-3 text-right font-bold text-slate-800 font-mono">
                  {formatNaira(totals.sum)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Reverse Payment</h2>
            <p className="text-sm text-slate-500 mb-4">
              Reverse <span className="font-medium text-slate-700">{deleteTarget.paymentNumber}</span> ({formatNaira(deleteTarget.amount)})?
              This will restore the invoice balance due and reverse the journal entries.
            </p>
            {deleteError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">{deleteError}</div>
            )}
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

      <PaymentDetailPanel
        paymentId={selectedPaymentId}
        onClose={() => setSelectedPaymentId(null)}
        onDownload={(id) => setReceiptPaymentId(id)}
        customerMap={customerMap}
      />

      <ReceiptModal
        paymentId={receiptPaymentId}
        onClose={() => setReceiptPaymentId(null)}
        customerMap={customerMap}
        org={org}
      />

      {showCategoryPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Record New Payment</h2>
              <button onClick={() => setShowCategoryPicker(false)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">What kind of payment is this?</p>
            <div className="space-y-2">
              <button
                onClick={() => { setShowCategoryPicker(false); setRecordDrawerOpen(true); }}
                className="w-full flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/40 transition text-left"
              >
                <ShoppingBag size={18} className="text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Sales Invoice Payment</p>
                  <p className="text-xs text-slate-500 mt-0.5">Apply a customer's payment against one or more outstanding invoices.</p>
                </div>
              </button>
              <button
                onClick={() => { setShowCategoryPicker(false); setOtherIncomeModalOpen(true); }}
                className="w-full flex items-start gap-3 p-4 border border-slate-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/40 transition text-left"
              >
                <Gift size={18} className="text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Other Income Receipt</p>
                  <p className="text-xs text-slate-500 mt-0.5">Record income that didn't pass through an invoice — e.g. fixed asset sales, donations, or grants.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <RecordPaymentDrawer
        isOpen={recordDrawerOpen}
        onClose={() => setRecordDrawerOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] })}
      />

      <OtherIncomeModal
        isOpen={otherIncomeModalOpen}
        onClose={() => setOtherIncomeModalOpen(false)}
        customers={customers || []}
      />

      <EditPaymentModal
        payment={editTarget}
        onClose={() => setEditTarget(null)}
        customers={customers || []}
      />
    </div>
  );
}

function PaymentDetailPanel({
  paymentId,
  onClose,
  onDownload,
  customerMap,
}: {
  paymentId: string | null;
  onClose: () => void;
  onDownload: (paymentId: string) => void;
  customerMap: Map<string, Customer>;
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

  // Fetch each allocated invoice via useQueries (handles a dynamic number of queries safely,
  // unlike calling useQuery in a .map() which breaks React's rules of hooks).
  const invoiceQueries = useQueries({
    queries: invoiceIds.map(invId => ({
      queryKey: ['sales', 'invoices', invId],
      queryFn: async () => { const r = await api.get(`/sales/invoices/${invId}`); return r.data as InvoiceDetail; },
      enabled: !!invId,
    })),
  });

  const invoicesById = useMemo(() => {
    const m = new Map<string, InvoiceDetail>();
    invoiceQueries.forEach(q => { if (q.data) m.set(q.data.id, q.data); });
    return m;
  }, [invoiceQueries]);

  if (!paymentId) return null;

  const cust = payment ? (payment.customerId ? customerMap.get(payment.customerId) : undefined) : undefined;
  const meta = payment ? (METHOD_META[payment.paymentMethod] || { label: payment.paymentMethod, icon: Banknote }) : null;
  const Icon = meta?.icon;
  const invoicesLoading = invoiceQueries.some(q => q.isLoading);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Payment Details</h2>
          <div className="flex items-center gap-1">
            {paymentId && payment?.category === 'sales_invoice' && (
              <button
                onClick={() => onDownload(paymentId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md"
                title="Download receipt">
                <Download size={14} />
                Download
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {paymentLoading || !payment ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" />Loading payment...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Payment summary */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{payment.paymentNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(payment.date)}</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700 font-mono">{formatNaira(payment.amount)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
                      {payment.category === 'sales_invoice' ? 'Customer' : 'Payer'}
                    </p>
                    <p className="font-medium text-slate-800">{cust?.name || payment.payerName || '—'}</p>
                    {cust?.email && <p className="text-xs text-slate-400">{cust.email}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Method</p>
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
                      {meta?.label}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Reference</p>
                    <p className="font-mono text-slate-700">{payment.reference || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Source</p>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      payment.category === 'sales_invoice' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {payment.category === 'sales_invoice' ? 'Sales' : 'Other Income'}
                    </span>
                  </div>
                </div>
                {payment.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Notes</p>
                    <p className="text-sm text-slate-600">{payment.notes}</p>
                  </div>
                )}
              </div>

              {/* Linked invoices (sales receipts only) */}
              {payment.category === 'sales_invoice' && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" />
                  Applied to Invoice{invoiceIds.length > 1 ? 's' : ''}
                </h3>

                {invoicesLoading ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 size={16} className="animate-spin mr-2" />Loading invoice...
                  </div>
                ) : invoiceIds.length === 0 ? (
                  <p className="text-sm text-slate-400">No allocations found for this payment.</p>
                ) : (
                  <div className="space-y-4">
                    {(payment.allocations || []).map(alloc => {
                      const inv = invoicesById.get(alloc.invoiceId);
                      if (!inv) return null;
                      const statusMeta = STATUS_META[inv.status] || { label: inv.status, className: 'bg-slate-100 text-slate-600' };
                      return (
                        <div key={alloc.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="flex items-start justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <div>
                              <p className="font-mono text-sm font-semibold text-slate-800">{inv.invoiceNumber}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Issued {fmtDate(inv.date)} · Due {fmtDate(inv.dueDate)}
                              </p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </div>

                          <div className="px-4 py-3">
                            {inv.lines && inv.lines.length > 0 && (
                              <table className="w-full text-sm mb-3">
                                <thead>
                                  <tr className="text-xs text-slate-400 uppercase tracking-wide">
                                    <th className="text-left pb-1.5 font-medium">Item</th>
                                    <th className="text-right pb-1.5 font-medium">Qty</th>
                                    <th className="text-right pb-1.5 font-medium">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {inv.lines.map(line => (
                                    <tr key={line.id}>
                                      <td className="py-1.5 text-slate-700">{line.description || '—'}</td>
                                      <td className="py-1.5 text-right text-slate-500">{line.quantity}</td>
                                      <td className="py-1.5 text-right font-mono text-slate-700">{formatNaira(line.lineTotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                              <span className="text-slate-500">Invoice Total</span>
                              <span className="font-mono font-medium text-slate-800">{formatNaira(inv.total)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-slate-500">Applied from this payment</span>
                              <span className="font-mono font-medium text-emerald-700">{formatNaira(alloc.amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-slate-500">Balance Due</span>
                              <span className={`font-mono font-semibold ${inv.balanceDue > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                {formatNaira(inv.balanceDue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Income account (other income receipts only) */}
              {payment.category === 'other_income' && (
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                    <Gift size={14} />
                    Non-Invoice Income
                  </h3>
                  <p className="text-xs text-amber-700/80">
                    This receipt was not applied to a sales invoice. It was posted directly to the organisation's income ledger.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReceiptModal({
  paymentId,
  onClose,
  customerMap,
  org,
}: {
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

  const cust = payment ? (payment.customerId ? customerMap.get(payment.customerId) : undefined) : undefined;
  const meta = payment ? (METHOD_META[payment.paymentMethod] || { label: payment.paymentMethod, icon: Banknote }) : null;
  const isLoading = paymentLoading || invoiceQueries.some(q => q.isLoading);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4 py-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Non-printing toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 print:hidden">
          <h2 className="text-base font-semibold text-slate-900">Payment Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50"
            >
              <Download size={14} />
              Download PDF
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

                {/* Header: company identity + receipt meta */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
                  <div className="flex flex-col items-start gap-2">
                    {org?.logoUrl ? (
                      <img src={org.logoUrl} alt={org?.name || 'Logo'} className="w-14 h-14 rounded-xl object-contain border border-slate-100 bg-white p-1" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                        {org?.name?.[0]?.toUpperCase() ?? 'S'}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-slate-900 leading-tight tracking-tight">{org?.name || 'Your Company'}</h2>
                      <div className="flex flex-col gap-y-0 mt-0.5">
                        {org?.address && <span className="text-[11px] text-slate-500 leading-snug">{org.address}</span>}
                      </div>
                      <div className="flex flex-col gap-y-0 mt-1">
                        {org?.phone && <span className="text-[11px] text-slate-500">{org.phone}</span>}
                        {org?.email && <span className="text-[11px] text-slate-500">{org.email}</span>}
                        {org?.website && <span className="text-[11px] text-slate-500">{org.website}</span>}
                      </div>
                      {(org?.vatNumber || org?.rcNumber) && (
                        <div className="flex flex-col gap-y-0 mt-1">
                          {org?.rcNumber && <span className="text-[10px] text-slate-400">RC No: {org.rcNumber}</span>}
                          {org?.vatNumber && <span className="text-[10px] text-slate-400">VAT No: {org.vatNumber}</span>}
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

                {/* Received From / Receipt Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-6 border-y border-slate-100">
                  <div className="sm:col-span-2 space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Received From</p>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{cust?.name || '—'}</p>
                    <div className="flex flex-col gap-y-0 mt-0.5">
                      {cust?.address && <span className="text-[11px] text-slate-500 leading-snug">{cust.address}</span>}
                      {cust?.city && <span className="text-[11px] text-slate-500 leading-snug">{cust.city}</span>}
                      {cust?.state && <span className="text-[11px] text-slate-500 leading-snug">{cust.state}</span>}
                      {cust?.country && <span className="text-[11px] text-slate-500 leading-snug">{cust.country}</span>}
                    </div>
                    <div className="flex flex-col gap-y-0 mt-1">
                      {cust?.phone && <span className="text-[11px] text-slate-500">{cust.phone}</span>}
                      {cust?.email && <span className="text-[11px] text-slate-500">{cust.email}</span>}
                    </div>
                  </div>
                  <div className="space-y-2 sm:text-right">
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
                  This receipt was generated electronically and confirms the payment recorded above.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface GLAccount { id: string; code: string; name: string; type: string; }

/**
 * Modal for recording income that does NOT pass through a sales invoice —
 * e.g. proceeds from a fixed asset disposal, a donation, or a grant.
 */
function OtherIncomeModal({
  isOpen,
  onClose,
  customers,
}: {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
}) {
  const queryClient = useQueryClient();
  const [payerType, setPayerType] = useState<'customer' | 'name'>('name');
  const [customerId, setCustomerId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [accountId, setAccountId] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: bankAccounts } = useQuery<any[]>({
    queryKey: ['banking', 'accounts'],
    queryFn: () => bankingApi.getAccounts(),
    enabled: isOpen,
  });

  const { data: glAccounts } = useQuery<GLAccount[]>({
    queryKey: ['banking', 'gl-accounts'],
    queryFn: () => bankingApi.getGLAccounts(),
    enabled: isOpen,
  });

  const incomeAccounts = useMemo(
    () => (glAccounts || []).filter(a => a.type === 'revenue'),
    [glAccounts]
  );

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      reset();
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to record receipt.'),
  });

  const reset = () => {
    setPayerType('name');
    setCustomerId('');
    setPayerName('');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setPaymentMethod('bank_transfer');
    setReference('');
    setAccountId('');
    setIncomeAccountId('');
    setNotes('');
    setError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = () => {
    const amt = Math.round(parseFloat(amount || '0') * 100);
    if (amt <= 0) { setError('Enter a valid amount.'); return; }
    if (!accountId) { setError('Select which account received the funds.'); return; }
    if (!incomeAccountId) { setError('Select an income category for this receipt.'); return; }
    if (payerType === 'customer' && !customerId) { setError('Select a customer.'); return; }
    if (payerType === 'name' && !payerName.trim()) { setError('Enter a payer name.'); return; }

    setError(null);
    createMutation.mutate({
      category: 'other_income',
      customerId: payerType === 'customer' ? customerId : null,
      payerName: payerType === 'name' ? payerName.trim() : null,
      date,
      amount: amt,
      paymentMethod,
      reference: reference || null,
      accountId,
      incomeAccountId,
      notes: notes || null,
      allocations: [],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Gift size={16} className="text-amber-600" />
            Other Income Receipt
          </h2>
          <button onClick={() => { reset(); onClose(); }} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Who paid?</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setPayerType('name')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${payerType === 'name' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Free-text payer
              </button>
              <button
                onClick={() => setPayerType('customer')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${payerType === 'customer' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Existing customer
              </button>
            </div>
            {payerType === 'name' ? (
              <input
                type="text"
                value={payerName}
                onChange={e => setPayerName(e.target.value)}
                placeholder="e.g. Lagos State Ministry of Health (Grant)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            ) : (
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₦)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="pos">POS</option>
                <option value="ussd">USSD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reference (optional)</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. TXN-00231"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Deposited Into</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Select account...</option>
                {(bankAccounts || []).map((acc: any) => (
                  <option key={acc.id} value={acc.accountId}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Income Category</label>
              <select
                value={incomeAccountId}
                onChange={e => setIncomeAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Select income type...</option>
                {incomeAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {incomeAccounts.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No revenue accounts found — add one in your Chart of Accounts (e.g. "Other Income", "Gain on Asset Disposal", "Donations & Grants").</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={() => { reset(); onClose(); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving...' : 'Record Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Edit modal for an existing payment received — works for both sales_invoice and
 * other_income categories. Amount/allocation edits are intentionally simple: changing
 * the amount on a sales_invoice payment does not re-run allocation logic automatically,
 * so the allocations total should be adjusted by deleting and re-recording for non-trivial
 * re-allocations. This modal focuses on the fields safe to edit directly: date, method,
 * reference, deposit account, income category/payer, and notes.
 */
function EditPaymentModal({
  payment,
  onClose,
  customers,
}: {
  payment: Payment | null;
  onClose: () => void;
  customers: Customer[];
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [accountId, setAccountId] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [payerName, setPayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: bankAccounts } = useQuery<any[]>({
    queryKey: ['banking', 'accounts'],
    queryFn: () => bankingApi.getAccounts(),
    enabled: !!payment,
  });

  const { data: glAccounts } = useQuery<GLAccount[]>({
    queryKey: ['banking', 'gl-accounts'],
    queryFn: () => bankingApi.getGLAccounts(),
    enabled: !!payment && payment.category === 'other_income',
  });

  const incomeAccounts = useMemo(
    () => (glAccounts || []).filter(a => a.type === 'revenue'),
    [glAccounts]
  );

  React.useEffect(() => {
    if (payment) {
      setDate(new Date(payment.date).toISOString().split('T')[0]);
      setPaymentMethod(payment.paymentMethod);
      setReference(payment.reference || '');
      setAccountId(payment.accountId);
      setIncomeAccountId(payment.incomeAccountId || '');
      setCustomerId(payment.customerId || '');
      setPayerName(payment.payerName || '');
      setNotes(payment.notes || '');
      setError(null);
    }
  }, [payment]);

  const updateMutation = useMutation({
    mutationFn: (patch: any) => api.patch(`/sales/payments/${payment!.id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'payments'] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || 'Failed to update payment.'),
  });

  if (!payment) return null;

  const isSales = payment.category === 'sales_invoice';

  const handleSubmit = () => {
    if (!accountId) { setError('Select which account received the funds.'); return; }
    if (!isSales && !incomeAccountId) { setError('Select an income category.'); return; }
    if (!isSales && !customerId && !payerName.trim()) { setError('Provide a payer name or customer.'); return; }

    setError(null);
    updateMutation.mutate({
      date,
      paymentMethod,
      reference: reference || null,
      accountId,
      incomeAccountId: isSales ? null : incomeAccountId,
      customerId: isSales ? payment.customerId : (customerId || null),
      payerName: isSales ? null : (payerName.trim() || null),
      notes: notes || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Pencil size={16} className="text-slate-500" />
            Edit Payment {payment.paymentNumber}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            Amount ({formatNaira(payment.amount)}) and invoice allocations can't be edited here — delete and re-record the
            payment if those need to change. Everything else below can be updated freely.
          </div>

          {!isSales && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Payer</label>
              <input
                type="text"
                value={payerName}
                onChange={e => { setPayerName(e.target.value); setCustomerId(''); }}
                placeholder="Free-text payer name"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 mb-2"
              />
              <select
                value={customerId}
                onChange={e => { setCustomerId(e.target.value); if (e.target.value) setPayerName(''); }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">— or pick an existing customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="pos">POS</option>
                <option value="ussd">USSD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Deposited Into</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {(bankAccounts || []).map((acc: any) => (
                  <option key={acc.id} value={acc.accountId}>{acc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!isSales && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Income Category</label>
              <select
                value={incomeAccountId}
                onChange={e => setIncomeAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Select income type...</option>
                {incomeAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-indigo-600 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

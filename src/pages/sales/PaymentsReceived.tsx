/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Search, Loader2, AlertCircle, CreditCard,
  Banknote, Smartphone, Building2, Receipt, Trash2, X, FileText, ChevronRight,
} from 'lucide-react';

interface Payment {
  id: string;
  orgId: string;
  paymentNumber: string;
  customerId: string;
  date: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string | null;
  accountId: string;
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

interface Customer { id: string; name: string; email: string | null; }

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
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const { data: payments, isLoading, isError } = useQuery<Payment[]>({
    queryKey: ['sales', 'payments'],
    queryFn: async () => { const r = await api.get('/sales/payments'); return r.data; },
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
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
      if (!term) return true;
      const cust = customerMap.get(p.customerId);
      return (
        p.paymentNumber.toLowerCase().includes(term) ||
        (cust?.name || '').toLowerCase().includes(term) ||
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
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Method</th>
                <th className="py-2.5 pr-3">Reference</th>
                <th className="py-2.5 pr-3 text-right">Amount</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => {
                const cust = customerMap.get(p.customerId);
                const meta = METHOD_META[p.paymentMethod] || { label: p.paymentMethod, icon: Banknote };
                const Icon = meta.icon;
                return (
                  <tr
                    key={p.id}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPaymentId(p.id)}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{p.paymentNumber}</td>
                    <td className="py-2.5 pr-3">
                      <p className="text-sm font-medium text-slate-800">{cust?.name || '—'}</p>
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
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); setDeleteError(null); }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Reverse payment">
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
                <td colSpan={5} className="py-2.5 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
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
        customerMap={customerMap}
      />
    </div>
  );
}

function PaymentDetailPanel({
  paymentId,
  onClose,
  customerMap,
}: {
  paymentId: string | null;
  onClose: () => void;
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

  const cust = payment ? customerMap.get(payment.customerId) : undefined;
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
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
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
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Customer</p>
                    <p className="font-medium text-slate-800">{cust?.name || '—'}</p>
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
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Currency</p>
                    <p className="text-slate-700">{payment.currency}</p>
                  </div>
                </div>
                {payment.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Notes</p>
                    <p className="text-sm text-slate-600">{payment.notes}</p>
                  </div>
                )}
              </div>

              {/* Linked invoices */}
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}

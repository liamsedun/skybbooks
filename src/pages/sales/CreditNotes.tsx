/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Search, Loader2, AlertCircle, X, Plus, FileMinus, ChevronRight,
  Ban, CheckCircle2, ReceiptText,
} from 'lucide-react';

interface Customer { id: string; name: string; email: string | null; }

interface CreditNote {
  id: string;
  orgId: string;
  cnNumber: string;
  customerId: string;
  invoiceId: string | null;
  date: string;
  status: 'draft' | 'issued' | 'applied' | 'void';
  subtotal: number;
  tax: number;
  total: number;
  remainingCredit: number;
  notes: string | null;
  journalEntryId: string | null;
  createdAt: string;
  customer?: Customer | null;
  invoiceNumber?: string | null;
  invoice?: any;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  balanceDue: number;
  status: string;
  date: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft:   { label: 'Draft',   className: 'bg-slate-100 text-slate-500' },
  issued:  { label: 'Issued',  className: 'bg-amber-50 text-amber-700' },
  applied: { label: 'Applied', className: 'bg-emerald-50 text-emerald-700' },
  void:    { label: 'Void',    className: 'bg-slate-100 text-slate-400' },
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CreditNotesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<CreditNote | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: notes, isLoading, isError } = useQuery<CreditNote[]>({
    queryKey: ['sales', 'credit-notes'],
    queryFn: async () => { const r = await api.get('/sales/credit-notes'); return r.data; },
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/credit-notes/${id}/void`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'credit-notes'] });
      setVoidTarget(null);
    },
    onError: (e: any) => setActionError(e?.response?.data?.error || 'Failed to void credit note.'),
  });

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (notes || []).filter(n => {
      if (statusFilter !== 'all' && n.status !== statusFilter) return false;
      if (!term) return true;
      return (
        n.cnNumber.toLowerCase().includes(term) ||
        (n.customer?.name || '').toLowerCase().includes(term) ||
        (n.invoiceNumber || '').toLowerCase().includes(term)
      );
    });
  }, [notes, searchTerm, statusFilter]);

  const totals = useMemo(() => {
    const totalIssued = (notes || []).reduce((s, n) => s + n.total, 0);
    const totalOutstanding = (notes || []).filter(n => n.status !== 'void').reduce((s, n) => s + n.remainingCredit, 0);
    return { count: (notes || []).length, totalIssued, totalOutstanding };
  }, [notes]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client Credit Notes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Issue and apply credit notes against customer invoices for returns, disputes, or VAT adjustments.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition shadow-sm"
        >
          <Plus size={16} />
          New Credit Note
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Credit Notes</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{totals.count}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Issued Value</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(totals.totalIssued)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Outstanding Credit</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatNaira(totals.totalOutstanding)}</p>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-4">
          <AlertCircle size={14} />
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'issued', 'applied', 'void'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}>
            {s === 'all' ? 'All' : STATUS_META[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by credit note number, customer, or invoice..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />Loading credit notes...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />Failed to load credit notes.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <FileMinus size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No active credit notes found on the ledger</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Open refunds or returns are reconciled directly with general invoice references.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-900 transition"
            >
              New Credit Note
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">CN #</th>
                <th className="py-2.5 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Invoice</th>
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="py-2.5 pr-3 text-right">Remaining</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(n => {
                const statusMeta = STATUS_META[n.status] || { label: n.status, className: 'bg-slate-100 text-slate-600' };
                return (
                  <tr
                    key={n.id}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-mono text-sm font-semibold text-slate-700">{n.cnNumber}</td>
                    <td className="py-2.5 pr-3">
                      <p className="text-sm font-medium text-slate-800">{n.customer?.name || '—'}</p>
                      {n.customer?.email && <p className="text-xs text-slate-400">{n.customer.email}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500 font-mono">{n.invoiceNumber || '—'}</td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(n.date)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 font-mono">{formatNaira(n.total)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-amber-600 font-mono">{formatNaira(n.remainingCredit)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center justify-end gap-1">
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          {n.status === 'issued' && n.remainingCredit === n.total && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setVoidTarget(n); }}
                              title="Void credit note"
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <CreateCreditNoteModal onClose={() => setShowCreateModal(false)} onError={setActionError} />
      )}

      {voidTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Void Credit Note</h2>
            <p className="text-sm text-slate-500 mb-4">
              Void <span className="font-medium text-slate-700">{voidTarget.cnNumber}</span> ({formatNaira(voidTarget.total)})?
              This reverses its ledger entry and makes it unusable. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setVoidTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => voidMutation.mutate(voidTarget.id)} disabled={voidMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {voidMutation.isPending ? 'Voiding...' : 'Void Credit Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailPanel
        creditNoteId={selectedId}
        onClose={() => setSelectedId(null)}
        onError={setActionError}
      />
    </div>
  );
}

function DetailPanel({
  creditNoteId,
  onClose,
  onError,
}: {
  creditNoteId: string | null;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyInvoiceId, setApplyInvoiceId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  const { data: note, isLoading } = useQuery<CreditNote>({
    queryKey: ['sales', 'credit-notes', creditNoteId],
    queryFn: async () => { const r = await api.get(`/sales/credit-notes/${creditNoteId}`); return r.data; },
    enabled: !!creditNoteId,
  });

  const { data: openInvoicesData } = useQuery<any>({
    queryKey: ['sales', 'invoices', 'by-customer', note?.customerId],
    queryFn: async () => {
      const r = await api.get('/sales/invoices', { params: { customerId: note?.customerId, limit: 100 } });
      return r.data;
    },
    enabled: !!note?.customerId && showApplyForm,
  });

  const openInvoices: Invoice[] = useMemo(() => {
    const list = openInvoicesData?.invoices || [];
    return list.filter((inv: Invoice) => inv.balanceDue > 0 && inv.status !== 'draft' && inv.status !== 'void');
  }, [openInvoicesData]);

  const applyMutation = useMutation({
    mutationFn: (payload: { invoiceId: string; amount: number }) =>
      api.post(`/sales/credit-notes/${creditNoteId}/apply`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'credit-notes', creditNoteId] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
      setShowApplyForm(false);
      setApplyInvoiceId('');
      setApplyAmount('');
    },
    onError: (e: any) => onError(e?.response?.data?.error || 'Failed to apply credit note.'),
  });

  if (!creditNoteId) return null;

  const statusMeta = note ? (STATUS_META[note.status] || { label: note.status, className: 'bg-slate-100 text-slate-600' }) : null;
  const canApply = note && note.status !== 'void' && note.remainingCredit > 0;

  const selectedInvoice = openInvoices.find(i => i.id === applyInvoiceId);
  const maxApplyAmount = note ? Math.min(note.remainingCredit, selectedInvoice?.balanceDue || note.remainingCredit) : 0;

  const handleApply = () => {
    onError(null);
    const amt = Math.round(parseFloat(applyAmount || '0') * 100);
    if (!applyInvoiceId) { onError('Select an invoice to apply this credit to.'); return; }
    if (amt <= 0) { onError('Enter a valid amount to apply.'); return; }
    if (amt > maxApplyAmount) { onError(`Amount exceeds the maximum applicable (${formatNaira(maxApplyAmount)}).`); return; }
    applyMutation.mutate({ invoiceId: applyInvoiceId, amount: amt });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Credit Note</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading || !note ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" />Loading credit note...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-700">{note.cnNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{fmtDate(note.date)}</p>
                  </div>
                  {statusMeta && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Customer</p>
                    <p className="font-medium text-slate-800">{note.customer?.name || '—'}</p>
                    {note.customer?.email && <p className="text-xs text-slate-400">{note.customer.email}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Originating Invoice</p>
                    <p className="font-mono text-slate-700">{note.invoice?.invoiceNumber || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Subtotal</p>
                  <p className="font-mono font-semibold text-slate-800">{formatNaira(note.subtotal)}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">VAT</p>
                  <p className="font-mono font-semibold text-slate-800">{formatNaira(note.tax)}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Total</p>
                  <p className="font-mono font-semibold text-slate-900">{formatNaira(note.total)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Remaining Credit</p>
                  <p className="text-lg font-bold text-amber-700 font-mono">{formatNaira(note.remainingCredit)}</p>
                </div>
                {canApply && !showApplyForm && (
                  <button
                    onClick={() => setShowApplyForm(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-slate-900 transition"
                  >
                    <ReceiptText size={14} />
                    Apply to Invoice
                  </button>
                )}
              </div>

              {showApplyForm && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">Apply Credit to an Invoice</h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Select Open Invoice</label>
                    <select
                      value={applyInvoiceId}
                      onChange={e => {
                        setApplyInvoiceId(e.target.value);
                        const inv = openInvoices.find(i => i.id === e.target.value);
                        if (inv) {
                          const amt = Math.min(note.remainingCredit, inv.balanceDue);
                          setApplyAmount((amt / 100).toFixed(2));
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="">Select invoice...</option>
                      {openInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — Balance Due: {formatNaira(inv.balanceDue)}
                        </option>
                      ))}
                    </select>
                    {openInvoices.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">No open invoices found for this customer.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount to Apply (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={applyAmount}
                      onChange={e => setApplyAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    <p className="text-xs text-slate-400 mt-1">Maximum applicable: {formatNaira(maxApplyAmount)}</p>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setShowApplyForm(false); setApplyInvoiceId(''); setApplyAmount(''); }}
                      className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applyMutation.isPending}
                      className="px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-slate-900 disabled:opacity-50"
                    >
                      {applyMutation.isPending ? 'Applying...' : 'Apply Credit'}
                    </button>
                  </div>
                </div>
              )}

              {note.notes && (
                <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Reason / Notes</p>
                  {note.notes}
                </div>
              )}

              {note.status === 'applied' && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} />
                  This credit note has been fully applied.
                </div>
              )}

              {note.status === 'void' && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                  <Ban size={14} />
                  This credit note has been voided and can no longer be applied.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CreateCreditNoteModal({ onClose, onError }: { onClose: () => void; onError: (msg: string | null) => void }) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [subtotal, setSubtotal] = useState('');
  const [taxRate, setTaxRate] = useState('7.5');
  const [reason, setReason] = useState('');

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const { data: customerInvoicesData } = useQuery<any>({
    queryKey: ['sales', 'invoices', 'by-customer', customerId],
    queryFn: async () => {
      const r = await api.get('/sales/invoices', { params: { customerId, limit: 100 } });
      return r.data;
    },
    enabled: !!customerId,
  });

  const customerInvoices: Invoice[] = useMemo(() => {
    const list = customerInvoicesData?.invoices || [];
    return list.filter((inv: Invoice) => inv.status !== 'draft' && inv.status !== 'void');
  }, [customerInvoicesData]);

  const subtotalKobo = Math.round(parseFloat(subtotal || '0') * 100);
  const taxKobo = Math.round(subtotalKobo * (parseFloat(taxRate || '0') / 100));
  const totalKobo = subtotalKobo + taxKobo;

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales/credit-notes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'credit-notes'] });
      onClose();
    },
    onError: (e: any) => onError(e?.response?.data?.error || 'Failed to create credit note.'),
  });

  const handleSubmit = () => {
    if (!customerId) { onError('Select a customer.'); return; }
    if (subtotalKobo <= 0) { onError('Enter a credit subtotal greater than zero.'); return; }
    onError(null);
    createMutation.mutate({
      customerId,
      invoiceId: invoiceId || null,
      date,
      subtotal: subtotalKobo,
      tax: taxKobo,
      notes: reason || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">New Credit Note</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
            <select
              value={customerId}
              onChange={e => { setCustomerId(e.target.value); setInvoiceId(''); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="">Select customer...</option>
              {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Originating Invoice (optional)</label>
            <select
              value={invoiceId}
              onChange={e => setInvoiceId(e.target.value)}
              disabled={!customerId}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">No specific invoice / general credit</option>
              {customerInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoiceNumber} — {formatNaira(inv.total)}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Linking an invoice is for reference only — apply this credit note to any open invoice once it's issued.
            </p>
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
              <label className="block text-xs font-medium text-slate-500 mb-1">VAT Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Credit Subtotal (₦, excl. VAT)</label>
            <input
              type="number"
              step="0.01"
              value={subtotal}
              onChange={e => setSubtotal(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Returned consignment — 12 units damaged on arrival"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono text-slate-700">{formatNaira(subtotalKobo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">VAT ({taxRate || 0}%)</span>
              <span className="font-mono text-slate-700">{formatNaira(taxKobo)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="font-semibold text-slate-700">Total Credit</span>
              <span className="font-mono font-bold text-slate-900">{formatNaira(totalKobo)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Issue Credit Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

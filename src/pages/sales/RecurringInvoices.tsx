/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Loader2, AlertCircle, X, Plus, Trash2, Play, Pause, Zap,
  Repeat, Calendar, FileText, ChevronRight,
} from 'lucide-react';

interface Customer { id: string; name: string; email: string | null; }

interface TemplateLine {
  itemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number; // kobo
  discountPct?: number;
  taxRate?: number;
  accountId?: string | null;
}

interface Template {
  lines: TemplateLine[];
  paymentTerms?: number;
  currency?: string;
  notes?: string | null;
  terms?: string | null;
  autoSend?: boolean;
}

interface GeneratedInvoiceSummary {
  id: string;
  invoiceNumber: string;
  total: number;
  date: string;
}

interface RecurringInvoice {
  id: string;
  orgId: string;
  customerId: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  isActive: boolean;
  template: Template;
  createdAt: string;
  customer?: Customer;
  generatedInvoices?: GeneratedInvoiceSummary[];
  generatedCount?: number;
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const emptyLine = (): TemplateLine => ({
  itemId: null,
  description: '',
  quantity: 1,
  unitPrice: 0,
  discountPct: 0,
  taxRate: 7.5,
  accountId: null,
});

export function RecurringInvoicesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringInvoice | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: templates, isLoading, isError } = useQuery<RecurringInvoice[]>({
    queryKey: ['sales', 'recurring-invoices'],
    queryFn: async () => { const r = await api.get('/sales/recurring-invoices'); return r.data; },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/sales/recurring-invoices/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales', 'recurring-invoices'] }),
    onError: (e: any) => setActionError(e?.response?.data?.error || 'Failed to update billing template.'),
  });

  const generateNowMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/recurring-invoices/${id}/generate-now`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'recurring-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: any) => setActionError(e?.response?.data?.error || 'Failed to generate invoice.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/recurring-invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'recurring-invoices'] });
      setDeleteTarget(null);
    },
    onError: (e: any) => setActionError(e?.response?.data?.error || 'Failed to delete billing template.'),
  });

  const activeCount = useMemo(() => (templates || []).filter(t => t.isActive).length, [templates]);
  const totalMonthlyValue = useMemo(() => {
    return (templates || [])
      .filter(t => t.isActive)
      .reduce((sum, t) => {
        const lineTotal = (t.template?.lines || []).reduce((s, l) => {
          const base = l.quantity * l.unitPrice;
          const disc = base * ((l.discountPct || 0) / 100);
          const afterDisc = base - disc;
          const tax = afterDisc * ((l.taxRate || 0) / 100);
          return s + afterDisc + tax;
        }, 0);
        return sum + lineTotal;
      }, 0);
  }, [templates]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring Billing Rules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage subscription tiers, automatic monthly client billing agreements, and retainer sequences.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition shadow-sm"
        >
          <Plus size={16} />
          Create Billing Template
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Active Templates</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Recurring Value Per Cycle</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatNaira(totalMonthlyValue)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Templates</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{(templates || []).length}</p>
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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />Loading billing templates...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-rose-500 text-sm">
            <AlertCircle size={16} />Failed to load billing templates.
          </div>
        ) : (templates || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Repeat size={28} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No active automated billing retainers found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Instantiate monthly client subscriptions to generate invoices automatically.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-900 transition"
            >
              Create Billing Template
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                <th className="py-2.5 pl-4 pr-3">Customer</th>
                <th className="py-2.5 pr-3">Frequency</th>
                <th className="py-2.5 pr-3">Next Run</th>
                <th className="py-2.5 pr-3">Generated</th>
                <th className="py-2.5 pr-3 text-right">Per-Cycle Value</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(templates || []).map(t => {
                const lineTotal = (t.template?.lines || []).reduce((s, l) => {
                  const base = l.quantity * l.unitPrice;
                  const disc = base * ((l.discountPct || 0) / 100);
                  const afterDisc = base - disc;
                  const tax = afterDisc * ((l.taxRate || 0) / 100);
                  return s + afterDisc + tax;
                }, 0);
                return (
                  <tr
                    key={t.id}
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(t.id)}
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <p className="text-sm font-medium text-slate-800">{t.customer?.name || '—'}</p>
                      {t.customer?.email && <p className="text-xs text-slate-400">{t.customer.email}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-slate-600">{FREQUENCY_LABEL[t.frequency] || t.frequency}</td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{fmtDate(t.nextRunDate)}</td>
                    <td className="py-2.5 pr-3 text-sm text-slate-500">{t.generatedCount ?? 0} invoices</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-700 font-mono">
                      {formatNaira(lineTotal)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center justify-end gap-1">
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); generateNowMutation.mutate(t.id); }}
                            disabled={!t.isActive || generateNowMutation.isPending}
                            title="Generate invoice now"
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleActiveMutation.mutate({ id: t.id, isActive: !t.isActive }); }}
                            title={t.isActive ? 'Pause' : 'Resume'}
                            className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          >
                            {t.isActive ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                            title="Delete template"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
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
          </table>
        )}
      </div>

      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onError={setActionError}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Delete Billing Template</h2>
            <p className="text-sm text-slate-500 mb-4">
              Delete the recurring billing template for{' '}
              <span className="font-medium text-slate-700">{deleteTarget.customer?.name || 'this customer'}</span>?
              Invoices already generated from it will not be affected.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DetailPanel templateId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function DetailPanel({ templateId, onClose }: { templateId: string | null; onClose: () => void }) {
  const { data: t, isLoading } = useQuery<RecurringInvoice>({
    queryKey: ['sales', 'recurring-invoices', templateId],
    queryFn: async () => { const r = await api.get(`/sales/recurring-invoices/${templateId}`); return r.data; },
    enabled: !!templateId,
  });

  if (!templateId) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Billing Template</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading || !t ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" />Loading template...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.customer?.name || '—'}</p>
                    {t.customer?.email && <p className="text-xs text-slate-400">{t.customer.email}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Frequency</p>
                    <p className="font-medium text-slate-700">{FREQUENCY_LABEL[t.frequency] || t.frequency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Next Run</p>
                    <p className="font-medium text-slate-700">{fmtDate(t.nextRunDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Start Date</p>
                    <p className="text-slate-700">{fmtDate(t.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">End Date</p>
                    <p className="text-slate-700">{fmtDate(t.endDate)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" />
                  Template Line Items
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase tracking-wide">
                      <th className="text-left pb-1.5 font-medium">Description</th>
                      <th className="text-right pb-1.5 font-medium">Qty</th>
                      <th className="text-right pb-1.5 font-medium">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(t.template?.lines || []).map((l, i) => (
                      <tr key={i}>
                        <td className="py-1.5 text-slate-700">{l.description || '—'}</td>
                        <td className="py-1.5 text-right text-slate-500">{l.quantity}</td>
                        <td className="py-1.5 text-right font-mono text-slate-700">{formatNaira(l.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  Generated Invoices
                </h3>
                {(t.generatedInvoices || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No invoices generated from this template yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {(t.generatedInvoices || []).map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="font-mono text-sm font-medium text-slate-700">{inv.invoiceNumber}</p>
                          <p className="text-xs text-slate-400">{fmtDate(inv.date)}</p>
                        </div>
                        <p className="font-mono text-sm font-semibold text-slate-800">{formatNaira(inv.total)}</p>
                      </div>
                    ))}
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

function CreateTemplateModal({ onClose, onError }: { onClose: () => void; onError: (msg: string | null) => void }) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TemplateLine[]>([emptyLine()]);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['sales', 'customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales/recurring-invoices', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'recurring-invoices'] });
      onClose();
    },
    onError: (e: any) => onError(e?.response?.data?.error || 'Failed to create billing template.'),
  });

  const updateLine = (idx: number, patch: Partial<TemplateLine>) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const total = useMemo(() => {
    return lines.reduce((s, l) => {
      const base = (l.quantity || 0) * (l.unitPrice || 0);
      const disc = base * ((l.discountPct || 0) / 100);
      const afterDisc = base - disc;
      const tax = afterDisc * ((l.taxRate || 0) / 100);
      return s + afterDisc + tax;
    }, 0);
  }, [lines]);

  const handleSubmit = () => {
    if (!customerId) { onError('Please select a customer.'); return; }
    if (lines.some(l => !l.description || l.quantity <= 0 || l.unitPrice < 0)) {
      onError('Each line item needs a description, quantity > 0, and a non-negative price.');
      return;
    }
    onError(null);
    createMutation.mutate({
      customerId,
      frequency,
      startDate,
      endDate: endDate || null,
      isActive: true,
      template: {
        lines: lines.map(l => ({
          ...l,
          unitPrice: Math.round(l.unitPrice * 100), // Naira -> kobo
        })),
        paymentTerms,
        currency: 'NGN',
        notes: notes || null,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-8">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Create Billing Template</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Select customer...</option>
                {(customers || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {Object.entries(FREQUENCY_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">End Date (optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Payment Terms (days)</label>
              <input
                type="number"
                value={paymentTerms}
                onChange={e => setPaymentTerms(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-slate-500">Line Items</label>
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                <Plus size={12} />Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Description"
                    value={line.description}
                    onChange={e => updateLine(idx, { description: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={e => updateLine(idx, { quantity: Number(e.target.value) })}
                    className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    type="number"
                    placeholder="Price (₦)"
                    value={line.unitPrice}
                    onChange={e => updateLine(idx, { unitPrice: Number(e.target.value) })}
                    className="w-28 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <input
                    type="number"
                    placeholder="Tax %"
                    value={line.taxRate}
                    onChange={e => updateLine(idx, { taxRate: Number(e.target.value) })}
                    className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <button
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    className="p-2 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
            <span className="text-slate-500">Per-cycle total</span>
            <span className="font-mono font-semibold text-slate-800">
              {formatNaira(Math.round(total * 100))}
            </span>
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
            {createMutation.isPending ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

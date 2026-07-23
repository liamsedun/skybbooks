import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import {
  Loader2, FileText, Download, Mail, RotateCcw, Plus, X, Search,
  Receipt, CreditCard, AlertCircle, CheckCircle2, Clock, DollarSign,
  Calendar, TrendingDown, TrendingUp, Ban, RefreshCw, BarChart3,
  BookOpen, Percent, Building2, Info
} from 'lucide-react';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  canceled: 'bg-surface-hover text-ink-500',
  refunded: 'bg-purple-100 text-purple-700',
  issued: 'bg-blue-100 text-blue-700',
  applied: 'bg-teal-100 text-teal-700',
  void: 'bg-surface-hover text-ink-500',
  success: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

function InvoiceDetailModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const { toast } = useToast();

  const emailMut = useMutation({
    mutationFn: () => subscriptionApi.emailBillingInvoice(invoice.id),
    onSuccess: () => toast('Invoice emailed!', 'success'),
    onError: (err: any) => toast(err?.response?.data?.error || 'Failed to email', 'error'),
  });

  const refundMut = useMutation({
    mutationFn: () => subscriptionApi.refundBillingInvoice(invoice.id, 'Customer requested'),
    onSuccess: () => { toast('Refund processed', 'success'); onClose(); },
    onError: (err: any) => toast(err?.response?.data?.error || 'Refund failed', 'error'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface border-b border-border-custom p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> {invoice.invoiceNumber}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1 text-sm">
              <p><span className="text-ink-500">Status:</span> <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status] || ''}`}>{invoice.status}</span></p>
              <p><span className="text-ink-500">Date:</span> {fmtDate(invoice.createdAt)}</p>
              <p><span className="text-ink-500">Due:</span> {fmtDate(invoice.dueDate)}</p>
              {invoice.periodStart && <p><span className="text-ink-500">Period:</span> {fmtDate(invoice.periodStart)} — {fmtDate(invoice.periodEnd)}</p>}
              {invoice.paidAt && <p><span className="text-ink-500">Paid:</span> {fmtDate(invoice.paidAt)}</p>}
            </div>
            <p className="text-2xl font-bold text-ink-900">{fmtNaira(invoice.totalKobo)}</p>
          </div>

          <p className="text-sm text-ink-600">{invoice.description}</p>

          {invoice.items?.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle">
                  <tr><th className="p-3 text-left font-medium text-ink-600">Item</th><th className="p-3 text-right font-medium text-ink-600">Qty</th><th className="p-3 text-right font-medium text-ink-600">Amount</th><th className="p-3 text-right font-medium text-ink-600">Tax</th><th className="p-3 text-right font-medium text-ink-600">Total</th></tr>
                </thead>
                <tbody>
                  {invoice.items.map((item: any, i: number) => (
                    <tr key={i} className="border-t border-border-custom">
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">{fmtNaira(item.amountKobo)}</td>
                      <td className="p-3 text-right">{fmtNaira(item.taxKobo)}</td>
                      <td className="p-3 text-right font-medium">{fmtNaira(item.totalKobo)}</td>
                    </tr>
                  ))}
                </tbody>
                {invoice.discountKobo > 0 && (
                  <tfoot><tr className="border-t"><td colSpan={4} className="p-3 text-right text-red-600 font-medium">Discount</td><td className="p-3 text-right text-red-600">-{fmtNaira(invoice.discountKobo)}</td></tr></tfoot>
                )}
                <tfoot><tr className="border-t-2 border-slate-300"><td colSpan={4} className="p-3 text-right font-bold">Total</td><td className="p-3 text-right font-bold">{fmtNaira(invoice.totalKobo)}</td></tr></tfoot>
              </table>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => subscriptionApi.downloadBillingInvoicePdf(invoice.id)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-700 bg-surface border border-slate-300 rounded-lg hover:bg-surface-hover">
              <Download className="w-4 h-4" /> PDF
            </button>
            <button onClick={() => emailMut.mutate()} disabled={emailMut.isPending} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-700 bg-surface border border-slate-300 rounded-lg hover:bg-surface-hover disabled:opacity-50">
              <Mail className="w-4 h-4" /> Email
            </button>
            {invoice.status === 'paid' && !invoice.refundedAt && (
              <button onClick={() => refundMut.mutate()} disabled={refundMut.isPending} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-surface border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> Refund
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionBillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = user?.organisationId;
  const [tab, setTab] = useState<'invoices' | 'credit-notes' | 'history' | 'tax'>('invoices');
  const [selectedInv, setSelectedInv] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [cnReason, setCnReason] = useState('');
  const [cnAmount, setCnAmount] = useState('');
  const [cnInvId, setCnInvId] = useState('');

  const { data: invoicesData, isLoading: invLoading, refetch: refetchInvoices } = useQuery<{ data: any[] }>({
    queryKey: ['billing-invoices', orgId],
    queryFn: () => subscriptionApi.listBillingInvoices({ status: filterStatus || undefined }),
    enabled: !!orgId,
  });

  const { data: cnData, isLoading: cnLoading } = useQuery<{ data: any[] }>({
    queryKey: ['billing-credit-notes', orgId],
    queryFn: () => subscriptionApi.listBillingCreditNotes(),
    enabled: !!orgId && tab === 'credit-notes',
  });

  const { data: historyData, isLoading: histLoading } = useQuery<{ data: any[] }>({
    queryKey: ['billing-history', orgId],
    queryFn: () => subscriptionApi.getBillingHistory(),
    enabled: !!orgId && tab === 'history',
  });

  const { data: taxData, isLoading: taxLoading, refetch: refetchTax } = useQuery<{ data: any[] }>({
    queryKey: ['billing-tax-rates', orgId],
    queryFn: () => subscriptionApi.getBillingTaxRates(),
    enabled: !!orgId && tab === 'tax',
  });

  const { data: outstandingData } = useQuery<{ data: { totalOutstanding: number; overdueCount: number; pendingInvoices: any[] } }>({
    queryKey: ['billing-outstanding', orgId],
    queryFn: () => subscriptionApi.getBillingOutstanding(),
    enabled: !!orgId,
  });

  const queryClient = useQueryClient();

  const createCnMut = useMutation({
    mutationFn: () => subscriptionApi.createBillingCreditNote({ invoiceId: cnInvId || undefined, reason: cnReason, amountKobo: parseInt(cnAmount) * 100 }),
    onSuccess: () => { toast('Credit note issued', 'success'); setCnReason(''); setCnAmount(''); setCnInvId(''); queryClient.invalidateQueries({ queryKey: ['billing-credit-notes'] }); },
    onError: (err: any) => toast(err?.response?.data?.error || 'Failed to create credit note', 'error'),
  });

  const createTaxMut = useMutation({
    mutationFn: (data: { name: string; rate: number; type?: string; isDefault?: boolean }) => subscriptionApi.saveBillingTaxRate(data),
    onSuccess: () => { toast('Tax rate saved', 'success'); refetchTax(); },
    onError: (err: any) => toast(err?.response?.data?.error || 'Failed to save tax rate', 'error'),
  });

  const invoices = invoicesData?.data || [];
  const creditNotes = cnData?.data || [];
  const history = historyData?.data || [];
  const taxRates = taxData?.data || [];
  const outstanding = outstandingData?.data;

  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [newTaxDefault, setNewTaxDefault] = useState(false);

  const loading = invLoading;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" /> Billing
          </h1>
          <p className="text-sm text-ink-500 mt-1">Subscription invoices, credit notes, and billing history</p>
        </div>
      </div>

      {/* Outstanding bar */}
      {outstanding && outstanding.totalOutstanding > 0 && (
        <div className={`rounded-xl border p-4 ${outstanding.overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {outstanding.overdueCount > 0 ? <AlertCircle className="w-5 h-5 text-red-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
              <span className="font-semibold text-ink-900">
                {fmtNaira(outstanding.totalOutstanding)} outstanding
                {outstanding.overdueCount > 0 && ` (${outstanding.overdueCount} overdue)`}
              </span>
            </div>
            <span className="text-sm text-ink-500">{outstanding.pendingInvoices.length} pending invoice{(outstanding.pendingInvoices.length !== 1) && 's'}</span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface rounded-xl border border-border-custom p-4">
          <FileText className="w-5 h-5 text-indigo-600 mb-1" />
          <p className="text-2xl font-bold text-ink-900">{invoices.length}</p>
          <p className="text-xs text-ink-500">Total Invoices</p>
        </div>
        <div className="bg-surface rounded-xl border border-border-custom p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
          <p className="text-2xl font-bold text-ink-900">{invoices.filter(i => i.status === 'paid').length}</p>
          <p className="text-xs text-ink-500">Paid</p>
        </div>
        <div className="bg-surface rounded-xl border border-border-custom p-4">
          <AlertCircle className="w-5 h-5 text-amber-600 mb-1" />
          <p className="text-2xl font-bold text-ink-900">{invoices.filter(i => i.status === 'pending').length}</p>
          <p className="text-xs text-ink-500">Pending</p>
        </div>
        <div className="bg-surface rounded-xl border border-border-custom p-4">
          <RotateCcw className="w-5 h-5 text-purple-600 mb-1" />
          <p className="text-2xl font-bold text-ink-900">{creditNotes.length}</p>
          <p className="text-xs text-ink-500">Credit Notes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-hover p-1 rounded-xl w-fit flex-wrap">
        {(['invoices', 'credit-notes', 'history', 'tax'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
            {t === 'invoices' && <FileText className="w-4 h-4 inline mr-1.5" />}
            {t === 'credit-notes' && <RotateCcw className="w-4 h-4 inline mr-1.5" />}
            {t === 'history' && <Clock className="w-4 h-4 inline mr-1.5" />}
            {t === 'tax' && <Percent className="w-4 h-4 inline mr-1.5" />}
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {['', 'pending', 'paid', 'overdue', 'refunded', 'canceled'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterStatus === s ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-surface text-ink-600 border-border-custom'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-ink-400"><FileText className="w-10 h-10 mx-auto mb-2" /><p>No invoices found.</p></div>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id} onClick={() => setSelectedInv(inv)}
                  className="bg-surface rounded-xl border border-border-custom p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-surface-subtle">
                      <FileText className="w-5 h-5 text-ink-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink-900">{inv.invoiceNumber}</p>
                      <p className="text-xs text-ink-500">{fmtDate(inv.createdAt)} {inv.description ? `— ${inv.description}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status] || ''}`}>
                      {inv.status}
                    </span>
                    <span className="font-semibold text-ink-900">{fmtNaira(inv.totalKobo)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Credit Notes Tab */}
      {tab === 'credit-notes' && (
        <div className="space-y-4">
          <details className="bg-surface rounded-xl border border-border-custom">
            <summary className="p-4 font-medium text-sm text-ink-700 cursor-pointer flex items-center gap-2 hover:bg-surface-hover rounded-xl">
              <Plus className="w-4 h-4" /> Issue Credit Note
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              <input value={cnInvId} onChange={e => setCnInvId(e.target.value)} placeholder="Invoice ID (optional)" className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
              <textarea value={cnReason} onChange={e => setCnReason(e.target.value)} placeholder="Reason" className="w-full p-2 border border-slate-300 rounded-lg text-sm" rows={2} />
              <div className="flex gap-2">
                <input value={cnAmount} onChange={e => setCnAmount(e.target.value)} type="number" placeholder="Amount in Naira" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm" />
                <button onClick={() => createCnMut.mutate()} disabled={createCnMut.isPending || !cnReason}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {createCnMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Issue'}
                </button>
              </div>
            </div>
          </details>

          {cnLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : creditNotes.length === 0 ? (
            <div className="text-center py-12 text-ink-400"><RotateCcw className="w-10 h-10 mx-auto mb-2" /><p>No credit notes.</p></div>
          ) : (
            <div className="space-y-2">
              {creditNotes.map((cn: any) => (
                <div key={cn.id} className="bg-surface rounded-xl border border-border-custom p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{cn.creditNoteNumber}</p>
                    <p className="text-xs text-ink-500">{cn.reason} — {fmtDate(cn.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[cn.status] || ''}`}>{cn.status}</span>
                    <span className="font-semibold text-red-600">-{fmtNaira(cn.totalKobo)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <>
          {histLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <div className="space-y-1">
              {history.map((item: any, i: number) => (
                <div key={`${item.type}-${item.id}-${i}`} className="bg-surface rounded-xl border border-border-custom p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.type === 'payment' ? 'bg-emerald-50' : item.type === 'credit_note' ? 'bg-purple-50' : 'bg-surface-subtle'}`}>
                      {item.type === 'payment' ? <CreditCard className="w-4 h-4 text-emerald-600" /> : item.type === 'credit_note' ? <RotateCcw className="w-4 h-4 text-purple-600" /> : <FileText className="w-4 h-4 text-ink-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-ink-900">{item.number}</p>
                      <p className="text-xs text-ink-500">{item.description} — {fmtDate(item.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[item.status] || ''}`}>{item.status}</span>
                    <span className="font-semibold text-ink-900">{item.type === 'credit_note' ? '-' : ''}{fmtNaira(item.totalKobo)}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 && <div className="text-center py-12 text-ink-400"><Clock className="w-10 h-10 mx-auto mb-2" /><p>No billing history.</p></div>}
            </div>
          )}
        </>
      )}

      {/* Tax Tab */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-border-custom p-5">
            <h3 className="font-semibold text-ink-900 mb-4 flex items-center gap-2"><Percent className="w-5 h-5 text-indigo-600" /> Tax Rates</h3>
            {taxLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <div className="space-y-2 mb-4">
                {taxRates.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-surface-subtle rounded-lg">
                    <div>
                      <span className="font-medium text-sm text-ink-900">{r.name}</span>
                      <span className="text-xs text-ink-500 ml-2">{(r.rate / 100).toFixed(1)}%</span>
                      {r.isDefault && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">Default</span>}
                    </div>
                    <span className="text-xs text-ink-400 capitalize">{r.type}</span>
                  </div>
                ))}
                {taxRates.length === 0 && <p className="text-sm text-ink-400">No tax rates configured.</p>}
              </div>
            )}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-ink-700 mb-2">Add Tax Rate</h4>
              <div className="flex gap-2 flex-wrap">
                <input value={newTaxName} onChange={e => setNewTaxName(e.target.value)} placeholder="Name (e.g. VAT 7.5%)" className="flex-1 min-w-[160px] p-2 border border-slate-300 rounded-lg text-sm" />
                <input value={newTaxRate} onChange={e => setNewTaxRate(e.target.value)} type="number" placeholder="Rate (e.g. 750 = 7.5%)" className="w-32 p-2 border border-slate-300 rounded-lg text-sm" />
                <label className="flex items-center gap-1.5 text-sm text-ink-600">
                  <input type="checkbox" checked={newTaxDefault} onChange={e => setNewTaxDefault(e.target.checked)} className="w-4 h-4 rounded border-slate-300" /> Default
                </label>
                <button onClick={() => {
                  if (!newTaxName || !newTaxRate) return toast('Fill in name and rate', 'error');
                  createTaxMut.mutate({ name: newTaxName, rate: parseInt(newTaxRate) * 100, type: 'vat', isDefault: newTaxDefault });
                  setNewTaxName(''); setNewTaxRate(''); setNewTaxDefault(false);
                }} disabled={createTaxMut.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border-custom p-5">
            <h3 className="font-semibold text-ink-900 mb-2 flex items-center gap-2"><Info className="w-5 h-5 text-indigo-600" /> Proration Calculator</h3>
            <ProrationCalculator />
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInv && <InvoiceDetailModal invoice={selectedInv} onClose={() => setSelectedInv(null)} />}
    </div>
  );
}

function ProrationCalculator() {
  const [oldPrice, setOldPrice] = useState('100000');
  const [newPrice, setNewPrice] = useState('200000');
  const [daysRemaining, setDaysRemaining] = useState('15');
  const [result, setResult] = useState<{ creditKobo: number; chargeKobo: number; netKobo: number } | null>(null);
  const [calculating, setCalculating] = useState(false);

  const calc = async () => {
    setCalculating(true);
    try {
      const res = await subscriptionApi.calculateBillingProration({
        oldMonthlyKobo: parseInt(oldPrice) * 100, newMonthlyKobo: parseInt(newPrice) * 100,
        daysRemaining: parseInt(daysRemaining), daysInPeriod: 30,
      });
      setResult(res.data);
    } catch { /* ignore */ }
    setCalculating(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-ink-500">Old price (₦)</label><input value={oldPrice} onChange={e => setOldPrice(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" /></div>
        <div><label className="text-xs text-ink-500">New price (₦)</label><input value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" /></div>
        <div><label className="text-xs text-ink-500">Days remaining</label><input value={daysRemaining} onChange={e => setDaysRemaining(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" /></div>
      </div>
      <button onClick={calc} disabled={calculating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
        {calculating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Calculate'}
      </button>
      {result && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="p-3 bg-red-50 rounded-lg"><p className="text-red-600 font-medium">Credit</p><p className="text-lg font-bold">{fmtNaira(result.creditKobo)}</p></div>
          <div className="p-3 bg-emerald-50 rounded-lg"><p className="text-emerald-600 font-medium">Charge</p><p className="text-lg font-bold">{fmtNaira(result.chargeKobo)}</p></div>
          <div className={`p-3 rounded-lg ${result.netKobo >= 0 ? 'bg-amber-50' : 'bg-blue-50'}`}><p className={`font-medium ${result.netKobo >= 0 ? 'text-amber-600' : 'text-blue-600'}`}>Net</p><p className={`text-lg font-bold ${result.netKobo >= 0 ? 'text-amber-700' : 'text-blue-700'}`}>{fmtNaira(Math.abs(result.netKobo))} {result.netKobo >= 0 ? '(charge)' : '(credit)'}</p></div>
        </div>
      )}
    </div>
  );
}

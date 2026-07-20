import React, { useState, useEffect } from 'react';
import { CreditCard, Package, Users, HardDrive, Calendar, Check, X, AlertCircle, ChevronRight, History, Download, ExternalLink, Zap, Shield, Crown, Loader2, Building2, Globe, Headphones, FileText, Repeat, Banknote, PieChart, Brain, FileSearch, Star, Tag } from 'lucide-react';
import { subscriptionApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
function fmtNaira(v: number): string {
  const abs = Math.abs(v);
  const naira = Math.floor(abs / 100);
  const kobo = abs % 100;
  const formatted = naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  return (v < 0 ? '-₦' : '₦') + formatted;
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const limitFields = [
  { key: 'userLimit', label: 'Users', icon: Users },
  { key: 'maxCompanies', label: 'Companies', icon: Building2 },
  { key: 'storageLimitGb', label: 'Storage (GB)', icon: HardDrive },
  { key: 'apiRequests', label: 'API Requests', icon: Zap },
  { key: 'maxCustomers', label: 'Customers', icon: Users },
  { key: 'maxVendors', label: 'Vendors', icon: Users },
  { key: 'maxProducts', label: 'Products', icon: Package },
  { key: 'maxInvoices', label: 'Invoices', icon: FileText },
  { key: 'maxTransactions', label: 'Transactions', icon: Repeat },
  { key: 'maxBankAccounts', label: 'Bank Accounts', icon: Banknote },
  { key: 'maxProjects', label: 'Projects', icon: PieChart },
  { key: 'maxAiRequests', label: 'AI Requests', icon: Brain },
  { key: 'maxOcrDocuments', label: 'OCR Documents', icon: FileSearch },
];

export function SubscriptionPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [confirmChangePlan, setConfirmChangePlan] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [subData, plansData, invData] = await Promise.all([
        subscriptionApi.getMySubscription(),
        subscriptionApi.listPlans(true),
        subscriptionApi.listInvoices(),
      ]);
      setSubscription(subData);
      setPlans(plansData);
      setInvoices(invData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleChangePlan(planId: string) {
    if (!subscription) return;
    setChanging(true);
    try {
      await subscriptionApi.changePlan(subscription.id, { planId, prorate: true });
      setShowChangePlan(false);
      setConfirmChangePlan(null);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Plan changed successfully' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to change plan' } }));
    } finally { setChanging(false); }
  }

  async function handleCancel() {
    if (!subscription) return;
    if (!confirm('Are you sure you want to cancel your subscription? Your subscription will remain active until the end of the current billing period.')) return;
    setCancelling(true);
    try {
      await subscriptionApi.cancelSubscription(subscription.id, true);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Subscription cancelled. It will remain active until the end of the billing period.' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to cancel subscription' } }));
    } finally { setCancelling(false); }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700',
      trialing: 'bg-blue-50 text-blue-700',
      canceled: 'bg-slate-100 text-slate-600',
      past_due: 'bg-red-50 text-red-600',
      incomplete: 'bg-amber-50 text-amber-700',
    };
    const labels: Record<string, string> = {
      active: 'Active',
      trialing: 'Trialing',
      canceled: 'Canceled',
      past_due: 'Past Due',
      incomplete: 'Incomplete',
    };
    return <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colors[status] || 'bg-neutral-100 text-neutral-600'}`}>{labels[status] || status}</span>;
  };

  const invStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-emerald-50 text-emerald-700',
      overdue: 'bg-red-50 text-red-600',
      pending: 'bg-amber-50 text-amber-700',
      canceled: 'bg-slate-100 text-slate-600',
      refunded: 'bg-purple-50 text-purple-700',
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || 'bg-neutral-100 text-neutral-600'}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const plan = plans.find((p: any) => p.id === subscription?.planId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Subscription & Billing</h1>
          {subscription && statusBadge(subscription.status)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Plan</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{plan?.name || subscription?.planName || '—'}</p>
              {plan && (
                <p className="text-sm text-slate-600 mt-0.5">{fmtNaira(plan.monthlyPriceKobo)} /mo</p>
              )}
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <button onClick={() => setShowChangePlan(true)} className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            Change Plan <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${subscription?.status === 'active' || subscription?.status === 'trialing' ? 'bg-emerald-500' : subscription?.status === 'past_due' ? 'bg-red-500' : subscription?.status === 'canceled' ? 'bg-slate-400' : 'bg-amber-500'}`} />
                <p className="text-lg font-semibold text-slate-900 capitalize">{subscription?.status || 'Unknown'}</p>
              </div>
              {subscription?.trialEnd && new Date(subscription.trialEnd) > new Date() && (
                <p className="text-xs text-slate-500 mt-1">{Math.ceil((new Date(subscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining in trial</p>
              )}
            </div>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Shield className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Users</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{subscription?.usedSeats ?? 0} / {plan?.userLimit ?? '∞'}</p>
              <p className="text-xs text-slate-500 mt-0.5">Active team members</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Storage</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {plan?.storageLimitGb ?? 0} GB
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((subscription?.usedStorageMb ?? 0) / 1024 / Math.max((plan?.storageLimitGb ?? 1), 1)) * 100)}%` }} />
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Plan Details */}
      {plan && (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Plan Details — {plan.name}</h2>
            {plan.popularBadge && <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><Crown className="w-3 h-3" /> Popular</span>}
            {plan.recommendedBadge && !plan.popularBadge && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><Star className="w-3 h-3" /> Recommended</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-600 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-slate-400" /> Monthly Price</span>
                <span className="text-sm font-semibold text-slate-900">{fmtNaira(plan.monthlyPriceKobo)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-600 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-slate-400" /> Annual Price</span>
                <span className="text-sm font-semibold text-slate-900">{plan.annualPriceKobo > 0 ? fmtNaira(plan.annualPriceKobo) : '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-600 flex items-center gap-1.5"><Globe className="w-4 h-4 text-slate-400" /> Currency</span>
                <span className="text-sm font-semibold text-slate-900">{plan.currency}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-600 flex items-center gap-1.5"><Headphones className="w-4 h-4 text-slate-400" /> Support</span>
                <span className="text-sm font-semibold text-slate-900 capitalize">{plan.supportLevel}</span>
              </div>
            </div>
            <div className="space-y-2">
              {plan.trialDays > 0 && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-sm text-slate-600 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Trial Period</span>
                  <span className="text-sm font-semibold text-slate-900">{plan.trialDays} days</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-600 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Next Billing Date</span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(subscription?.currentPeriodEnd)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="text-sm text-slate-600 flex items-center gap-1.5"><Shield className="w-4 h-4 text-slate-400" /> Auto Renew</span>
                <span className={`text-sm font-semibold ${subscription?.canceledAt ? 'text-red-500' : 'text-emerald-600'}`}>
                  {subscription?.canceledAt ? 'Disabled' : 'Enabled'}
                </span>
              </div>
              {plan.buttonText && (
                <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                  <span className="text-sm text-slate-600 flex items-center gap-1.5"><Tag className="w-4 h-4 text-slate-400" /> Button</span>
                  <span className="text-sm font-semibold text-slate-900">{plan.buttonText}</span>
                </div>
              )}
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-900 mb-3">Feature Limits</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {limitFields.map(f => (
              <div key={f.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                <f.icon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600">{f.label}:</span>
                <span className="text-xs font-semibold text-slate-900 ml-auto">
                  {(plan as any)[f.key] === 0 ? '∞' : ((plan as any)[f.key]?.toLocaleString() || '0')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!changing) { setShowChangePlan(false); setConfirmChangePlan(null); } } }>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Change Plan</h3>
              <button onClick={() => { setShowChangePlan(false); setConfirmChangePlan(null); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            {confirmChangePlan ? (
              <div className="p-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">Are you sure you want to switch to this plan? Any adjustments will be prorated for the current billing period.</p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setConfirmChangePlan(null)} disabled={changing} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                  <button onClick={() => handleChangePlan(confirmChangePlan)} disabled={changing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                    {changing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {plans.filter((p: any) => p.id !== subscription?.planId).length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No other plans available</p>
                ) : (
                  plans.filter((p: any) => p.id !== subscription?.planId).map((p: any) => (
                    <button key={p.id} onClick={() => setConfirmChangePlan(p.id)} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{p.name}</p>
                          <p className="text-sm text-slate-500 mt-0.5">{fmtNaira(p.monthlyPriceKobo)} /mo</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 mt-0.5" />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{p.userLimit} users</span>
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{p.storageLimitGb} GB</span>
                        {p.maxCustomers > 0 && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{p.maxCustomers.toLocaleString()} customers</span>}
                        {p.supportLevel && <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full capitalize">{p.supportLevel} support</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice History */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Invoice History</h2>
        </div>

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Invoice #</th>
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Period</th>
                  <th className="text-right font-medium text-slate-500 pb-3 pr-4">Amount</th>
                  <th className="text-center font-medium text-slate-500 pb-3 pr-4">Status</th>
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Date</th>
                  <th className="text-right font-medium text-slate-500 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{inv.invoiceNumber || inv.id?.slice(0, 8)}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-slate-900">{fmtNaira(inv.totalKobo || inv.amountKobo)}</td>
                    <td className="py-3 pr-4 text-center">{invStatusBadge(inv.status)}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatDate(inv.createdAt)}</td>
                    <td className="py-3 text-right">
                      {inv.invoiceUrl && (
                        <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                          <Download className="w-3.5 h-3.5" /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Calendar className="w-10 h-10 mb-2" />
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-xs mt-0.5">Invoices will appear here after your first billing cycle</p>
          </div>
        )}
      </div>

      {/* Cancel Section */}
      <div className="rounded-xl bg-white shadow-sm border border-red-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-slate-900">Danger Zone</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">Cancel your subscription. Your data will be preserved and you can resubscribe at any time.</p>
        <button onClick={handleCancel} disabled={cancelling || subscription?.status === 'canceled'} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">
          {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
          {subscription?.status === 'canceled' ? 'Already Canceled' : 'Cancel Subscription'}
        </button>
      </div>
    </div>
  );
}

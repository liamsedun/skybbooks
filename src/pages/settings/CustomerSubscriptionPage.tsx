import React, { useState, useEffect } from 'react';
import { CreditCard, Check, X, Loader2, Crown, Star, Headphones, FileText, Calendar, ArrowRight, RefreshCw, Clock, AlertTriangle, ChevronDown, ChevronUp, Download, ExternalLink } from 'lucide-react';
import { customerSubscriptionApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

function fmtNaira(v: number): string {
  const abs = Math.abs(v);
  const naira = Math.floor(abs / 100);
  const kobo = abs % 100;
  const formatted = naira.toLocaleString('en-US') + '.' + String(kobo).padStart(2, '0');
  return (v < 0 ? '-₦' : '₦') + formatted;
}

function formatDate(d: string | Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const limitLabels: Record<string, string> = {
  userLimit: 'Users', maxCustomers: 'Customers', maxVendors: 'Vendors',
  maxProducts: 'Products', maxInvoices: 'Invoices', maxTransactions: 'Transactions',
  maxBankAccounts: 'Bank Accounts', storageLimitGb: 'Storage (GB)',
};

export function CustomerSubscriptionPage() {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [showInvoices, setShowInvoices] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [subRes, plansRes, invRes] = await Promise.all([
        customerSubscriptionApi.getCurrent().catch(() => ({ data: null })),
        customerSubscriptionApi.listPlans(),
        customerSubscriptionApi.getInvoices().catch(() => ({ data: [] })),
      ]);
      setSubscription(subRes.data);
      setPlans(plansRes.data || []);
      setInvoices(invRes.data || []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load subscription data';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePlan(planId: string) {
    if (!subscription?.id) {
      toast('No active subscription to change.', 'warning');
      return;
    }
    if (!confirm('Are you sure you want to switch to this plan?')) return;
    setChangingPlan(planId);
    try {
      await customerSubscriptionApi.changePlan({ subscriptionId: subscription.id, planId, prorate: true });
      toast('Plan changed successfully', 'success');
      loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to change plan';
      toast(msg, 'error');
    } finally {
      setChangingPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-ink-400 animate-spin" />
      </div>
    );
  }

  const badgeColors: Record<string, string> = {
    community: 'bg-neutral-100 text-neutral-600',
    email: 'bg-blue-50 text-blue-700',
    priority: 'bg-purple-50 text-purple-700',
    dedicated: 'bg-amber-50 text-amber-700',
  };

  const statusBadge: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    free_trial: 'bg-amber-50 text-amber-700',
    grace_period: 'bg-orange-50 text-orange-700',
    past_due: 'bg-red-50 text-red-700',
    cancelled: 'bg-neutral-100 text-neutral-500',
    expired: 'bg-neutral-100 text-neutral-500',
  };

  const currentPlanId = subscription?.plan?.id || subscription?.planId;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-900">Subscription & Billing</h1>
        <p className="text-sm text-ink-500 mt-1">Manage your plan and view billing history.</p>
      </div>

      {!subscription ? (
        <div className="bg-white border border-border-custom rounded-2xl p-8 text-center">
          <CreditCard className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-ink-900 mb-1">No Active Subscription</h2>
          <p className="text-sm text-ink-500 mb-6">Choose a plan below to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-border-custom rounded-2xl p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-bold text-ink-900">{subscription.plan?.name || 'Current Plan'}</h2>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusBadge[subscription.status] || 'bg-neutral-100 text-neutral-600'}`}>
                  {subscription.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-ink-500">{subscription.plan?.description}</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-ink-900">{fmtNaira(subscription.plan?.monthlyPriceKobo || 0)}</div>
              <div className="text-xs text-ink-400">/month</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-ink-600 border-t border-border-custom pt-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-ink-400" />
              <span>Started {formatDate(subscription.currentPeriodStart)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-ink-400" />
              <span>Renews {formatDate(subscription.currentPeriodEnd)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ink-400" />
              <span>Billing: {subscription.billingCycle || subscription.plan?.billingCycle || 'Monthly'}</span>
            </div>
          </div>
          {subscription.trialDays > 0 && subscription.status === 'free_trial' && (
            <div className="flex items-center gap-2 mt-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Trial ends {formatDate(subscription.currentPeriodEnd)}
            </div>
          )}
          {subscription.plan && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-4 border-t border-border-custom pt-4">
              {Object.entries(limitLabels).map(([key, label]) => {
                const val = (subscription.plan as any)[key];
                return (
                  <div key={key} className="flex items-center justify-between text-xs text-ink-600">
                    <span>{label}</span>
                    <span className="font-semibold text-ink-800">{val === 0 ? 'Unlimited' : val?.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold text-ink-900 mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {plans.filter(p => p.isActive && !p.isArchived).map(plan => {
          const isCurrentPlan = plan.id === currentPlanId;
          return (
            <div key={plan.id} className={`bg-white border rounded-2xl overflow-hidden flex flex-col relative transition-all ${isCurrentPlan ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-border-custom hover:shadow-sm'}`}>
              {plan.popularBadge && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full z-10">
                  <Crown className="w-3 h-3" /> Popular
                </div>
              )}
              {plan.recommendedBadge && !plan.popularBadge && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full z-10">
                  <Star className="w-3 h-3" /> Recommended
                </div>
              )}
              <div className="p-5 flex-1">
                <h3 className="text-base font-semibold text-ink-900 mb-1">{plan.name}</h3>
                {plan.description && <p className="text-xs text-ink-500 mb-3 line-clamp-2">{plan.description}</p>}
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-xl font-bold text-ink-900">{fmtNaira(plan.monthlyPriceKobo)}</span>
                  <span className="text-xs text-ink-400">/mo</span>
                </div>
                {plan.annualPriceKobo > 0 && (
                  <p className="text-xs text-ink-500 mb-2">{fmtNaira(plan.annualPriceKobo)}/yr</p>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-600">
                  {Object.entries(limitLabels).slice(0, 6).map(([key, label]) => {
                    const val = (plan as any)[key];
                    return (
                      <div key={key} className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>{label}: <strong>{val === 0 ? 'Unlimited' : val?.toLocaleString()}</strong></span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {plan.trialDays > 0 && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{plan.trialDays}-day trial</span>
                  )}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColors[plan.supportLevel] || 'bg-neutral-100 text-neutral-600'}`}>
                    <Headphones className="w-2.5 h-2.5 inline mr-0.5" />
                    {plan.supportLevel}
                  </span>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-border-custom">
                {isCurrentPlan ? (
                  <span className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 w-full py-2 rounded-xl">
                    <Check className="w-3.5 h-3.5" /> Current Plan
                  </span>
                ) : (
                  <button
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={changingPlan !== null}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-ink-900 hover:bg-ink-800 disabled:opacity-50 w-full py-2 rounded-xl transition-colors"
                  >
                    {changingPlan === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    {changingPlan === plan.id ? 'Switching...' : 'Switch to this plan'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {invoices.length > 0 && (
        <div className="bg-white border border-border-custom rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowInvoices(!showInvoices)}
            className="w-full flex items-center justify-between p-4 hover:bg-surface-subtle/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-ink-400" />
              <span className="font-semibold text-ink-900 text-sm">Billing History</span>
              <span className="text-xs text-ink-400">({invoices.length} invoices)</span>
            </div>
            {showInvoices ? <ChevronUp className="w-4 h-4 text-ink-400" /> : <ChevronDown className="w-4 h-4 text-ink-400" />}
          </button>
          {showInvoices && (
            <div className="border-t border-border-custom">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-subtle/30 text-left text-xs text-ink-500">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Paid At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="text-ink-700">
                      <td className="px-4 py-2.5 text-xs">{formatDate(inv.createdAt)}</td>
                      <td className="px-4 py-2.5 text-xs">{inv.description || inv.status || 'Invoice'}</td>
                      <td className="px-4 py-2.5 text-xs font-medium">{fmtNaira(inv.amountKobo || inv.totalKobo || 0)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                          inv.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          inv.status === 'overdue' ? 'bg-red-50 text-red-700' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>
                          {inv.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-500">{inv.paidAt ? formatDate(inv.paidAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

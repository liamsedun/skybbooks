import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Package, Download, RefreshCw, Send, Loader2, Check, X, AlertCircle, ChevronDown, ChevronUp, Plus, Trash2, Zap, BarChart3, ReceiptText, Clock, Calendar, Tag, DollarSign, Shield, Users, Building2, HardDrive, Globe, FileText, Wallet, Banknote, Percent, Gift, RotateCcw, ArrowLeftRight, Layers, ExternalLink } from 'lucide-react';
import { subscriptionApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const POLL_INTERVAL = 30000; // 30s real-time polling

type Tab = 'overview' | 'plans' | 'invoices' | 'usage' | 'addons' | 'settings';

const FEATURE_KEYS: Record<string, { label: string; icon: any; limitKey: string }> = {
  maxUsers: { label: 'Users', icon: Users, limitKey: 'maxUsers' },
  maxCompanies: { label: 'Companies', icon: Building2, limitKey: 'maxCompanies' },
  storageLimitGb: { label: 'Storage (GB)', icon: HardDrive, limitKey: 'storageLimitGb' },
  maxCustomers: { label: 'Customers', icon: Users, limitKey: 'maxCustomers' },
  maxVendors: { label: 'Vendors', icon: Building2, limitKey: 'maxVendors' },
  maxProducts: { label: 'Products', icon: Package, limitKey: 'maxProducts' },
  maxInvoices: { label: 'Invoices', icon: FileText, limitKey: 'maxInvoices' },
  maxTransactions: { label: 'Transactions', icon: ArrowLeftRight, limitKey: 'maxTransactions' },
  maxBankAccounts: { label: 'Bank Accounts', icon: Wallet, limitKey: 'maxBankAccounts' },
  maxProjects: { label: 'Projects', icon: Layers, limitKey: 'maxProjects' },
  apiRequests: { label: 'API Requests', icon: Globe, limitKey: 'apiRequests' },
  maxAiRequests: { label: 'AI Requests', icon: Zap, limitKey: 'maxAiRequests' },
  maxOcrDocuments: { label: 'OCR Documents', icon: FileText, limitKey: 'maxOcrDocuments' },
};

export function SubscriptionPortalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = user?.organisationId;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<any>({ subscription: null, plans: [], invoices: [], paymentHistory: [], usage: [], addons: [], entitlements: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [addonForm, setAddonForm] = useState({ name: '', description: '', priceKobo: 0, quantity: 1, billingCycle: 'monthly' });

  const loadDashboard = useCallback(async () => {
    try {
      const res = await subscriptionApi.getPortalDashboard();
      setData(res?.data || { subscription: null, plans: [], invoices: [], paymentHistory: [], usage: [], addons: [], entitlements: null });
    } catch { /* silent poll */ }
  }, []);

  useEffect(() => { loadDashboard().finally(() => setLoading(false)); }, [loadDashboard]);
  useEffect(() => { const iv = setInterval(loadDashboard, POLL_INTERVAL); return () => clearInterval(iv); }, [loadDashboard]);

  const sub = data.subscription;
  const plan = data.plans?.find((p: any) => p.id === sub?.planId);
  const nextPlan = data.plans?.find((p: any) => p.id === sub?.nextPlanId);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700', free_trial: 'bg-blue-50 text-blue-700',
      grace_period: 'bg-amber-50 text-amber-700', paused: 'bg-slate-50 text-slate-700',
      cancelled: 'bg-red-50 text-red-700', expired: 'bg-red-50 text-red-700',
      pending_payment: 'bg-amber-50 text-amber-700', failed_payment: 'bg-red-50 text-red-700',
      renewing: 'bg-indigo-50 text-indigo-700', downgraded: 'bg-yellow-50 text-yellow-700',
      upgraded: 'bg-blue-50 text-blue-700', suspended: 'bg-red-50 text-red-700',
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>{status.replace(/_/g, ' ')}</span>;
  };

  const performAction = async (action: string, fn: () => Promise<any>, successMsg: string) => {
    setActionLoading(action);
    try { await fn(); toast(successMsg, 'success'); loadDashboard(); }
    catch (err: any) { toast(err?.response?.data?.error || err.message, 'error'); }
    finally { setActionLoading(null); }
  };

  const handleChangeBillingCycle = async (cycle: string) => {
    await performAction('billing-cycle', () => subscriptionApi.changeBillingCycle(cycle), `Billing changed to ${cycle}`);
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return;
    setRedeemingCoupon(true);
    try {
      await subscriptionApi.redeemPortalCoupon(couponCode);
      toast(`Coupon "${couponCode}" applied!`, 'success');
      setShowCouponInput(false);
      setCouponCode('');
      loadDashboard();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Invalid coupon', 'error');
    } finally { setRedeemingCoupon(false); }
  };

  const handleRequestRefund = async () => {
    if (!showRefundModal || !refundReason.trim()) return;
    await performAction('refund', () => subscriptionApi.requestRefund(showRefundModal, refundReason), 'Refund requested');
    setShowRefundModal(null);
    setRefundReason('');
  };

  const handleAddAddon = async () => {
    await performAction('add-addon', () => subscriptionApi.createPortalAddon(addonForm), 'Add-on purchased');
    setShowAddonModal(false);
    setAddonForm({ name: '', description: '', priceKobo: 0, quantity: 1, billingCycle: 'monthly' });
  };

  const handleRemoveAddon = async (id: string) => {
    await performAction(`remove-addon-${id}`, () => subscriptionApi.removePortalAddon(id), 'Add-on removed');
  };

  const handleRenew = async () => {
    if (!sub) return;
    await performAction('renew', () => subscriptionApi.renewSubscription(sub.id), 'Subscription renewed');
  };

  const handleCancel = async (immediate: boolean) => {
    if (!sub) return;
    const fn = immediate ? subscriptionApi.cancelNow(sub.id) : subscriptionApi.cancelAtPeriodEnd(sub.id);
    await performAction('cancel', () => fn, immediate ? 'Cancelled immediately' : 'Cancelled — active until period end');
  };

  const handleChangePlan = async (planId: string) => {
    if (!sub) return;
    await performAction('change-plan', () => subscriptionApi.changePlan(sub.id, { planId }), 'Plan changed');
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
      activeTab === tab ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'
    }`;

  if (loading) return <div className="p-6 max-w-7xl mx-auto flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: CreditCard },
    { key: 'plans', label: 'Plans', icon: Package },
    { key: 'invoices', label: 'Invoices', icon: ReceiptText },
    { key: 'usage', label: 'Usage', icon: BarChart3 },
    { key: 'addons', label: 'Add-ons', icon: Layers },
    { key: 'settings', label: 'Settings', icon: Shield },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Subscription Portal</h1>
          <p className="text-xs text-slate-500">Manage your plan, billing, and usage in real time</p>
        </div>
        <button onClick={loadDashboard} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => { const Icon = t.icon; return (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={tabClass(t.key)}>
            <Icon className="w-4 h-4" /> {t.label}
          </button>
        );})}
      </div>

      {activeTab === 'overview' && <OverviewTab sub={sub} plan={plan} nextPlan={nextPlan} addons={data.addons} statusBadge={statusBadge} actionLoading={actionLoading} handleChangePlan={handleChangePlan} handleRenew={handleRenew} handleCancel={handleCancel} handleChangeBillingCycle={handleChangeBillingCycle} showCouponInput={showCouponInput} setShowCouponInput={setShowCouponInput} couponCode={couponCode} setCouponCode={setCouponCode} redeemingCoupon={redeemingCoupon} handleRedeemCoupon={handleRedeemCoupon} data={data} toast={toast} />}
      {activeTab === 'plans' && <PlansTab plans={data.plans} currentPlanId={sub?.planId} actionLoading={actionLoading} handleChangePlan={handleChangePlan} />}
      {activeTab === 'invoices' && <InvoicesTab invoices={data.invoices} paymentHistory={data.paymentHistory} showRefundModal={showRefundModal} setShowRefundModal={setShowRefundModal} refundReason={refundReason} setRefundReason={setRefundReason} handleRequestRefund={handleRequestRefund} />}
      {activeTab === 'usage' && <UsageTab usage={data.usage} entitlements={data.entitlements} />}
      {activeTab === 'addons' && <AddonsTab addons={data.addons} actionLoading={actionLoading} handleRemoveAddon={handleRemoveAddon} showAddonModal={showAddonModal} setShowAddonModal={setShowAddonModal} addonForm={addonForm} setAddonForm={setAddonForm} handleAddAddon={handleAddAddon} />}
      {activeTab === 'settings' && <SettingsTab sub={sub} />}
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({ sub, plan, nextPlan, addons, statusBadge, actionLoading, handleChangePlan, handleRenew, handleCancel, handleChangeBillingCycle, showCouponInput, setShowCouponInput, couponCode, setCouponCode, redeemingCoupon, handleRedeemCoupon, data, toast }: any) {
  const [showCancelOpts, setShowCancelOpts] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const addonsTotal = addons?.filter((a: any) => a.isActive)?.reduce((s: number, a: any) => s + Number(a.priceKobo) * Number(a.quantity), 0) || 0;

  if (!sub) return (
    <div className="text-center py-20 text-slate-400">
      <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
      <h2 className="text-lg font-semibold text-slate-600 mb-2">No Active Subscription</h2>
      <p className="text-sm mb-6">Choose a plan to get started.</p>
      <button onClick={() => setShowAllPlans(true)} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">View Plans</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><Package className="w-4 h-4 text-indigo-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Current Plan</p>
              <p className="text-sm font-semibold text-slate-900">{plan?.name || sub?.planId?.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">{statusBadge(sub.status)}</div>
          {nextPlan && <p className="text-xs text-amber-600 mt-2">Scheduled: {nextPlan.name}</p>}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Billing</p>
              <p className="text-sm font-semibold text-slate-900 capitalize">{sub.billingCycle || 'monthly'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => handleChangeBillingCycle(sub.billingCycle === 'monthly' ? 'annual' : 'monthly')} disabled={actionLoading === 'billing-cycle'}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Switch to {sub.billingCycle === 'monthly' ? 'Annual' : 'Monthly'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Calendar className="w-4 h-4 text-blue-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Period</p>
              <p className="text-sm font-semibold text-slate-900">{formatDate(sub.currentPeriodStart)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">to {formatDate(sub.currentPeriodEnd)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg"><CreditCard className="w-4 h-4 text-purple-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Payments</p>
              <p className="text-sm font-semibold text-slate-900">{data.paymentHistory?.length || 0}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">Last: {formatDate(sub.lastPaymentDate)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowAllPlans(true)} disabled={actionLoading === 'change-plan'}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {actionLoading === 'change-plan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />} Change Plan
          </button>
          <button onClick={handleRenew} disabled={actionLoading === 'renew' || sub.status !== 'active'}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40">
            {actionLoading === 'renew' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Renew
          </button>
          <button onClick={() => setShowCouponInput(!showCouponInput)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <Gift className="w-4 h-4" /> {sub.couponId ? 'Change Coupon' : 'Redeem Coupon'}
          </button>
          <button onClick={() => setShowCancelOpts(!showCancelOpts)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50">
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>

        {showCouponInput && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
            <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Enter coupon code"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            <button onClick={handleRedeemCoupon} disabled={redeemingCoupon || !couponCode.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {redeemingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Apply
            </button>
          </div>
        )}

        {showCancelOpts && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl space-y-3">
            <p className="text-sm text-red-700 font-medium">Cancel Subscription</p>
            <div className="flex gap-3">
              <button onClick={() => handleCancel(false)} disabled={actionLoading === 'cancel'}
                className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 disabled:opacity-50">
                At Period End</button>
              <button onClick={() => handleCancel(true)} disabled={actionLoading === 'cancel'}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                Cancel Now</button>
            </div>
          </div>
        )}
      </div>

      {/* Add-ons Summary */}
      {addons?.filter((a: any) => a.isActive)?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Active Add-ons</h3>
          <div className="space-y-2">
            {addons.filter((a: any) => a.isActive).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.name} × {a.quantity}</p>
                  {a.description && <p className="text-xs text-slate-500">{a.description}</p>}
                </div>
                <p className="text-sm font-mono text-slate-700">{fmtNaira(Number(a.priceKobo) * Number(a.quantity))}/mo</p>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-semibold text-sm">
              <span>Add-ons Total</span>
              <span>{fmtNaira(addonsTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plan Details */}
      {plan && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Plan Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailItem label="Plan" value={plan.name} />
            <DetailItem label="Monthly Price" value={plan.monthlyPriceKobo ? fmtNaira(plan.monthlyPriceKobo) : 'Free'} />
            <DetailItem label="Annual Price" value={plan.annualPriceKobo ? fmtNaira(plan.annualPriceKobo) : 'Free'} />
            <DetailItem label="Billing Cycle" value={sub.billingCycle || 'Monthly'} />
            <DetailItem label="Auto Renew" value={sub.autoRenew ? 'Yes' : 'No'} />
            <DetailItem label="Renewal Count" value={String(sub.renewalCount || 0)} />
            <DetailItem label="Period Start" value={formatDate(sub.currentPeriodStart)} />
            <DetailItem label="Period End" value={formatDate(sub.currentPeriodEnd)} />
            {sub.couponId && <DetailItem label="Coupon Applied" value="Yes" />}
            {sub.trialEnd && <DetailItem label="Trial Ends" value={formatDate(sub.trialEnd)} />}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium text-slate-900">{value}</p></div>;
}

// ── Plans Tab ──

function PlansTab({ plans, currentPlanId, actionLoading, handleChangePlan }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {plans?.map((p: any) => {
        const isCurrent = p.id === currentPlanId;
        return (
          <div key={p.id} className={`relative bg-white rounded-xl border-2 p-5 ${isCurrent ? 'border-indigo-500 shadow-md' : 'border-slate-200 hover:border-indigo-200'}`}>
            {p.popularBadge && <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-medium rounded-full">Popular</span>}
            <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
            <p className="text-xs text-slate-500 mb-3">{p.description}</p>
            <div className="mb-4">
              <p className="text-2xl font-bold text-slate-900">{fmtNaira(p.monthlyPriceKobo)}<span className="text-sm font-normal text-slate-500">/mo</span></p>
              {p.annualPriceKobo > 0 && <p className="text-xs text-slate-500">{fmtNaira(p.annualPriceKobo)}/yr</p>}
            </div>
            <ul className="space-y-1.5 mb-5 text-sm">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Up to {p.maxUsers || '∞'} users</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {p.maxCompanies || '∞'} companies</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {p.maxCustomers || '∞'} customers</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {p.storageLimitGb || '∞'}GB storage</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {p.supportLevel || 'Standard'} support</li>
            </ul>
            <button onClick={() => handleChangePlan(p.id)} disabled={actionLoading === 'change-plan' || isCurrent}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
                isCurrent ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}>
              {actionLoading === 'change-plan' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isCurrent ? 'Current Plan' : 'Switch'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Invoices Tab ──

function InvoicesTab({ invoices, paymentHistory, showRefundModal, setShowRefundModal, refundReason, setRefundReason, handleRequestRefund }: any) {
  return (
    <div className="space-y-6">
      {/* Invoices */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Number</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!invoices || invoices.length === 0) ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No invoices yet.</td></tr>
              ) : invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{formatDate(inv.createdAt)}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{fmtNaira(Number(inv.totalKobo) - Number(inv.discountKobo))}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                      inv.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      inv.status === 'refunded' ? 'bg-red-50 text-red-700' :
                      'bg-slate-50 text-slate-600'
                    }`}>{inv.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    <button onClick={() => subscriptionApi.downloadInvoice(inv.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1">
                      <Download className="w-3 h-3" /> PDF
                    </button>
                    {inv.status === 'paid' && !inv.refundedAt && (
                      <button onClick={() => setShowRefundModal(inv.id)} className="text-xs text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Payment History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Date</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Gateway</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Method</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!paymentHistory || paymentHistory.length === 0) ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No payments yet.</td></tr>
              ) : paymentHistory.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs text-slate-600">{formatDate(p.paidAt || p.createdAt)}</td>
                  <td className="px-5 py-3 text-xs uppercase font-mono text-slate-700">{p.gateway}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{fmtNaira(p.amountKobo)}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{p.paymentMethod || p.channel || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                      p.status === 'refunded' ? 'bg-red-50 text-red-700' :
                      p.status === 'failed' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.receiptUrl ? (
                      <button onClick={() => window.open(subscriptionApi.getReceiptUrl(p.id), '_blank')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> View
                      </button>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRefundModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Request Refund</h3>
              <button onClick={() => setShowRefundModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">Please provide a reason for the refund request.</p>
              <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={3} placeholder="Why are you requesting a refund?" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowRefundModal(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg">Cancel</button>
                <button onClick={handleRequestRefund} disabled={!refundReason.trim()} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Submit Refund Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Usage Tab ──

function UsageTab({ usage, entitlements }: any) {
  if (!entitlements) return <div className="text-center py-16 text-slate-400"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">Loading usage data...</p></div>;

  const usageMap: Record<string, number> = {};
  usage?.forEach((u: any) => { usageMap[u.featureKey] = (usageMap[u.featureKey] || 0) + (u.usageCount || 0); });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-5">Usage & Limits</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(FEATURE_KEYS).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const limit = entitlements?.limits?.[cfg.limitKey] || entitlements?.plan?.[cfg.limitKey] || 0;
          const used = usageMap[key] || 0;
          const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
          return (
            <div key={key} className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>{used.toLocaleString()} used</span>
                <span>{limit > 0 ? `${limit.toLocaleString()} limit` : 'Unlimited'}</span>
              </div>
              {limit > 0 && (
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Add-ons Tab ──

function AddonsTab({ addons, actionLoading, handleRemoveAddon, showAddonModal, setShowAddonModal, addonForm, setAddonForm, handleAddAddon }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Purchased Add-ons</h3>
        <button onClick={() => setShowAddonModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Purchase Add-on
        </button>
      </div>

      {(!addons || addons.length === 0) ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No add-ons purchased. Extend your plan with add-ons.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Qty</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Price</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Total</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Cycle</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {addons.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{a.name}</p>
                    {a.description && <p className="text-xs text-slate-500">{a.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{a.quantity}</td>
                  <td className="px-5 py-3 text-slate-700">{fmtNaira(Number(a.priceKobo))}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{fmtNaira(Number(a.priceKobo) * Number(a.quantity))}</td>
                  <td className="px-5 py-3 text-xs capitalize text-slate-600">{a.billingCycle}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>
                      {a.isActive ? 'Active' : 'Removed'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {a.isActive && (
                      <button onClick={() => handleRemoveAddon(a.id)} disabled={actionLoading === `remove-addon-${a.id}`}
                        className="text-xs text-red-600 hover:text-red-800 font-medium inline-flex items-center gap-1">
                        {actionLoading === `remove-addon-${a.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Add-on Modal */}
      {showAddonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddonModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Purchase Add-on</h3>
              <button onClick={() => setShowAddonModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={addonForm.name} onChange={e => setAddonForm((f: any) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g., Extra User Seat" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <input type="text" value={addonForm.description} onChange={e => setAddonForm((f: any) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g., Add 5 additional user seats" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price (kobo) *</label>
                  <input type="number" min={0} value={addonForm.priceKobo} onChange={e => setAddonForm((f: any) => ({ ...f, priceKobo: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Quantity *</label>
                  <input type="number" min={1} value={addonForm.quantity} onChange={e => setAddonForm((f: any) => ({ ...f, quantity: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Billing Cycle</label>
                <select value={addonForm.billingCycle} onChange={e => setAddonForm((f: any) => ({ ...f, billingCycle: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              {addonForm.priceKobo > 0 && (
                <p className="text-sm text-slate-600">Total: {fmtNaira(addonForm.priceKobo * addonForm.quantity)}/{addonForm.billingCycle}</p>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAddonModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg">Cancel</button>
                <button onClick={handleAddAddon} disabled={!addonForm.name || !addonForm.priceKobo} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Purchase</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──

function SettingsTab({ sub }: any) {
  const [gatewayConfigs, setGatewayConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionApi.getGatewayConfigs().then(res => {
      const d = Array.isArray(res) ? res : res?.data || [];
      setGatewayConfigs(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Payment Gateways */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Payment Gateways</h3>
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : (
          <div className="space-y-3">
            {['paystack', 'flutterwave', 'stripe'].map(gw => {
              const config = gatewayConfigs.find((c: any) => c.gateway === gw);
              return (
                <div key={gw} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${config?.isActive ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                      {config?.isActive ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize text-slate-900">{gw}</p>
                      <p className="text-xs text-slate-500">{config?.environment || 'not configured'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{config?.isDefault ? 'Default' : ''}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription Info */}
      {sub && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Subscription Info</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DetailItem label="Subscription ID" value={sub.id} />
            <DetailItem label="Status" value={sub.status} />
            <DetailItem label="Auto Renew" value={sub.autoRenew ? 'Enabled' : 'Disabled'} />
            <DetailItem label="Billing Cycle" value={sub.billingCycle || 'Monthly'} />
            <DetailItem label="Created" value={formatDate(sub.createdAt)} />
            <DetailItem label="Updated" value={formatDate(sub.updatedAt)} />
          </div>
        </div>
      )}
    </div>
  );
}

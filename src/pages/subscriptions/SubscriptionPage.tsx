import React, { useState, useEffect } from 'react';
import {
  CreditCard, Package, Users, HardDrive, Calendar, Check, X, AlertCircle, AlertTriangle, ChevronRight,
  History, Download, ExternalLink, Zap, Shield, Crown, Loader2, Building2, Globe, Headphones, FileText,
  Repeat, Banknote, PieChart, Brain, FileSearch, Star, Tag, Ban, Clock, XCircle, ArrowDown, ArrowUp,
  PauseCircle, CheckCircle, Smartphone, Wallet, Banknote as BankIcon, Receipt, Settings
} from 'lucide-react';
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

const paymentMethods = [
  { value: 'card', label: 'Card', icon: CreditCard, desc: 'Debit/Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: BankIcon, desc: 'Direct Bank Transfer' },
  { value: 'ussd', label: 'USSD', icon: Smartphone, desc: 'USSD Banking' },
  { value: 'wallet', label: 'Wallet', icon: Wallet, desc: 'Digital Wallet' },
];

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

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  free_trial: { color: 'bg-blue-50 text-blue-700', label: 'Free Trial', icon: Star },
  active: { color: 'bg-emerald-50 text-emerald-700', label: 'Active', icon: CheckCircle },
  grace_period: { color: 'bg-amber-50 text-amber-700', label: 'Grace Period', icon: AlertTriangle },
  suspended: { color: 'bg-red-50 text-red-600', label: 'Suspended', icon: Ban },
  expired: { color: 'bg-slate-100 text-slate-600', label: 'Expired', icon: Clock },
  cancelled: { color: 'bg-neutral-100 text-neutral-600', label: 'Cancelled', icon: XCircle },
  pending_payment: { color: 'bg-yellow-50 text-yellow-700', label: 'Pending Payment', icon: Clock },
  failed_payment: { color: 'bg-red-50 text-red-600', label: 'Failed Payment', icon: AlertTriangle },
  renewing: { color: 'bg-purple-50 text-purple-700', label: 'Renewing...', icon: Loader2 },
  downgraded: { color: 'bg-orange-50 text-orange-700', label: 'Downgrade Scheduled', icon: ArrowDown },
  upgraded: { color: 'bg-indigo-50 text-indigo-700', label: 'Upgrade Scheduled', icon: ArrowUp },
  paused: { color: 'bg-slate-50 text-slate-600', label: 'Paused', icon: PauseCircle },
};

export function SubscriptionPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [confirmChangePlan, setConfirmChangePlan] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [showCancelOptions, setShowCancelOptions] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<any>(null);
  const [selectedGateway, setSelectedGateway] = useState<string>('paystack');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['card']);
  const [paying, setPaying] = useState(false);
  const [gatewayConfigs, setGatewayConfigs] = useState<any[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const subData = await subscriptionApi.getMySubscription();
      setSubscription(subData);
      if (subData) {
        const [plansData, invData, histData, payHist, payStats, gwConfigs] = await Promise.all([
          subscriptionApi.listPlans(true),
          subscriptionApi.listInvoices(),
          subscriptionApi.getHistory(subData.id),
          subscriptionApi.getPaymentHistory().catch(() => []),
          subscriptionApi.getPaymentStats().catch(() => null),
          subscriptionApi.getGatewayConfigs().catch(() => []),
        ]);
        setPlans(plansData);
        setInvoices(invData);
        setHistory(histData);
        setPaymentHistory(payHist);
        setPaymentStats(payStats);
        setGatewayConfigs(gwConfigs);
      }
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

  async function handleCancel(reason?: string) {
    if (!subscription) return;
    setActionLoading('cancel');
    try {
      await subscriptionApi.cancelAtPeriodEnd(subscription.id, reason);
      setShowCancelOptions(false);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Subscription cancelled. It will remain active until the end of the billing period.' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to cancel subscription' } }));
    } finally { setActionLoading(''); }
  }

  async function handleCancelNow(reason?: string) {
    if (!subscription) return;
    setActionLoading('cancel-now');
    try {
      await subscriptionApi.cancelNow(subscription.id, reason);
      setShowCancelOptions(false);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Subscription cancelled immediately.' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to cancel subscription' } }));
    } finally { setActionLoading(''); }
  }

  async function handlePause() {
    if (!subscription) return;
    setActionLoading('pause');
    try {
      await subscriptionApi.pause(subscription.id);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Subscription paused.' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to pause subscription' } }));
    } finally { setActionLoading(''); }
  }

  async function handleResume() {
    if (!subscription) return;
    setActionLoading('resume');
    try {
      await subscriptionApi.resume(subscription.id);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Subscription resumed.' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to resume subscription' } }));
    } finally { setActionLoading(''); }
  }

  async function handleRenew() {
    if (!subscription) return;
    setActionLoading('renew');
    try {
      await subscriptionApi.renewSubscription(subscription.id);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Subscription renewed.' } }));
      loadAll();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: 'Failed to renew subscription' } }));
    } finally { setActionLoading(''); }
  }

  function openPayModal(invoice: any) {
    setPayingInvoice(invoice);
    const gateways = gatewayConfigs.length > 0 ? gatewayConfigs : [{ gateway: 'paystack' }];
    setSelectedGateway(gateways[0]?.gateway || 'paystack');
    setSelectedChannels(['card']);
    setShowPaymentModal(true);
  }

  async function handlePay() {
    if (!payingInvoice) return;
    setPaying(true);
    try {
      const result = await subscriptionApi.initializePayment({
        invoiceId: payingInvoice.id,
        gateway: selectedGateway,
        channels: selectedChannels,
      });
      if (result.authorizationUrl) {
        window.open(result.authorizationUrl, '_blank');
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Payment link opened in new tab. Complete payment to activate your subscription.' } }));
      }
      setShowPaymentModal(false);
      setPayingInvoice(null);
    } catch (err: any) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message: err?.response?.data?.error || 'Failed to initialize payment' } }));
    } finally { setPaying(false); }
  }

  function toggleChannel(channel: string) {
    setSelectedChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  }

  const statusBadge = (status: string) => {
    const cfg = statusConfig[status];
    if (!cfg) return <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{status}</span>;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.color}`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </span>
    );
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
  const status = subscription?.status || '';
  const currentPeriodEnd = subscription?.currentPeriodEnd;
  const daysToRenewal = currentPeriodEnd ? Math.ceil((new Date(currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
  const showRenewalBanner = daysToRenewal >= 0 && daysToRenewal <= 7 && status === 'active';

  const pendingInvoice = invoices?.find((i: any) => i.status === 'pending' || i.status === 'overdue');

  function renderActionButtons() {
    const btn = (key: string, label: string, onClick: () => void, variant: 'primary' | 'danger' | 'secondary' = 'secondary') => {
      const base = 'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
      const styles = {
        primary: `${base} text-white bg-emerald-600 hover:bg-emerald-700`,
        danger: `${base} text-red-600 bg-red-50 border border-red-200 hover:bg-red-100`,
        secondary: `${base} text-slate-700 bg-white border border-slate-200 hover:bg-slate-50`,
      };
      return (
        <button key={key} onClick={onClick} disabled={actionLoading !== ''} className={styles[variant]}>
          {actionLoading === key && <Loader2 className="w-4 h-4 animate-spin" />}
          {label}
        </button>
      );
    };

    switch (status) {
      case 'active':
      case 'free_trial':
        return (
          <div className="flex flex-wrap gap-3">
            {pendingInvoice && btn('pay', 'Pay Outstanding Invoice', () => openPayModal(pendingInvoice), 'primary')}
            {btn('pause', 'Pause', handlePause)}
            {btn('cancel', 'Cancel', () => setShowCancelOptions(true), 'danger')}
            {btn('change-plan', 'Change Plan', () => setShowChangePlan(true))}
          </div>
        );
      case 'paused':
        return (
          <div className="flex flex-wrap gap-3">
            {btn('resume', 'Resume', handleResume, 'primary')}
            {btn('cancel', 'Cancel', () => setShowCancelOptions(true), 'danger')}
          </div>
        );
      case 'grace_period':
        return (
          <div className="flex flex-wrap gap-3">
            {pendingInvoice && btn('pay-grace', 'Pay Now', () => openPayModal(pendingInvoice), 'primary')}
            {btn('cancel', 'Cancel', () => setShowCancelOptions(true), 'danger')}
          </div>
        );
      case 'suspended':
        return (
          <div className="flex flex-wrap gap-3">
            {pendingInvoice && btn('pay-suspend', 'Reactivate — Pay Now', () => openPayModal(pendingInvoice), 'primary')}
          </div>
        );
      case 'expired':
        return (
          <div className="flex flex-wrap gap-3">
            <a href="/plans" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
              Resubscribe
            </a>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex flex-wrap gap-3">
            {btn('renew', 'Reactivate', handleRenew, 'primary')}
          </div>
        );
      case 'pending_payment':
      case 'failed_payment':
        return (
          <div className="flex flex-wrap gap-3">
            {pendingInvoice && btn('pay-retry', 'Retry Payment', () => openPayModal(pendingInvoice), 'primary')}
            {btn('cancel', 'Cancel', () => setShowCancelOptions(true), 'danger')}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Subscription & Billing</h1>
          {subscription && statusBadge(subscription.status)}
        </div>
        <a href="/app/settings/subscription" className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700">
          <Settings className="w-4 h-4" /> Gateway Settings
        </a>
      </div>

      {/* Renewal Reminder Banner */}
      {showRenewalBanner && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">Your subscription renews on {formatDate(subscription?.currentPeriodEnd)}</p>
        </div>
      )}

      {/* Pending Invoice Banner */}
      {pendingInvoice && status !== 'grace_period' && status !== 'suspended' && status !== 'failed_payment' && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">You have an unpaid invoice of <strong>{fmtNaira(pendingInvoice.totalKobo)}</strong> from {formatDate(pendingInvoice.createdAt)}</p>
          </div>
          <button onClick={() => openPayModal(pendingInvoice)} className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
            Pay Now
          </button>
        </div>
      )}

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
              <p className="text-sm font-medium text-slate-500">Payment Gateway</p>
              <p className="text-lg font-semibold text-slate-900 mt-1 capitalize">{gatewayConfigs[0]?.gateway || 'Paystack'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{gatewayConfigs[0]?.environment || 'test'} mode</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Successful Payments</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{paymentStats?.successfulPayments || 0}</p>
              {paymentStats?.totalRevenueKobo > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">{fmtNaira(paymentStats.totalRevenueKobo)} total</p>
              )}
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Storage</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{plan?.storageLimitGb ?? 0} GB</p>
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

      {/* Action Buttons */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Actions</h2>
        {renderActionButtons()}
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

      {/* Status History Timeline */}
      {history.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" /> Status History
          </h2>
          <div className="relative">
            {history.map((h: any, i: number) => (
              <div key={h.id} className="flex gap-4 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ${i === 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {i < history.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 capitalize">{h.toStatus?.replace(/_/g, ' ')}</p>
                  {h.fromStatus && <p className="text-xs text-slate-500">from {h.fromStatus.replace(/_/g, ' ')}</p>}
                  {h.reason && <p className="text-xs text-slate-400 mt-0.5">{h.reason}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(h.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!changing && actionLoading !== 'schedule') { setShowChangePlan(false); setConfirmChangePlan(null); } } }>
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
                  <button onClick={() => setConfirmChangePlan(null)} disabled={changing || actionLoading !== ''} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                  <button onClick={() => handleChangePlan(confirmChangePlan)} disabled={changing || actionLoading !== ''} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
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

      {/* Cancel Options Modal */}
      {showCancelOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (actionLoading === '') setShowCancelOptions(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md m-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Cancel Subscription</h3>
              <button onClick={() => setShowCancelOptions(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">Choose how you'd like to cancel your subscription.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => handleCancel()} disabled={actionLoading !== ''} className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-colors disabled:opacity-50">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900">Cancel at Period End</p>
                    <p className="text-sm text-slate-500 mt-0.5">Your subscription remains active until {formatDate(subscription?.currentPeriodEnd)}</p>
                  </div>
                </div>
              </button>
              <button onClick={() => handleCancelNow()} disabled={actionLoading !== ''} className="w-full text-left p-4 rounded-xl border border-red-200 hover:border-red-300 hover:bg-red-50/30 transition-colors disabled:opacity-50">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900">Cancel Immediately</p>
                    <p className="text-sm text-slate-500 mt-0.5">Access will be revoked right away</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!paying) setShowPaymentModal(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg m-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Pay Invoice</h3>
              <button onClick={() => { if (!paying) setShowPaymentModal(false); setPayingInvoice(null); }} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Invoice Summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Invoice</span>
                  <span className="font-medium text-slate-900">{payingInvoice.invoiceNumber || payingInvoice.id?.slice(0, 8)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-slate-600">Description</span>
                  <span className="font-medium text-slate-900">{payingInvoice.description || 'Subscription'}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-slate-600">Amount Due</span>
                  <span className="text-lg font-bold text-slate-900">{fmtNaira(payingInvoice.totalKobo || payingInvoice.amountKobo)}</span>
                </div>
              </div>

              {/* Gateway Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Gateway</label>
                <div className="flex gap-2">
                  {['paystack', 'flutterwave'].map(gw => (
                    <button key={gw} onClick={() => setSelectedGateway(gw)}
                      className={`flex-1 p-2.5 text-sm font-medium rounded-xl border transition-colors capitalize ${
                        selectedGateway === gw ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {gw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map(m => {
                    const Icon = m.icon;
                    const selected = selectedChannels.includes(m.value);
                    return (
                      <button key={m.value} onClick={() => toggleChannel(m.value)}
                        className={`flex items-center gap-2 p-3 text-sm font-medium rounded-xl border transition-colors ${
                          selected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-left">
                          <span className="block">{m.label}</span>
                          <span className="block text-xs font-normal opacity-70">{m.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={handlePay} disabled={paying || selectedChannels.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                {paying ? <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</> : <><CreditCard className="w-4 h-4" /> Pay {fmtNaira(payingInvoice.totalKobo || payingInvoice.amountKobo)}</>}
              </button>

              <p className="text-xs text-slate-400 text-center">You will be redirected to the payment gateway to complete the transaction.</p>
            </div>
          </div>
        </div>
      )}

      {/* Invoice & Payment History */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Invoice & Payment History</h2>
          </div>
        </div>

        {invoices.length > 0 || paymentHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">#</th>
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Description</th>
                  <th className="text-right font-medium text-slate-500 pb-3 pr-4">Amount</th>
                  <th className="text-center font-medium text-slate-500 pb-3 pr-4">Status</th>
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Date</th>
                  <th className="text-right font-medium text-slate-500 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const payment = paymentHistory?.find((p: any) => p.payment?.invoiceId === inv.id);
                  return (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 pr-4 font-medium text-slate-900">{inv.invoiceNumber || inv.id?.slice(0, 8)}</td>
                      <td className="py-3 pr-4 text-slate-600 max-w-48 truncate">{inv.description || `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`}</td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-900">{fmtNaira(inv.totalKobo || inv.amountKobo)}</td>
                      <td className="py-3 pr-4 text-center">{invStatusBadge(inv.status)}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatDate(inv.createdAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(inv.status === 'pending' || inv.status === 'overdue') && (
                            <button onClick={() => openPayModal(inv)} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                              <CreditCard className="w-3.5 h-3.5" /> Pay
                            </button>
                          )}
                          {inv.receiptUrl && (
                            <a href={inv.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-700">
                              <Receipt className="w-3.5 h-3.5" /> Receipt
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Payment History Detail */}
      {paymentHistory.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Payment Transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Reference</th>
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Gateway</th>
                  <th className="text-left font-medium text-slate-500 pb-3 pr-4">Method</th>
                  <th className="text-right font-medium text-slate-500 pb-3 pr-4">Amount</th>
                  <th className="text-center font-medium text-slate-500 pb-3 pr-4">Status</th>
                  <th className="text-left font-medium text-slate-500 pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((ph: any) => {
                  const p = ph.payment;
                  const statusColors: Record<string, string> = {
                    success: 'bg-emerald-50 text-emerald-700',
                    pending: 'bg-amber-50 text-amber-700',
                    failed: 'bg-red-50 text-red-600',
                    refunded: 'bg-purple-50 text-purple-700',
                  };
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-900">{p.gatewayReference?.slice(0, 24)}</td>
                      <td className="py-3 pr-4 capitalize text-slate-600">{p.gateway}</td>
                      <td className="py-3 pr-4 capitalize text-slate-600">{(p.paymentMethod || 'unknown').replace(/_/g, ' ')}</td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-900">{fmtNaira(p.amountKobo)}</td>
                      <td className="py-3 pr-4 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[p.status] || 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="rounded-xl bg-white shadow-sm border border-red-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-slate-900">Danger Zone</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">Cancel your subscription. Your data will be preserved and you can resubscribe at any time.</p>
        <button
          onClick={() => setShowCancelOptions(true)}
          disabled={actionLoading !== '' || status === 'cancelled' || status === 'expired'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {actionLoading === 'cancel' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'cancelled' ? 'Already Cancelled' : status === 'expired' ? 'Already Expired' : 'Cancel Subscription'}
        </button>
      </div>
    </div>
  );
}

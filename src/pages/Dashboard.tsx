import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, ChevronRight, Loader2,
  FileText, PlusCircle, RefreshCw, Users, Building2, Clock, AlertTriangle,
  Banknote, Receipt, Calendar, CheckCircle2, ChevronDown, DollarSign,
  BarChart3, Activity, CreditCard, Target, Zap, Scale, Percent, Landmark
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Legend
} from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { reportsApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

const COLORS = ['#2e7d32', '#dc2626', '#1565c0', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#0d9488'];

function kFormatter(v: number): string {
  if (v >= 100000000) return `\u20A6${(v / 100000000).toFixed(1)}B`;
  if (v >= 100000) return `\u20A6${(v / 100000).toFixed(1)}M`;
  if (v >= 100) return `\u20A6${(v / 100).toFixed(1)}K`;
  return `\u20A6${v.toFixed(0)}`;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend, onClick, children }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType; color: string;
  trend?: { value: number; label: string; positive: boolean }; onClick?: () => void;
  children?: React.ReactNode;
}) {
  const colorMap: Record<string, { from: string; darkFrom: string; bg: string }> = {
    emerald: { from: 'from-emerald-500/20', darkFrom: 'dark:from-emerald-400/10', bg: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    blue: { from: 'from-blue-500/20', darkFrom: 'dark:from-blue-400/10', bg: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    amber: { from: 'from-amber-500/20', darkFrom: 'dark:from-amber-400/10', bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    purple: { from: 'from-purple-500/20', darkFrom: 'dark:from-purple-400/10', bg: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
    rose: { from: 'from-rose-500/20', darkFrom: 'dark:from-rose-400/10', bg: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
    teal: { from: 'from-teal-500/20', darkFrom: 'dark:from-teal-400/10', bg: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' },
  };
  const c = colorMap[color] || colorMap.emerald;
  return (
    <button onClick={onClick} disabled={!onClick} className="group relative bg-surface rounded-2xl border border-border-custom shadow-sm hover:shadow-lg transition-all duration-200 text-left cursor-pointer overflow-hidden w-full disabled:cursor-default">
      <div className={`absolute inset-0 bg-gradient-to-br ${c.from} ${c.darkFrom} opacity-40`} />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold tracking-widest text-ink-400">{title}</span>
          <div className={`p-2.5 rounded-xl ${c.bg} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-ink-900 tabular-nums tracking-tight">{value}</div>
        {subtitle && <p className="text-[11px] text-ink-400 mt-1">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${trend.positive ? 'text-success-custom' : 'text-danger-custom'}`}>
            {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% {trend.label}
          </div>
        )}
        {children}
      </div>
    </button>
  );
}

function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-surface rounded-2xl border border-border-custom shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink-900">{title}</h3>
          {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface/95 backdrop-blur-sm border border-border-custom rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-semibold text-ink-700 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-ink-500">{entry.name}:</span>
          <span className="font-semibold text-ink-800">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function TableCard({ title, subtitle, icon: Icon, onClick, children }: {
  title: string; subtitle?: string; icon: React.ElementType; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-border-custom">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-surface-subtle text-ink-400"><Icon className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            {subtitle && <p className="text-[11px] text-ink-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {onClick && (
          <button onClick={onClick} className="text-[11px] font-semibold text-secondary hover:text-primary flex items-center gap-1">
            View <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="divide-y divide-border-custom/50">{children}</div>
    </div>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (viewId: string) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('6m');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getPeriodStart = useCallback(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case '1w': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      case '2w': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
      case '1m': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '12m': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      default: return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    }
  }, [selectedPeriod]);

  const periodStart = getPeriodStart();
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const nowStr = new Date().toISOString().split('T')[0];

  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics', selectedPeriod],
    queryFn: () => reportsApi.getDashboardMetrics({ startDate: periodStartStr, endDate: nowStr }),
    staleTime: 10 * 1000,
    refetchInterval: autoRefresh ? 30 * 1000 : false,
    enabled: !!token,
  });

  const data = metricsQuery.data?.data;
  const isLoading = metricsQuery.isLoading;

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      }, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, queryClient]);

  const [refreshing, setRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const refetchAll = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    await queryClient.refetchQueries({ queryKey: ['dashboard-metrics'] });
    setTimeout(() => setRefreshing(false), 600);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-ink-100 rounded-xl w-52 animate-pulse" />
            <div className="h-4 bg-ink-100 rounded-lg w-72 mt-3 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 bg-surface rounded-2xl border border-border-custom p-5 animate-pulse">
              <div className="h-3 w-20 bg-ink-100 rounded mb-4" />
              <div className="h-8 w-36 bg-ink-100 rounded-lg mb-3" />
              <div className="h-4 w-24 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const m = data || {};
  const cp = m.cashPosition ?? 0; const wc = m.workingCapital ?? 0; const cf = m.cashFlow ?? 0; const tp = m.taxPayable ?? 0;
  const cr = m.currentRatio ?? 0; const qr = m.quickRatio ?? 0; const gm = m.grossMargin ?? 0;
  const nm = m.netMargin ?? 0; const om = m.operatingMargin ?? 0;
  const arDays = m.arDays ?? 0; const apDays = m.apDays ?? 0; const invDays = m.inventoryDays ?? 0; const ccc = m.cashConversionCycle ?? 0;
  const totalRev = m.totalRevenue ?? 0; const totalExp = m.totalExpenses ?? 0; const netPft = m.netProfit ?? 0;
  const revenueTrend = m.revenueTrend ?? []; const expenseTrend = m.expenseTrend ?? []; const profitTrend = m.profitTrend ?? [];
  const overdueCustomers = m.overdueCustomers ?? []; const upcomingBills = m.upcomingBills ?? [];
  const topCustomers = m.topCustomers ?? []; const topVendors = m.topVendors ?? [];
  const cashForecast = m.cashForecast ?? []; const budgetVariance = m.budgetVariance ?? [];

  const profitGrowth = profitTrend.length >= 2
    ? ((profitTrend[profitTrend.length - 1].value - profitTrend[0].value) / (Math.abs(profitTrend[0].value) || 1)) * 100 : 0;

  const quickActions = [
    { label: 'New Invoice', icon: FileText, path: '/sales/invoices/new', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    { label: 'New Bill', icon: Receipt, path: '/purchases/bills/new', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { label: 'Record Payment', icon: DollarSign, path: '/sales/payments', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    { label: 'New Customer', icon: Users, path: '/sales/customers', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
    { label: 'Manual Journal', icon: FileText, path: '/accountant/journals/new', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
  ];

  const periodLabels: Record<string, string> = { '1w': 'Last Week', '2w': '2 Weeks', '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '12m': '12 Months' };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-ink-900 tracking-tight">Dashboard</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-custom bg-success-bg px-2.5 py-1 rounded-full border border-success-custom/20">
              <CheckCircle2 className="w-3 h-3" /> Trial Balance Verified
            </span>
          </div>
          <p className="text-sm text-ink-400 mt-1">Financial overview & corporate metrics</p>
          {m.period && (
            <p className="text-xs text-ink-400 mt-0.5">
              {fmtDate(m.period.startDate)} – {fmtDate(m.period.endDate)}
              {autoRefresh && <span className="ml-2 text-success-custom font-semibold">● Live</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
            className="text-xs font-semibold border border-border-custom rounded-xl px-3 py-2 bg-surface text-ink-600 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-shadow">
            {Object.entries(periodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
              autoRefresh ? 'bg-success-bg text-success-custom border-success-custom/30' : 'bg-surface text-ink-500 border-border-custom'
            }`}>
            <Zap className={`w-3.5 h-3.5 ${autoRefresh ? 'text-success-custom' : ''}`} /> Auto
          </button>
          <button onClick={refetchAll} disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-600 bg-surface border border-border-custom rounded-xl hover:bg-surface-hover transition-all disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary-hover transition-all shadow-sm">
              <PlusCircle className="w-4 h-4" /> New <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface rounded-xl shadow-xl border border-border-custom z-50 py-1.5">
                {quickActions.map((a, i) => (
                  <button key={i} onClick={() => { setDropdownOpen(false); navigate(a.path); }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-ink-700 hover:bg-surface-hover transition-colors text-left">
                    <div className={`p-1.5 rounded-lg ${a.color}`}><a.icon className="w-3.5 h-3.5" /></div>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Cash Position" value={fmtNaira(cp)} subtitle={fmtNaira(totalRev) + ' revenue'} icon={Banknote} color="emerald" trend={{ value: gm, label: 'gross margin', positive: gm >= 0 }} onClick={() => navigate('/banking')} />
        <MetricCard title="Working Capital" value={fmtNaira(wc)} subtitle={cr > 0 ? 'Current Ratio: ' + cr.toFixed(2) + 'x' : 'N/A'} icon={Activity} color="blue" trend={{ value: cr * 100, label: 'coverage', positive: cr >= 1.5 }} onClick={() => navigate('/reports/balance-sheet')} />
        <MetricCard title="Cash Flow" value={fmtNaira(cf)} subtitle={cf >= 0 ? 'Positive operating cash flow' : 'Negative'} icon={BarChart3} color={cf >= 0 ? 'teal' : 'rose'} trend={{ value: om, label: 'operating margin', positive: om >= 0 }} onClick={() => navigate('/reports/cash-flow')} />
        <MetricCard title="Tax Payable" value={fmtNaira(tp)} subtitle="Outstanding liabilities" icon={Landmark} color="amber" trend={{ value: nm, label: 'net margin', positive: nm >= 0 }} onClick={() => navigate('/reports/tax-engine')} />
      </div>

      {/* Ratios */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Current Ratio', value: cr > 0 ? `${cr.toFixed(2)}x` : '—', positive: cr >= 1.5 },
          { label: 'Quick Ratio', value: qr > 0 ? `${qr.toFixed(2)}x` : '—', positive: qr >= 1 },
          { label: 'Gross Margin', value: pct(gm), positive: gm >= 20 },
          { label: 'Net Margin', value: pct(nm), positive: nm >= 5 },
          { label: 'Op. Margin', value: pct(om), positive: om >= 10 },
        ].map((item, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border-custom shadow-sm p-3.5 text-center">
            <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1">{item.label}</p>
            <p className={`text-lg font-bold tabular-nums tracking-tight ${item.positive ? 'text-success-custom' : 'text-danger-custom'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Efficiency */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'AR Days', value: arDays > 0 ? `${arDays}d` : '—', positive: arDays <= 45 },
          { label: 'AP Days', value: apDays > 0 ? `${apDays}d` : '—', positive: apDays >= 30 },
          { label: 'Inventory Days', value: invDays > 0 ? `${invDays}d` : '—', positive: invDays <= 60 },
          { label: 'Cash Conv. Cycle', value: ccc !== 0 ? `${ccc}d` : '—', positive: ccc <= 0 },
          { label: 'Profit Trend', value: `${profitGrowth >= 0 ? '+' : ''}${profitGrowth.toFixed(1)}%`, positive: profitGrowth >= 0 },
        ].map((item, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border-custom shadow-sm p-3.5 text-center">
            <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1">{item.label}</p>
            <p className={`text-lg font-bold tabular-nums tracking-tight ${item.positive ? 'text-success-custom' : 'text-danger-custom'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard title="Profit Trend" subtitle="Monthly net profit" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitTrend}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-custom)" opacity={0.5} />
                <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} stroke="var(--color-ink-400)" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="var(--color-ink-400)" tickFormatter={kFormatter} width={65} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Area type="monotone" dataKey="value" stroke="#2e7d32" strokeWidth={2.5} fill="url(#profitGrad)" name="Net Profit" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Revenue vs Expenses" subtitle="Monthly comparison">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueTrend.map((r: any, i: number) => ({ ...r, expenses: expenseTrend[i]?.value || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-custom)" opacity={0.5} />
                <XAxis dataKey="month" fontSize={9} axisLine={false} tickLine={false} stroke="var(--color-ink-400)" />
                <YAxis fontSize={9} axisLine={false} tickLine={false} stroke="var(--color-ink-400)" tickFormatter={kFormatter} width={55} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Bar dataKey="value" fill="#2e7d32" radius={[3,3,0,0]} barSize={12} name="Revenue" />
                <Bar dataKey="expenses" fill="#dc2626" radius={[3,3,0,0]} barSize={12} name="Expenses" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard title="Cash Forecast" subtitle="6-month outlook" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashForecast}>
                <defs>
                  <linearGradient id="finflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="foutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-custom)" opacity={0.5} />
                <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} stroke="var(--color-ink-400)" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="var(--color-ink-400)" tickFormatter={kFormatter} width={65} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Area type="monotone" dataKey="inflows" stroke="#2e7d32" strokeWidth={2} fill="url(#finflow)" name="Inflows" />
                <Area type="monotone" dataKey="outflows" stroke="#dc2626" strokeWidth={2} fill="url(#foutflow)" name="Outflows" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Budget Variance" subtitle="Actual vs budget">
          {budgetVariance.length > 0 ? (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {budgetVariance.slice(0, 8).map((bv: any, i: number) => {
                const over = bv.variance < 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-ink-700 truncate" title={bv.accountName}>{bv.accountName.length > 25 ? bv.accountName.slice(0, 22) + '...' : bv.accountName}</span>
                      <span className={`text-[10px] font-bold ${over ? 'text-danger-custom' : 'text-success-custom'}`}>{!over ? '+' : ''}{bv.variancePct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-danger-custom' : 'bg-success-custom'}`}
                        style={{ width: `${Math.min(Math.abs(bv.variancePct), 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-ink-400 mt-0.5">
                      <span>Budget: {fmtNaira(bv.budgeted)}</span>
                      <span>Actual: {fmtNaira(bv.actual)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-ink-400 flex-col gap-2">
              <Target className="w-8 h-8 text-ink-200" />
              <span>No budgets configured</span>
              <button onClick={() => navigate('/accountant/budgets')} className="text-xs font-semibold text-secondary hover:text-primary mt-1">Create a budget</button>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <TableCard title="Overdue Customers" subtitle={overdueCustomers.length + ' overdue'} icon={AlertTriangle} onClick={() => navigate('/sales/invoices')}>
          {overdueCustomers.length > 0 ? overdueCustomers.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 truncate">{c.name}</p>
                <p className="text-[10px] text-danger-custom font-medium mt-0.5">{c.daysOverdue}d overdue</p>
              </div>
              <span className="text-sm font-bold text-danger-custom tabular-nums ml-3">{fmtNaira(c.amount)}</span>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-ink-400">All paid up</div>
          )}
        </TableCard>
        <TableCard title="Upcoming Bills" subtitle={upcomingBills.length + ' due'} icon={Calendar} onClick={() => navigate('/purchases/bills')}>
          {upcomingBills.length > 0 ? upcomingBills.slice(0, 5).map((b: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 truncate">{b.vendorName}</p>
                <p className="text-[10px] text-ink-400 font-medium mt-0.5">Due {b.dueDate}</p>
              </div>
              <span className="text-sm font-bold text-warning-custom tabular-nums ml-3">{fmtNaira(b.amount)}</span>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-ink-400">No pending bills</div>
          )}
        </TableCard>
        <TableCard title="Top Customers" subtitle={topCustomers.length > 0 ? 'By revenue' : 'No data'} icon={Users} onClick={() => navigate('/sales/customers')}>
          {topCustomers.length > 0 ? topCustomers.slice(0, 5).map((c: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm font-semibold text-ink-900 truncate">{c.name}</p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-bold text-ink-900 tabular-nums">{fmtNaira(c.amount)}</p>
                <p className="text-[9px] text-ink-400">{c.count} txns</p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-ink-400">No customer data</div>
          )}
        </TableCard>
        <TableCard title="Top Vendors" subtitle={topVendors.length > 0 ? 'By spend' : 'No data'} icon={Building2} onClick={() => navigate('/purchases/vendors')}>
          {topVendors.length > 0 ? topVendors.slice(0, 5).map((v: any, i: number) => (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-surface-hover transition-colors">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm font-semibold text-ink-900 truncate">{v.name}</p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-bold text-ink-900 tabular-nums">{fmtNaira(v.amount)}</p>
                <p className="text-[9px] text-ink-400">{v.count} txns</p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-ink-400">No vendor data</div>
          )}
        </TableCard>
      </div>
    </div>
  );
}

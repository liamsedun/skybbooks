import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, ChevronRight, Loader2,
  FileText, PlusCircle, RefreshCw, Users, Building2, Clock, AlertTriangle,
  PieChart as PieChartIcon, Banknote, Receipt, Calendar, CheckCircle2, ChevronDown,
  DollarSign, BarChart3, Activity, CreditCard, AlertOctagon, Target,
  ArrowUpDown, Zap, Scale, Percent, Layers, Landmark
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, ComposedChart, Legend
} from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { reportsApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

const CHART_COLORS = ['#059669', '#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#0d9488'];

function kFormatter(v: number): string {
  if (v >= 100000000) return `₦${(v / 100000000).toFixed(1)}B`;
  if (v >= 100000) return `₦${(v / 100000).toFixed(1)}M`;
  if (v >= 100) return `₦${(v / 100).toFixed(1)}K`;
  return `₦${v.toFixed(0)}`;
}

function nairaOrDash(v: number): string {
  return v ? fmtNaira(v) : '—';
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Banknote: React.createElement(Banknote, { className: 'w-4 h-4' }),
  Activity: React.createElement(Activity, { className: 'w-4 h-4' }),
  BarChart3: React.createElement(BarChart3, { className: 'w-4 h-4' }),
  Landmark: React.createElement(Landmark, { className: 'w-4 h-4' }),
  AlertTriangle: React.createElement(AlertTriangle, { className: 'w-4 h-4 text-red-500' }),
  Calendar: React.createElement(Calendar, { className: 'w-4 h-4 text-amber-500' }),
  Users: React.createElement(Users, { className: 'w-4 h-4 text-blue-500' }),
  Building2: React.createElement(Building2, { className: 'w-4 h-4 text-purple-500' }),
};

function MetricCard({ title, value, subtitle, iconName, color, trend, onClick, children }: {
  title: string; value: string; subtitle?: string; iconName: string; color: string;
  trend?: { value: number; label: string; positive: boolean }; onClick?: () => void;
  children?: React.ReactNode;
}) {
  const gradMap: Record<string, string> = {
    emerald: 'from-emerald-400 to-emerald-500', blue: 'from-blue-400 to-blue-500',
    amber: 'from-amber-400 to-amber-500', purple: 'from-purple-400 to-purple-500',
    rose: 'from-rose-400 to-rose-500', cyan: 'from-cyan-400 to-cyan-500',
    indigo: 'from-indigo-400 to-indigo-500', teal: 'from-teal-400 to-teal-500',
  };
  const bgMap: Record<string, string> = {
    emerald: 'from-emerald-50 to-emerald-100 text-emerald-600',
    blue: 'from-blue-50 to-blue-100 text-blue-600',
    amber: 'from-amber-50 to-amber-100 text-amber-600',
    purple: 'from-purple-50 to-purple-100 text-purple-600',
    rose: 'from-rose-50 to-rose-100 text-rose-600',
    cyan: 'from-cyan-50 to-cyan-100 text-cyan-600',
    indigo: 'from-indigo-50 to-indigo-100 text-indigo-600',
    teal: 'from-teal-50 to-teal-100 text-teal-600',
  };
  const grad = gradMap[color] || gradMap.emerald;
  const bg = bgMap[color] || bgMap.emerald;
  return (
    <button onClick={onClick} disabled={!onClick} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-200 text-left cursor-pointer overflow-hidden w-full disabled:cursor-default">
      <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{title}</span>
          <div className={`p-2.5 bg-gradient-to-br ${bg} rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-sm`}>
            {ICON_MAP[iconName]}
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</div>
        {subtitle && <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.positive ? React.createElement(TrendingUp, { className: 'w-3 h-3' }) : React.createElement(TrendingDown, { className: 'w-3 h-3' })}
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% {trend.label}
          </div>
        )}
        {children}
      </div>
    </button>
  );
}

function RatiosStrip({ items }: { items: { label: string; value: string; positive: boolean }[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
      <div className="flex flex-wrap divide-x divide-slate-100">
        {items.map((item, i) => (
          <div key={i} className="flex-1 min-w-[120px] px-4 py-2 text-center">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{item.label}</p>
            <p className={`text-lg font-bold tabular-nums tracking-tight ${item.positive ? 'text-emerald-600' : 'text-red-600'}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-800">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function AgingTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
      <p className="text-slate-600">{fmtNaira(d.value)}</p>
    </div>
  );
}

const TABLE_ICON_MAP: Record<string, React.ReactNode> = {
  AlertTriangle: React.createElement(AlertTriangle, { className: 'w-4 h-4 text-red-500' }),
  Calendar: React.createElement(Calendar, { className: 'w-4 h-4 text-amber-500' }),
  Users: React.createElement(Users, { className: 'w-4 h-4 text-blue-500' }),
  Building2: React.createElement(Building2, { className: 'w-4 h-4 text-purple-500' }),
};

function TableCard({ title, subtitle, iconName, onClick, children }: {
  title: string; subtitle?: string; iconName: string; onClick?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-50 text-slate-500">{TABLE_ICON_MAP[iconName]}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {onClick && (
          <button onClick={onClick} className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            View <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
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

  // Auto-refresh toggle with 30s interval
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, queryClient]);

  const [refreshing, setRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
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
      <div className="space-y-6 px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gradient-to-r from-slate-200 to-slate-100 rounded-xl w-52 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded-lg w-72 mt-3 animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 bg-slate-200 rounded-xl w-36 animate-pulse" />
            <div className="h-10 bg-slate-200 rounded-xl w-36 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
              <div className="h-8 w-36 bg-slate-200 rounded-lg mb-3" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          <div className="h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  const m = data || {};
  const cp = m.cashPosition ?? 0;
  const wc = m.workingCapital ?? 0;
  const cf = m.cashFlow ?? 0;
  const tp = m.taxPayable ?? 0;
  const cr = m.currentRatio ?? 0;
  const qr = m.quickRatio ?? 0;
  const gm = m.grossMargin ?? 0;
  const nm = m.netMargin ?? 0;
  const om = m.operatingMargin ?? 0;
  const arDays = m.arDays ?? 0;
  const apDays = m.apDays ?? 0;
  const invDays = m.inventoryDays ?? 0;
  const ccc = m.cashConversionCycle ?? 0;
  const totalRev = m.totalRevenue ?? 0;
  const totalExp = m.totalExpenses ?? 0;
  const netPft = m.netProfit ?? 0;
  const revenueTrend = m.revenueTrend ?? [];
  const expenseTrend = m.expenseTrend ?? [];
  const profitTrend = m.profitTrend ?? [];
  const overdueCustomers = m.overdueCustomers ?? [];
  const upcomingBills = m.upcomingBills ?? [];
  const topCustomers = m.topCustomers ?? [];
  const topVendors = m.topVendors ?? [];
  const cashForecast = m.cashForecast ?? [];
  const budgetVariance = m.budgetVariance ?? [];

  // Trend direction indicators
  const profitGrowth = profitTrend.length >= 2
    ? ((profitTrend[profitTrend.length - 1].value - profitTrend[0].value) / (Math.abs(profitTrend[0].value) || 1)) * 100
    : 0;

  return (
    <div className="space-y-6 px-6 py-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-100/50">
              <CheckCircle2 className="w-3 h-3" /> Reconciles with Trial Balance
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1.5">Real-time financial overview &amp; corporate metrics</p>
          {m.period && (
            <p className="text-xs text-slate-400 mt-1">
              {fmtDate(m.period.startDate)} – {fmtDate(m.period.endDate)}
              {autoRefresh && <span className="ml-2 text-emerald-500 font-semibold">● Live</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-600 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-shadow"
          >
            <option value="1w">Last 1 Week</option>
            <option value="2w">Last 2 Weeks</option>
            <option value="1m">Last 1 Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${autoRefresh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-500' : ''}`} /> Auto
          </button>
          <button onClick={refetchAll} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md">
              <PlusCircle className="w-4 h-4" /> +New <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5">
                <button onClick={() => { setDropdownOpen(false); navigate('/sales/invoices/new'); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <FileText className="w-4 h-4 text-blue-500" /> New Invoice
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/purchases/bills/new'); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <FileText className="w-4 h-4 text-orange-500" /> +Bills
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/purchases/payments-made'); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <Banknote className="w-4 h-4 text-emerald-500" /> +Payments Made
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/sales/payments'); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <Banknote className="w-4 h-4 text-indigo-500" /> +Payment Received
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/purchases/vendors'); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <Building2 className="w-4 h-4 text-amber-500" /> +Vendor
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/sales/customers'); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <Users className="w-4 h-4 text-cyan-500" /> +Customer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 1: 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Cash Position"
          value={fmtNaira(cp)}
          subtitle={fmtNaira(totalRev) + ' revenue this period'}
          iconName="Banknote"
          color="emerald"
          trend={{ value: gm, label: 'gross margin', positive: gm >= 0 }}
          onClick={() => navigate('/banking')}
        />
        <MetricCard
          title="Working Capital"
          value={fmtNaira(wc)}
          subtitle={cr > 0 ? 'Current Ratio: ' + cr.toFixed(2) + 'x' : 'N/A'}
          iconName="Activity"
          color="blue"
          trend={{ value: cr * 100, label: 'coverage', positive: cr >= 1.5 }}
          onClick={() => navigate('/reports/balance-sheet')}
        />
        <MetricCard
          title="Cash Flow"
          value={fmtNaira(cf)}
          subtitle={cf >= 0 ? 'Positive operating cash flow' : 'Negative operating cash flow'}
          iconName="BarChart3"
          color={cf >= 0 ? 'teal' : 'rose'}
          trend={{ value: om, label: 'operating margin', positive: om >= 0 }}
          onClick={() => navigate('/reports/cash-flow')}
        />
        <MetricCard
          title="Tax Payable"
          value={fmtNaira(tp)}
          subtitle="Outstanding tax liabilities"
          iconName="Landmark"
          color="amber"
          trend={{ value: nm, label: 'net margin', positive: nm >= 0 }}
          onClick={() => navigate('/reports/tax-engine')}
        />
      </div>

      {/* Row 2: Ratios Strip */}
      <RatiosStrip items={[
        { label: 'Current Ratio', value: cr > 0 ? `${cr.toFixed(2)}x` : 'N/A', positive: cr >= 1.5 },
        { label: 'Quick Ratio', value: qr > 0 ? `${qr.toFixed(2)}x` : 'N/A', positive: qr >= 1.0 },
        { label: 'Gross Margin', value: pct(gm), positive: gm >= 20 },
        { label: 'Net Margin', value: pct(nm), positive: nm >= 5 },
        { label: 'Operating Margin', value: pct(om), positive: om >= 10 },
      ]} />

      {/* Row 3: Efficiency Metrics Strip */}
      <RatiosStrip items={[
        { label: 'AR Days', value: arDays > 0 ? `${arDays}d` : 'N/A', positive: arDays <= 45 },
        { label: 'AP Days', value: apDays > 0 ? `${apDays}d` : 'N/A', positive: apDays >= 30 },
        { label: 'Inventory Days', value: invDays > 0 ? `${invDays}d` : 'N/A', positive: invDays <= 60 },
        { label: 'Cash Conv. Cycle', value: ccc !== 0 ? `${ccc}d` : 'N/A', positive: ccc <= 0 },
        { label: 'Profit Trend', value: `${profitTrend.length > 0 ? (profitGrowth >= 0 ? '+' : '') : ''}${profitGrowth.toFixed(1)}%`, positive: profitGrowth >= 0 },
      ]} />

      {/* Row 4: Charts — Profit Trend + Revenue/Expense Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Profit Trend Area Chart (spans 2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Profit Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Monthly net profit over time</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Profit</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitTrend}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={kFormatter} width={65} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" name="Net Profit" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue vs Expense Composed Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Revenue & Expenses</h3>
              <p className="text-xs text-slate-400 mt-0.5">Monthly comparison</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Rev</span>
              <span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" /> Exp</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueTrend.map((r: any, i: number) => ({ ...r, expenses: expenseTrend[i]?.value || 0 }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="month" fontSize={9} axisLine={false} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={9} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={kFormatter} width={55} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Bar dataKey="value" fill="#059669" radius={[3,3,0,0]} barSize={12} name="Revenue" />
                <Bar dataKey="expenses" fill="#dc2626" radius={[3,3,0,0]} barSize={12} name="Expenses" />
                <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 5: Cash Forecast + Budget Variance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Cash Forecast Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Cash Forecast</h3>
              <p className="text-xs text-slate-400 mt-0.5">Projected cash position (6-month outlook)</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Inflows</span>
              <span className="flex items-center gap-1.5 text-red-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Outflows</span>
              <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Balance</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashForecast}>
                <defs>
                  <linearGradient id="forecastInflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="forecastOutflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={kFormatter} width={65} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Area type="monotone" dataKey="inflows" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#forecastInflow)" name="Inflows" />
                <Area type="monotone" dataKey="outflows" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#forecastOutflow)" name="Outflows" />
                <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} name="Projected Balance" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Variance */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Budget Variance</h3>
              <p className="text-xs text-slate-400 mt-0.5">Actual vs budget by category</p>
            </div>
            <Target className="w-4 h-4 text-slate-400" />
          </div>
          {budgetVariance.length > 0 ? (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {budgetVariance.slice(0, 8).map((bv: any, i: number) => {
                const overBudget = bv.variance < 0;
                const shortName = bv.accountName.length > 25 ? bv.accountName.substring(0, 22) + '...' : bv.accountName;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700 truncate" title={bv.accountName}>{shortName}</span>
                      <span className={`text-[10px] font-bold ${overBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                        {!overBudget ? '+' : ''}{bv.variancePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${overBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(Math.abs(bv.variancePct), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>Budget: {fmtNaira(bv.budgeted)}</span>
                      <span>Actual: {fmtNaira(bv.actual)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400 flex-col gap-2">
              <Target className="w-8 h-8 text-slate-300" />
              <span>No budgets configured</span>
              <button onClick={() => navigate('/accountant/budgets')} className="text-xs font-semibold text-blue-600 hover:text-blue-800 mt-1">
                Create a budget
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 6: Tables — Overdue Customers, Upcoming Bills, Top Customers, Top Vendors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        <TableCard title="Overdue Customers" subtitle={overdueCustomers.length > 0 ? overdueCustomers.length + " overdue" : 'No overdue'} iconName="AlertTriangle" onClick={() => navigate('/sales/invoices')}>
          {overdueCustomers.length > 0 ? overdueCustomers.map((c: any, i: number) => (
            <div key={`customer-${i}`} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                <p className="text-[10px] text-red-500 font-medium mt-0.5">{c.daysOverdue}d overdue</p>
              </div>
              <span className="text-sm font-bold text-red-600 tabular-nums ml-3">{fmtNaira(c.amount)}</span>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-slate-400">All paid up</div>
          )}
        </TableCard>

        <TableCard title="Upcoming Bills" subtitle={upcomingBills.length > 0 ? upcomingBills.length + " due" : 'No upcoming'} iconName="Calendar" onClick={() => navigate('/purchases/bills')}>
          {upcomingBills.length > 0 ? upcomingBills.map((b: any, i: number) => (
            <div key={`bill-${i}`} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{b.vendorName}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Due {b.dueDate}</p>
              </div>
              <span className="text-sm font-bold text-amber-600 tabular-nums ml-3">{fmtNaira(b.amount)}</span>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No pending bills</div>
          )}
        </TableCard>

        <TableCard title="Top Customers" subtitle={topCustomers.length > 0 ? 'By payment received' : 'No data'} iconName="Users" onClick={() => navigate('/sales/customers')}>
          {topCustomers.length > 0 ? topCustomers.map((c: any, i: number) => (
            <div key={`customer-${i}`} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtNaira(c.amount)}</p>
                <p className="text-[9px] text-slate-400">{c.count} txns</p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No customer data</div>
          )}
        </TableCard>

        <TableCard title="Top Vendors" subtitle={topVendors.length > 0 ? 'By payments made' : 'No data'} iconName="Building2" onClick={() => navigate('/purchases/vendors')}>
          {topVendors.length > 0 ? topVendors.map((v: any, i: number) => (
            <div key={`vendor-${i}`} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <p className="text-sm font-semibold text-slate-800 truncate">{v.name}</p>
              </div>
              <div className="text-right ml-3">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtNaira(v.amount)}</p>
                <p className="text-[9px] text-slate-400">{v.count} txns</p>
              </div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No vendor data</div>
          )}
        </TableCard>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <button onClick={() => navigate('/sales/invoices/new')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-6 text-left">
          <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-xl w-fit mb-3.5 shadow-sm group-hover:scale-110 transition-transform duration-200">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Issue Invoice</h4>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Create and send B2B invoices with automated VAT</p>
        </button>
        <button onClick={() => navigate('/purchases/bills/new')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-6 text-left">
          <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-xl w-fit mb-3.5 shadow-sm group-hover:scale-110 transition-transform duration-200">
            <Receipt className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition-colors">Record Expense</h4>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Post outgoing payments and capture receipts</p>
        </button>
        <button onClick={() => navigate('/payroll/runs')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-6 text-left">
          <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 rounded-xl w-fit mb-3.5 shadow-sm group-hover:scale-110 transition-transform duration-200">
            <Calendar className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Payroll Runs</h4>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Approve PAYE, pension schedules and payslips</p>
        </button>
      </div>

    </div>
  );
}

export default Dashboard;

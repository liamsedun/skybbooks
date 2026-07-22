import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Loader2, RefreshCw,
  Banknote, BarChart3, DollarSign, Scale, Package,
  Receipt, FileText, Landmark, Briefcase, Building2, Target,
  CheckCircle2, ChevronDown, PlusCircle, FileBarChart
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { reportsApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function kFormatter(v: number): string {
  if (v >= 100000000) return `\u20A6${(v / 100000000).toFixed(1)}B`;
  if (v >= 100000) return `\u20A6${(v / 100000).toFixed(1)}M`;
  if (v >= 100) return `\u20A6${(v / 100).toFixed(1)}K`;
  return `\u20A6${v.toFixed(0)}`;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, onClick }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType; color: string;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  };
  const c = colorMap[color] || colorMap.emerald;
  return (
    <button onClick={onClick} disabled={!onClick}
      className="group relative bg-surface rounded-2xl border border-border-custom shadow-sm hover:shadow-lg transition-all duration-200 text-left cursor-pointer overflow-hidden w-full disabled:cursor-default">
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold tracking-widest text-ink-400">{title}</span>
          <div className={`p-2.5 rounded-xl ${c} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-ink-900 tabular-nums tracking-tight">{value}</div>
        {subtitle && <p className="text-[11px] text-ink-400 mt-1">{subtitle}</p>}
      </div>
    </button>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
      <h3 className="text-sm font-bold text-ink-900 mb-4">{title}</h3>
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

export function Dashboard({ onNavigate }: { onNavigate: (viewId: string) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('6m');
  const [refreshing, setRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getPeriodStart = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case '1w': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      case '1m': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '12m': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      default: return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    }
  };

  const periodStart = getPeriodStart();
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const nowStr = new Date().toISOString().split('T')[0];

  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['dashboard-metrics', selectedPeriod],
    queryFn: () => reportsApi.getDashboardMetrics({ startDate: periodStartStr, endDate: nowStr }),
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });

  const data = metricsData?.data || {};
  const m = data;

  const cashPosition = m.cashPosition ?? 0;
  const totalRevenue = m.totalRevenue ?? 0;
  const totalExpenses = m.totalExpenses ?? 0;
  const netProfit = m.netProfit ?? 0;
  const totalReceivables = m.totalReceivables ?? 0;
  const totalPayables = m.totalPayables ?? 0;
  const taxPayable = m.taxPayable ?? 0;
  const profitTrend = m.profitTrend ?? [];
  const outstandingInvoices = m.outstandingInvoices ?? {};
  const outstandingBills = m.outstandingBills ?? {};

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

  const periodLabels: Record<string, string> = { '1w': '1 Week', '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '12m': '12 Months' };

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
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-32 bg-surface rounded-2xl border border-border-custom p-5 animate-pulse">
              <div className="h-3 w-20 bg-ink-100 rounded mb-4" />
              <div className="h-8 w-36 bg-ink-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-custom bg-success-bg px-2.5 py-1 rounded-full border border-success-custom/20">
              <CheckCircle2 className="w-3 h-3" /> Financial Dashboard
            </span>
          </div>
          <p className="text-sm text-ink-400 mt-1">Key accounting metrics at a glance</p>
          {m.period && (
            <p className="text-xs text-ink-400 mt-0.5">
              {new Date(m.period.startDate).toLocaleDateString('en-GB')} – {new Date(m.period.endDate).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
            className="text-xs font-semibold border border-border-custom rounded-xl px-3 py-2 bg-surface text-ink-600 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-shadow">
            {Object.entries(periodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
                {[
                  { label: 'New Invoice', icon: FileText, path: '/sales/invoices/new', color: 'bg-blue-50 text-blue-600' },
                  { label: 'New Bill', icon: Receipt, path: '/purchases/bills/new', color: 'bg-amber-50 text-amber-600' },
                  { label: 'Record Payment', icon: DollarSign, path: '/sales/payments', color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'New Customer', icon: Building2, path: '/sales/customers', color: 'bg-indigo-50 text-indigo-600' },
                  { label: 'Manual Journal', icon: FileText, path: '/accountant/journals/new', color: 'bg-purple-50 text-purple-600' },
                ].map((a, i) => (
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

      {/* Primary Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Cash Position" value={fmtNaira(cashPosition)} subtitle="Bank & cash accounts" icon={Banknote} color="emerald" onClick={() => navigate('/app/banking')} />
        <MetricCard title="Revenue" value={fmtNaira(totalRevenue)} subtitle={selectedPeriod === '12m' ? 'Annual revenue' : 'Period revenue'} icon={TrendingUp} color="blue" onClick={() => navigate('/app/reports/income-statement')} />
        <MetricCard title="Expenses" value={fmtNaira(totalExpenses)} subtitle={`${totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(0) : 0}% of revenue`} icon={BarChart3} color="rose" onClick={() => navigate('/app/reports/income-statement')} />
        <MetricCard title="Profit" value={fmtNaira(netProfit)} subtitle={netProfit >= 0 ? 'Net profit' : 'Net loss'} icon={Scale} color={netProfit >= 0 ? 'emerald' : 'rose'} onClick={() => navigate('/app/reports/income-statement')} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Inventory" value={`${m.inventoryDays || 0}d`} subtitle="Avg turnover days" icon={Package} color="purple" onClick={() => navigate('/app/inventory/items')} />
        <MetricCard title="Receivables" value={fmtNaira(totalReceivables)} subtitle={`${outstandingInvoices.count || 0} outstanding invoices`} icon={Receipt} color="indigo" onClick={() => navigate('/app/sales/invoices')} />
        <MetricCard title="Payables" value={fmtNaira(totalPayables)} subtitle={`${outstandingBills.count || 0} outstanding bills`} icon={FileText} color="amber" onClick={() => navigate('/app/purchases/bills')} />
        <MetricCard title="Taxes" value={fmtNaira(taxPayable)} subtitle="Outstanding tax liabilities" icon={Landmark} color="rose" onClick={() => navigate('/app/reports/tax-engine')} />
      </div>

      {/* Navigational Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm hover:shadow-lg transition-all p-5 cursor-pointer" onClick={() => navigate('/app/projects')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600"><Briefcase className="w-4 h-4" /></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-ink-400">Projects</span>
          </div>
          <p className="text-sm font-bold text-ink-900">View all projects & progress</p>
          <p className="text-[11px] text-ink-400 mt-1">Track job costing, milestones, and billable hours</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm hover:shadow-lg transition-all p-5 cursor-pointer" onClick={() => navigate('/app/banking')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600"><Building2 className="w-4 h-4" /></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-ink-400">Bank Accounts</span>
          </div>
          <p className="text-sm font-bold text-ink-900">Manage bank connections</p>
          <p className="text-[11px] text-ink-400 mt-1">Reconcile, transfer, and monitor accounts</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm hover:shadow-lg transition-all p-5 cursor-pointer" onClick={() => navigate('/app/reports')}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600"><FileBarChart className="w-4 h-4" /></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-ink-400">Financial Reports</span>
          </div>
          <p className="text-sm font-bold text-ink-900">Full suite of financial statements</p>
          <p className="text-[11px] text-ink-400 mt-1">P&L, Balance Sheet, Cash Flow, Trial Balance & more</p>
        </div>
      </div>

      {/* Profit Trend Chart */}
      {profitTrend.length > 0 && (
        <div className="grid grid-cols-1 gap-5">
          <ChartCard title="Profit Trend">
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
                  <Area type="monotone" dataKey="value" stroke="#2e7d32" strokeWidth={2.5} fill="url(#profitGrad)" name="Net Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Loader2,
  FileText,
  PlusCircle,
  RefreshCw,
  Users,
  Building2,
  Clock,
  AlertTriangle,
  PieChart as PieChartIcon,
  Banknote,
  Receipt,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { bankingApi, salesApi, purchasesApi, reportsApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

function fmtNaira(v: number): string {
  return `₦${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const CHART_COLORS = ['#059669', '#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#0d9488'];

function kFormatter(v: number): string {
  if (v >= 100000000) return `₦${(v / 100000000).toFixed(1)}B`;
  if (v >= 100000) return `₦${(v / 100000).toFixed(1)}M`;
  if (v >= 100) return `₦${(v / 100).toFixed(1)}K`;
  return `₦${v.toFixed(0)}`;
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

export function Dashboard({ onNavigate }: { onNavigate: (viewId: string) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('6m');

  const getPeriodStart = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case '1w': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      case '2w': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
      case '1m': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3m': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '12m': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      default: return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    }
  };

  const periodStart = getPeriodStart();
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const nowStr = new Date().toISOString().split('T')[0];
  const getFiscalStart = () => `${new Date().getFullYear()}-01-01`;

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', selectedPeriod],
    queryFn: () => reportsApi.getDashboardSummary({ startDate: periodStartStr, endDate: nowStr }),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const accountsQuery = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const invoicesQuery = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => salesApi.getInvoices({ limit: 500 }),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const billsQuery = useQuery({
    queryKey: ['dashboard-bills'],
    queryFn: () => purchasesApi.getBills({ limit: 500 }),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const paymentsReceivedQuery = useQuery({
    queryKey: ['dashboard-payments-received'],
    queryFn: () => salesApi.getPaymentsReceived({ limit: 500 }),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const paymentsMadeQuery = useQuery({
    queryKey: ['dashboard-payments-made'],
    queryFn: () => purchasesApi.getPaymentsMade(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const expensesQuery = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: () => purchasesApi.getExpenses(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const invoiceAgingQuery = useQuery({
    queryKey: ['dashboard-invoice-aging'],
    queryFn: () => salesApi.getInvoiceAging(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const billAgingQuery = useQuery({
    queryKey: ['dashboard-bill-aging'],
    queryFn: () => purchasesApi.getBillAgingReport(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const summaryData = summaryQuery.data?.data;
  const isLoading = summaryQuery.isLoading;

  const activeAccounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : (accountsQuery.data ?? []);
  const totalCashKobo = activeAccounts.reduce((sum: number, acc: any) => sum + (acc.currentBalance || acc.balance || 0), 0);

  const allInvoices = Array.isArray(invoicesQuery.data)
    ? invoicesQuery.data
    : (invoicesQuery.data?.invoices || invoicesQuery.data?.data || []);
  const allBills = Array.isArray(billsQuery.data)
    ? billsQuery.data
    : (billsQuery.data?.bills || billsQuery.data?.data || []);

  const periodInvoices = allInvoices.filter((inv: any) => inv.date && new Date(inv.date) >= periodStart);
  const periodBills = allBills.filter((b: any) => b.date && new Date(b.date) >= periodStart);

  const cashForecastData = (() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    const periodMonths = selectedPeriod === '1w' || selectedPeriod === '2w' ? 1 : selectedPeriod === '1m' ? 1 : selectedPeriod === '3m' ? 3 : selectedPeriod === '12m' ? 12 : 6;
    const lastN = Array.from({ length: periodMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (periodMonths - 1) + i, 1);
      return { month: d.getMonth(), year: d.getFullYear(), name: months[d.getMonth()] };
    });
    const inListAll = Array.isArray(paymentsReceivedQuery.data) ? paymentsReceivedQuery.data : (paymentsReceivedQuery.data?.payments || []);
    const outListAll = Array.isArray(paymentsMadeQuery.data) ? paymentsMadeQuery.data : (paymentsMadeQuery.data?.payments || []);
    const inList = inListAll.filter((p: any) => p.date && new Date(p.date) >= periodStart);
    const outList = outListAll.filter((p: any) => p.date && new Date(p.date) >= periodStart);
    return lastN.map(({ month, year, name }) => {
      const inflows = inList.filter((p: any) => {
        const d = new Date(p.date); return d.getMonth() === month && d.getFullYear() === year;
      }).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const outflows = outList.filter((p: any) => {
        const d = new Date(p.date); return d.getMonth() === month && d.getFullYear() === year;
      }).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return { name, inflows, outflows, net: inflows - outflows };
    });
  })();

  const expenseBreakdownData = (() => {
    const expListAll = Array.isArray(expensesQuery.data) ? expensesQuery.data : (expensesQuery.data?.expenses || expensesQuery.data?.data || []);
    const expList = expListAll.filter((e: any) => e.date && new Date(e.date) >= periodStart);
    const billsPayable = allBills
      .filter((b: any) => { const s = (b.status || '').toLowerCase(); return s === 'open' || s === 'partial'; })
      .reduce((s: number, b: any) => s + (Number(b.total) || 0), 0);
    const allPaymentsMade = Array.isArray(paymentsMadeQuery.data) ? paymentsMadeQuery.data : (paymentsMadeQuery.data?.payments || []);
    const periodPaymentsMade = allPaymentsMade.filter((p: any) => p.date && new Date(p.date) >= periodStart);
    const totalPayments = periodPaymentsMade.reduce((s: number, p: any) => s + (p.amount || 0), 0);

    const categories: Record<string, number> = {};
    expList.forEach((e: any) => {
      const cat = e.category || 'Other';
      categories[cat] = (categories[cat] || 0) + (Number(e.amount) || 0);
    });

    const items = Object.entries(categories)
      .map(([name, value]) => ({ name, value: Math.round(value / 100) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (billsPayable > 0) items.push({ name: 'Bills Payable', value: Math.round(billsPayable / 100) });
    if (totalPayments > 0) items.push({ name: 'Payments Sent', value: Math.round(totalPayments / 100) });

    return items;
  })();

  const agingBuckets = (() => {
    const inSummary = (invoiceAgingQuery.data as any)?.summary || {};
    const outSummary = (billAgingQuery.data as any)?.summary || {};
    const arBuckets = {
      current: Number(inSummary.current || 0),
      days1to30: Number(inSummary.days1To30 || 0),
      days31to60: Number(inSummary.days31To60 || 0),
      days61to90: Number(inSummary.days61To90 || 0),
      days90Plus: Number(inSummary.daysOver90 || 0),
    };
    const apBuckets = {
      current: Number(outSummary.current || 0),
      days1to30: Number(outSummary.days1To30 || 0),
      days31to60: Number(outSummary.days31To60 || 0),
      days61to90: Number(outSummary.days61To90 || 0),
      days90Plus: Number(outSummary.daysOver90 || 0),
    };
    return {
      ar: [
        { name: 'Current', value: arBuckets.current },
        { name: '1-30d', value: arBuckets.days1to30 },
        { name: '31-60d', value: arBuckets.days31to60 },
        { name: '61-90d', value: arBuckets.days61to90 },
        { name: '90+', value: arBuckets.days90Plus },
      ].filter(b => b.value > 0),
      ap: [
        { name: 'Current', value: apBuckets.current },
        { name: '1-30d', value: apBuckets.days1to30 },
        { name: '31-60d', value: apBuckets.days31to60 },
        { name: '61-90d', value: apBuckets.days61to90 },
        { name: '90+', value: apBuckets.days90Plus },
      ].filter(b => b.value > 0),
    };
  })();

  const recentTransactions = (() => {
    const inListAll = Array.isArray(paymentsReceivedQuery.data) ? paymentsReceivedQuery.data : (paymentsReceivedQuery.data?.payments || []);
    const outListAll = Array.isArray(paymentsMadeQuery.data) ? paymentsMadeQuery.data : (paymentsMadeQuery.data?.payments || []);
    const inList = inListAll.filter((p: any) => p.date && new Date(p.date) >= periodStart);
    const outList = outListAll.filter((p: any) => p.date && new Date(p.date) >= periodStart);
    const allTx = [
      ...inList.map((p: any) => ({ ...p, type: 'inflow', amount: p.amount || 0 })),
      ...outList.map((p: any) => ({ ...p, type: 'outflow', amount: -(p.amount || 0) })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allTx.slice(0, 8).map((tx: any) => ({
      id: tx.id,
      description: tx.reference || tx.paymentNumber || (tx.type === 'inflow' ? 'Payment Received' : 'Payment Made'),
      amount: tx.amount,
      date: fmtDate(tx.date || new Date().toISOString()),
      type: tx.type,
      method: tx.paymentMethod || 'bank_transfer',
    }));
  })();

  const kpiReceivables = summaryData?.totalReceivables ?? 0;
  const kpiPayables = summaryData?.totalPayables ?? 0;
  const kpiRevenue = summaryData?.totalRevenue ?? 0;
  const kpiExpenses = summaryData?.totalExpenses ?? 0;
  const kpiNetProfit = summaryData?.netProfit ?? 0;
  const kpiOutstandingInvoices = summaryData?.outstandingInvoices ?? { count: 0, total: 0 };
  const kpiOutstandingBills = summaryData?.outstandingBills ?? { count: 0, total: 0 };

  const netWorthKobo = totalCashKobo + kpiReceivables - kpiPayables;

  const [refreshing, setRefreshing] = useState(false);
  const refetchAll = async () => {
    setRefreshing(true);
    const keys = [
      'dashboard-summary', 'bankAccounts', 'dashboard-invoices', 'dashboard-bills',
      'dashboard-payments-received', 'dashboard-payments-made', 'dashboard-expenses',
      'dashboard-invoice-aging', 'dashboard-bill-aging'
    ];
    keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    await Promise.all(keys.map(k => queryClient.refetchQueries({ queryKey: [k] })));
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
          {summaryData?.period && (
            <p className="text-xs text-slate-400 mt-1">
              {fmtDate(summaryData.period.startDate)} – {fmtDate(summaryData.period.endDate)}
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
          <button onClick={refetchAll} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => navigate('/sales/invoices/new')} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md">
            <PlusCircle className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        <button onClick={() => navigate('/banking')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all duration-200 text-left cursor-pointer overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Cash Balance</span>
              <div className="p-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-sm">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{formatNaira(totalCashKobo)}</div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100/50">
                <TrendingUp className="w-3 h-3" /> {activeAccounts.length} account{activeAccounts.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-slate-400">{totalCashKobo > 0 ? 'Available' : 'No funds'}</span>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/sales/invoices')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-200 text-left cursor-pointer overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-400 to-blue-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Accounts Receivable</span>
              <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-sm">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{formatNaira(kpiReceivables)}</div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100/50">{kpiOutstandingInvoices.count} invoice{kpiOutstandingInvoices.count !== 1 ? 's' : ''}</span>
              {kpiReceivables > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100/50">
                  <CheckCircle2 className="w-3 h-3" /> Ledger-sourced
                </span>
              )}
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/purchases/bills')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-amber-200 transition-all duration-200 text-left cursor-pointer overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Accounts Payable</span>
              <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-sm">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{formatNaira(kpiPayables)}</div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100/50">{kpiOutstandingBills.count} bill{kpiOutstandingBills.count !== 1 ? 's' : ''}</span>
              {kpiPayables > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100/50">
                  <CheckCircle2 className="w-3 h-3" /> Ledger-sourced
                </span>
              )}
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/reports/balance-sheet')} className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-purple-200 transition-all duration-200 text-left cursor-pointer overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-400 to-purple-500" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Net Worth</span>
              <div className="p-2.5 bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-sm">
                <PieChartIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{formatNaira(netWorthKobo)}</div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${netWorthKobo >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50' : 'bg-red-50 text-red-700 border-red-100/50'}`}>
                {netWorthKobo >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {netWorthKobo >= 0 ? 'Positive' : 'Negative'} position
              </span>
            </div>
          </div>
        </button>

      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Cash Flow Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Cash Flow</h3>
              <p className="text-xs text-slate-400 mt-0.5">Inflows vs Outflows over time</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Inflows</span>
              <span className="flex items-center gap-1.5 text-red-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Outflows</span>
              <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Net</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashForecastData}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={(v) => kFormatter(v)} width={65} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v)} />} />
                <Area type="monotone" dataKey="inflows" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#inflowGrad)" name="Inflows" animationBegin={0} animationDuration={800} animationEasing="ease-out" />
                <Area type="monotone" dataKey="outflows" stroke="#dc2626" strokeWidth={2.5} fillOpacity={1} fill="url(#outflowGrad)" name="Outflows" animationBegin={150} animationDuration={800} animationEasing="ease-out" />
                <Line type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Net" animationBegin={300} animationDuration={800} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aging Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* AR Aging */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">AR Aging</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Receivables overdue buckets</p>
              </div>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            {agingBuckets.ar.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agingBuckets.ar} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={3} animationBegin={0} animationDuration={1000} animationEasing="ease-out">
                        {agingBuckets.ar.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<AgingTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 pt-3 border-t border-slate-100">
                  {agingBuckets.ar.map((b, i) => (
                    <span key={b.name} className="text-[10px] flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {b.name}: <span className="font-semibold text-slate-700">{formatNaira(b.value)}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-slate-400">No AR aging data</div>
            )}
          </div>
          {/* AP Aging */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">AP Aging</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Payables overdue buckets</p>
              </div>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            {agingBuckets.ap.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agingBuckets.ap} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" nameKey="name" paddingAngle={3} animationBegin={150} animationDuration={1000} animationEasing="ease-out">
                        {agingBuckets.ap.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[(i + 5) % CHART_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<AgingTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 pt-3 border-t border-slate-100">
                  {agingBuckets.ap.map((b, i) => (
                    <span key={b.name} className="text-[10px] flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[(i + 5) % CHART_COLORS.length] }} />
                      {b.name}: <span className="font-semibold text-slate-700">{formatNaira(b.value)}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex items-center justify-center text-sm text-slate-400">No AP aging data</div>
            )}
          </div>
        </div>

      </div>

      {/* Expense Breakdown + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Expense Breakdown Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Expense Breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">By category</p>
            </div>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          {expenseBreakdownData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseBreakdownData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis type="number" fontSize={9} stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(v) => kFormatter(v * 100)} />
                  <YAxis type="category" dataKey="name" fontSize={9} stroke="#64748b" axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => fmtNaira(v * 100)} />} />
                  <Bar dataKey="value" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={14} animationBegin={0} animationDuration={800} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">No expense data</div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Transactions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest payments received &amp; made</p>
            </div>
            <button onClick={() => navigate('/banking')} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto -mx-2">
            {recentTransactions.map((tx, idx) => (
              <div key={tx.id} className="py-3.5 px-2 flex items-center justify-between hover:bg-slate-50/80 rounded-xl transition-colors" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-2.5 rounded-xl shrink-0 shadow-sm ${tx.type === 'inflow' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600' : 'bg-gradient-to-br from-red-50 to-red-100 text-red-600'}`}>
                    {tx.type === 'inflow' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {tx.method.replace(/_/g, ' ')} &middot; {tx.date}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className={`text-sm font-bold tabular-nums tracking-tight ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatNaira(Math.abs(tx.amount))}
                  </span>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <div className="py-12 text-center text-sm text-slate-400">No transactions yet</div>
            )}
          </div>
        </div>

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

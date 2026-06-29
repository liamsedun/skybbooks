import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Briefcase,
  Layers,
  ChevronRight,
  ArrowRight,
  Loader2,
  FileText,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  Wallet,
  Activity,
  Users,
  Building2,
  Clock,
  AlertTriangle,
  PieChart as PieChartIcon,
  Banknote,
  Receipt,
  Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { bankingApi, salesApi, purchasesApi, reportsApi } from '../lib/api';
import { AmountDisplay } from '../components/ui/AmountDisplay';
import { StatusBadge } from '../components/ui/StatusBadge';
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

const CHART_COLORS = ['#2e7d32', '#dc2626', '#2563eb', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

export function Dashboard({ onNavigate }: { onNavigate: (viewId: string) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('6m');

  const accountsQuery = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const customersQuery = useQuery({
    queryKey: ['dashboard-customers'],
    queryFn: () => salesApi.getCustomers(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const vendorsQuery = useQuery({
    queryKey: ['dashboard-vendors'],
    queryFn: () => purchasesApi.getVendors(),
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
    queryFn: () => purchasesApi.getPaymentsMade({ limit: 500 }),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const expensesQuery = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: () => purchasesApi.getExpenses({ limit: 500 }),
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

  const isLoading = accountsQuery.isLoading || customersQuery.isLoading || vendorsQuery.isLoading;

  const activeAccounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : (accountsQuery.data ?? []);
  const totalCashKobo = activeAccounts.reduce((sum: number, acc: any) => sum + (acc.currentBalance || acc.balance || 0), 0);

  const customersList = Array.isArray(customersQuery.data) ? customersQuery.data : [];
  const vendorsList = Array.isArray(vendorsQuery.data) ? vendorsQuery.data : [];

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

  const allInvoices = Array.isArray(invoicesQuery.data)
    ? invoicesQuery.data
    : (invoicesQuery.data?.invoices || invoicesQuery.data?.data || []);
  const allBills = Array.isArray(billsQuery.data)
    ? billsQuery.data
    : (billsQuery.data?.bills || billsQuery.data?.data || []);

  const periodInvoices = allInvoices.filter((inv: any) => inv.date && new Date(inv.date) >= periodStart);
  const periodBills = allBills.filter((b: any) => b.date && new Date(b.date) >= periodStart);

  const receivablesKobo = periodInvoices
    .filter((inv: any) => {
      const s = (inv.status || '').toLowerCase();
      return (s === 'sent' || s === 'partial' || s === 'overdue') && inv.balanceDue > 0;
    })
    .reduce((sum: number, inv: any) => sum + (Number(inv.balanceDue) || Number(inv.total) || 0), 0);

  const payablesKobo = periodBills
    .filter((b: any) => {
      const s = (b.status || '').toLowerCase();
      return (s === 'open' || s === 'partial' || s === 'overdue') && b.balanceDue > 0;
    })
    .reduce((sum: number, b: any) => sum + (Number(b.balanceDue) || Number(b.total) || 0), 0);

  const overdueReceivables = periodInvoices
    .filter((inv: any) => {
      const s = (inv.status || '').toLowerCase();
      return (s === 'sent' || s === 'partial' || s === 'overdue') && inv.balanceDue > 0 && inv.dueDate && new Date(inv.dueDate) < new Date();
    })
    .reduce((sum: number, inv: any) => sum + (Number(inv.balanceDue) || 0), 0);

  const overduePayables = periodBills
    .filter((b: any) => {
      const s = (b.status || '').toLowerCase();
      return (s === 'open' || s === 'partial' || s === 'overdue') && b.balanceDue > 0 && b.dueDate && new Date(b.dueDate) < new Date();
    })
    .reduce((sum: number, b: any) => sum + (Number(b.balanceDue) || Number(b.total) || 0), 0);

  const pendingInvoiceCount = periodInvoices.filter((inv: any) => { const s = (inv.status || '').toLowerCase(); return s === 'sent' || s === 'partial' || s === 'overdue'; }).length;
  const pendingBillCount = periodBills.filter((b: any) => { const s = (b.status || '').toLowerCase(); return s === 'open' || s === 'partial' || s === 'overdue'; }).length;

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
    const inAging = invoiceAgingQuery.data || [];
    const outAging = billAgingQuery.data || [];
    const arBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90Plus: 0 };
    const apBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90Plus: 0 };

    if (Array.isArray(inAging)) {
      inAging.forEach((r: any) => {
        arBuckets.current += Number(r.current || 0);
        arBuckets.days1to30 += Number(r.days1to30 || 0);
        arBuckets.days31to60 += Number(r.days31to60 || 0);
        arBuckets.days61to90 += Number(r.days61to90 || 0);
        arBuckets.days90Plus += Number(r.days90Plus || 0);
      });
    }
    if (Array.isArray(outAging)) {
      outAging.forEach((r: any) => {
        apBuckets.current += Number(r.current || 0);
        apBuckets.days1to30 += Number(r.days1to30 || 0);
        apBuckets.days31to60 += Number(r.days31to60 || 0);
        apBuckets.days61to90 += Number(r.days61to90 || 0);
        apBuckets.days90Plus += Number(r.days90Plus || 0);
      });
    }

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

  const netWorthKobo = totalCashKobo + receivablesKobo - payablesKobo;

  const [refreshing, setRefreshing] = useState(false);
  const refetchAll = async () => {
    setRefreshing(true);
    const keys = [
      'bankAccounts', 'dashboard-customers', 'dashboard-vendors',
      'dashboard-invoices', 'dashboard-bills', 'dashboard-payments-received',
      'dashboard-payments-made', 'dashboard-expenses',
      'dashboard-invoice-aging', 'dashboard-bill-aging'
    ];
    keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    await Promise.all(keys.map(k => queryClient.refetchQueries({ queryKey: [k] })));
    setTimeout(() => setRefreshing(false), 600);
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 bg-slate-200 rounded-lg w-48 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded-lg w-64 mt-2 animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 bg-slate-200 rounded-lg w-36 animate-pulse" />
            <div className="h-9 bg-slate-200 rounded-lg w-36 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in px-6 py-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time financial overview &amp; corporate metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600"
          >
            <option value="1w">Last 1 Week</option>
            <option value="2w">Last 2 Weeks</option>
            <option value="1m">Last 1 Month</option>
            <option value="3m">Last 3 Months</option>
            <option value="6m">Last 6 Months</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <button onClick={refetchAll} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => navigate('/sales/invoices/new')} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <PlusCircle className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards — click to drill down to source module */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <button onClick={() => navigate('/banking')} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-emerald-300 transition-all text-left cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Cash Balance</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Banknote className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNaira(totalCashKobo)}</div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {activeAccounts.length} account{activeAccounts.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[11px] text-slate-400">{totalCashKobo > 0 ? 'Available' : 'No funds'}</span>
          </div>
        </button>

        <button onClick={() => navigate('/sales/invoices')} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all text-left cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Accounts Receivable</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNaira(receivablesKobo)}</div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{pendingInvoiceCount} invoice{pendingInvoiceCount !== 1 ? 's' : ''}</span>
            {overdueReceivables > 0 && (
              <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {formatNaira(overdueReceivables)} overdue
              </span>
            )}
          </div>
        </button>

        <button onClick={() => navigate('/purchases/bills')} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-amber-300 transition-all text-left cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Accounts Payable</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Building2 className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNaira(payablesKobo)}</div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{pendingBillCount} bill{pendingBillCount !== 1 ? 's' : ''}</span>
            {overduePayables > 0 && (
              <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {formatNaira(overduePayables)} due
              </span>
            )}
          </div>
        </button>

        <button onClick={() => navigate('/reports/balance-sheet')} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-purple-300 transition-all text-left cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Net Worth</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><PieChartIcon className="w-4 h-4" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNaira(netWorthKobo)}</div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${netWorthKobo >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {netWorthKobo >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {netWorthKobo >= 0 ? 'Positive' : 'Negative'} position
            </span>
          </div>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Cash Flow Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashForecastData}>
                <defs>
                  <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={(v) => `₦${(v/100000000).toFixed(1)}M`} width={65} />
                <Tooltip formatter={(value: number) => [formatNaira(value), undefined]} />
                <Area type="monotone" dataKey="inflows" stroke="#2e7d32" strokeWidth={2} fillOpacity={1} fill="url(#inflowGrad)" name="Inflows" />
                <Area type="monotone" dataKey="outflows" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill="url(#outflowGrad)" name="Outflows" />
                <Line type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={2} dot={false} name="Net" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aging Pie Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aging Summary</h3>
              <p className="text-xs text-slate-400 mt-0.5">Receivables overdue buckets</p>
            </div>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          {agingBuckets.ar.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={agingBuckets.ar} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}>
                    {agingBuckets.ar.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNaira(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400">No aging data</div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {agingBuckets.ar.map((b, i) => (
              <span key={b.name} className="text-[10px] flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                {b.name}: {formatNaira(b.value)}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Expense Breakdown + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Expense Breakdown Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis type="number" fontSize={9} stroke="#94a3b8" axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v/1000000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="name" fontSize={9} stroke="#64748b" axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(value: number) => formatNaira(value * 100)} />
                  <Bar dataKey="value" fill="#2e7d32" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">No expense data</div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Transactions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest payments received &amp; made</p>
            </div>
            <button onClick={() => navigate('/banking')} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-lg px-1.5 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${tx.type === 'inflow' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {tx.type === 'inflow' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {tx.method.replace(/_/g, ' ')} &middot; {tx.date}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{formatNaira(Math.abs(tx.amount))}
                  </span>
                </div>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">No transactions yet</div>
            )}
          </div>
        </div>

      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <button onClick={() => navigate('/sales/invoices/new')} className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg w-fit mb-3"><FileText className="w-5 h-5" /></div>
          <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700">Issue Invoice</h4>
          <p className="text-xs text-slate-400 mt-1">Create and send B2B invoices with automated VAT</p>
        </button>

        <button onClick={() => navigate('/purchases/bills/new')} className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-amber-200 hover:bg-amber-50/30 transition-all group">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg w-fit mb-3"><Receipt className="w-5 h-5" /></div>
          <h4 className="text-sm font-bold text-slate-800 group-hover:text-amber-700">Record Expense</h4>
          <p className="text-xs text-slate-400 mt-1">Post outgoing payments and capture receipts</p>
        </button>

        <button onClick={() => navigate('/payroll/runs')} className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-purple-200 hover:bg-purple-50/30 transition-all group">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg w-fit mb-3"><Calendar className="w-5 h-5" /></div>
          <h4 className="text-sm font-bold text-slate-800 group-hover:text-purple-700">Payroll Runs</h4>
          <p className="text-xs text-slate-400 mt-1">Approve PAYE, pension schedules and payslips</p>
        </button>

      </div>

    </div>
  );
}

export default Dashboard;

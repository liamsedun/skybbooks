/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Activity
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { bankingApi, salesApi, purchasesApi } from '../lib/api';
import { AmountDisplay } from '../components/ui/AmountDisplay';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../hooks/useAuth';

interface DashboardProps {
  onNavigate: (viewId: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const navigate = useNavigate();
  const { formatNaira } = useCurrency();
  const { token } = useAuth();

  // 1. Fetch live metrics from local DB endpoints via React Query
  const accountsQuery = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: bankingApi.getAccounts,
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: () => salesApi.getInvoices(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const billsQuery = useQuery({
    queryKey: ['bills'],
    queryFn: () => purchasesApi.getBills(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });

  const paymentsReceivedQuery = useQuery({
    queryKey: ['paymentsReceived'],
    queryFn: () => salesApi.getPaymentsReceived({ limit: 500 }),
    staleTime: 10 * 1000,
    enabled: !!token,
  });
  const paymentsMadeQuery = useQuery({
    queryKey: ['paymentsMade'],
    queryFn: () => purchasesApi.getPaymentsMade(),
    staleTime: 10 * 1000,
    enabled: !!token,
  });
  const isLoading = accountsQuery.isLoading || invoicesQuery.isLoading || billsQuery.isLoading;

  // 2. Perform live calculations on database metrics
  const activeAccounts = Array.isArray(accountsQuery.data) ? accountsQuery.data : (accountsQuery.data ?? []);

  
  // Total Bank Balances (sum of active cash accounts)
  const totalCashKobo = activeAccounts.reduce((sum: number, acc: any) => sum + (acc.currentBalance || acc.balance || 0), 0);

  // Total Receivables (sum of unpaid invoices)
  const totalInvoicesList = Array.isArray(invoicesQuery.data) ? invoicesQuery.data : (invoicesQuery.data?.invoices || invoicesQuery.data?.data || []);
  const receivablesKobo = totalInvoicesList
    .filter((inv: any) => { const s = (inv.status || '').toLowerCase(); return s === 'sent' || s === 'unpaid' || s === 'overdue'; })
    .reduce((sum: number, inv: any) => sum + (inv.total || inv.amount || 0), 0);

  // Total Payables (sum of unpaid bills)
  const totalBillsList = Array.isArray(billsQuery.data) ? billsQuery.data : (billsQuery.data?.bills || billsQuery.data?.data || []);
  const payablesKobo = totalBillsList
    .filter((b: any) => { const s = (b.status || '').toLowerCase(); return s === 'unpaid' || s === 'overdue' || s === 'pending'; })
    .reduce((sum: number, b: any) => sum + (b.total || b.amount || 0), 0);

  // Net Profit Margin or dynamic PnL
  const netPnLKobo = totalCashKobo - payablesKobo;
  const pnlPercent = totalCashKobo > 0 ? Math.min(Math.round((netPnLKobo / totalCashKobo) * 100), 100) : 0;

  // Mock bank transaction list if there's no synchronized data yet
  const recentTransactions = (() => {
    const inList = Array.isArray(paymentsReceivedQuery.data) ? paymentsReceivedQuery.data : (paymentsReceivedQuery.data?.payments || []);
    return inList.slice(0, 5).map((p: any) => ({
      id: p.id,
      description: p.reference || p.paymentNumber || 'Payment Received',
      amount: p.amount || 0,
      date: p.date ? new Date(p.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '',
      category: p.paymentMethod || 'bank_transfer',
    }));
  })();

  // Visual chart datasets
  const cashForecastData = (() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { month: d.getMonth(), year: d.getFullYear(), name: months[d.getMonth()] };
    });
    const inList = Array.isArray(paymentsReceivedQuery.data) ? paymentsReceivedQuery.data : (paymentsReceivedQuery.data?.payments || []);
    const outList = Array.isArray(paymentsMadeQuery.data) ? paymentsMadeQuery.data : (paymentsMadeQuery.data?.payments || []);
    return last6.map(({ month, year, name }) => {
      const inflows = inList.filter((p: any) => {
        const d = new Date(p.date); return d.getMonth() === month && d.getFullYear() === year;
      }).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const outflows = outList.filter((p: any) => {
        const d = new Date(p.date); return d.getMonth() === month && d.getFullYear() === year;
      }).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      return { name, inflows, outflows };
    });
  })();

  const pnlBreakdownData = (() => {
    const inList = Array.isArray(paymentsReceivedQuery.data) ? paymentsReceivedQuery.data : (paymentsReceivedQuery.data?.payments || []);
    const outList = Array.isArray(paymentsMadeQuery.data) ? paymentsMadeQuery.data : (paymentsMadeQuery.data?.payments || []);
    const totalRevenue = inList.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalExpenses = outList.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalBills = totalBillsList.reduce((s: number, b: any) => s + (b.total || 0), 0);
    return [
      { name: 'Revenue Received', value: Math.round(totalRevenue / 100) },
      { name: 'Bills & Payables', value: Math.round(totalBills / 100) },
      { name: 'Payments Made', value: Math.round(totalExpenses / 100) },
    ].filter(d => d.value > 0);
  })();

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-viewport-box">
      
      {/* 1. Welcoming Title Section with Refresh action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Financial Overview</h2>
          <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase mt-1">
            Real-time corporate metrics ledger
          </p>
        </div>
        <div className="inline-flex items-center gap-3">
          <button 
            onClick={() => {
              accountsQuery.refetch();
              invoicesQuery.refetch();
              billsQuery.refetch();
            }}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl outline-none flex items-center text-xs font-semibold shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Synchronize Feed
          </button>
          
          <button
            onClick={() => navigate('/sales/invoices/new')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover outline-none rounded-lg shadow-sm cursor-pointer transition flex items-center"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Issue Invoice
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC FOUR-GRID KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="dashboard-kpi-grid">
        
        {/* KPI 1: Operating Cash / Bank Account */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200" id="kpi-card-cash">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Operating Liquidity</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-ink-900 font-sans tracking-tight tabular-nums">
              {formatNaira(totalCashKobo)}
            </h3>
            <div className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 mt-2 rounded bg-success-bg text-success-custom">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              {(() => { const inList = Array.isArray(paymentsReceivedQuery.data) ? paymentsReceivedQuery.data : (paymentsReceivedQuery.data?.payments || []); const now = new Date(); const thisMonth = inList.filter((p: any) => { const d = new Date(p.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s: number, p: any) => s + (p.amount || 0), 0); const lastMonth = inList.filter((p: any) => { const d = new Date(p.date); const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); }).reduce((s: number, p: any) => s + (p.amount || 0), 0); if (thisMonth === 0) return 'No inflows this month'; if (lastMonth === 0) return `₦${(thisMonth/100).toLocaleString()} received this month`; const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100); return `${pct >= 0 ? '+' : ''}${pct}% vs last month`; })()}
            </div>
          </div>
        </div>

        {/* KPI 2: Accounts Receivables */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200" id="kpi-card-ar">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Accounts Receivable</span>
            <div className="p-2 bg-info-bg text-info-custom rounded-xl">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-ink-900 font-sans tracking-tight tabular-nums">
              {formatNaira(receivablesKobo)}
            </h3>
            <div className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 mt-2 rounded bg-info-bg text-info-custom">
              <Activity className="w-3.5 h-3.5 mr-1" />
              {totalInvoicesList.filter((inv: any) => { const s = (inv.status || '').toLowerCase(); return s === 'sent' || s === 'unpaid' || s === 'overdue'; }).length} pending collections
            </div>
          </div>
        </div>

        {/* KPI 3: Accounts Payables */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200" id="kpi-card-ap">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Accounts Payable</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-ink-900 font-sans tracking-tight tabular-nums">
              {formatNaira(payablesKobo)}
            </h3>
            <div className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 mt-2 rounded bg-warning-bg text-warning-custom">
              <Layers className="w-3.5 h-3.5 mr-1" />
              {totalBillsList.filter((b: any) => { const s = (b.status || '').toLowerCase(); return s === 'unpaid' || s === 'overdue' || s === 'pending'; }).length} upcoming disbursements
            </div>
          </div>
        </div>

        {/* KPI 4: Operating Profit margin indicator */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200" id="kpi-card-margin">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 font-mono">Working Margin (pnl)</span>
            <div className="p-2 bg-primary-light text-primary rounded-xl">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-ink-900 font-sans tracking-tight tabular-nums">
              {pnlPercent}%
            </h3>
            <div className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 mt-2 rounded bg-primary-light text-primary">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              {totalCashKobo === 0 && payablesKobo === 0 ? 'No transaction data yet' : totalCashKobo > payablesKobo ? `Net positive: ₦${((totalCashKobo - payablesKobo) / 100).toLocaleString('en-NG', {notation:'compact'})}` : 'Net negative position'}
            </div>
          </div>
        </div>

      </div>

      {/* 3. CORE ANALYTICAL CHARTS SECTION (Recharts Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-layout">
        
        {/* Interactive Cash Flow Forecast (Span 2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" id="cashflow-forecast-widget">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-sans">Cash Flow Inflows vs Outflows</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Historical and projective cash transactions</p>
            </div>
            <div className="flex items-center space-x-3.5 text-xs font-semibold">
              <div className="flex items-center text-primary">
                <span className="w-2.5 h-2.5 bg-primary rounded-full mr-2"></span> Inflows
              </div>
              <div className="flex items-center text-danger-custom">
                <span className="w-2.5 h-2.5 bg-danger-custom rounded-full mr-2"></span> Outflows
              </div>
            </div>
          </div>

          <div className="h-64" id="cashflow-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashForecastData}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.08}/>
                    <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.08}/>
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="#94A3B8" />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#94A3B8" tickFormatter={(v) => `N${(v/100000000).toFixed(1)}M`} width={60} />
                <Tooltip />
                <Area type="monotone" dataKey="inflows" stroke="#2e7d32" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIn)" name="Cash Inflow" />
                <Area type="monotone" dataKey="outflows" stroke="#dc2626" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOut)" name="Cash Outflow" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operating Costs Chart Section (Span 1) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" id="pnl-breakdown-widget">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 font-sans">Operating Expenses Chart</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">P&L distribution breakdown</p>
          </div>

          <div className="h-64 mt-6" id="pnl-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlBreakdownData} layout="vertical" margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" opacity={0.5} />
                <XAxis type="number" fontSize={9} stroke="#94A3B8" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" fontSize={9} stroke="#64748B" axisLine={false} tickLine={false} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#2e7d32" radius={[0, 4, 4, 0]} barSize={12} name="Naira Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 4. RECENT TRANSACTIONS AND ACTIONS PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-recent-collections-grid">
        
        {/* Bank feed synchronisation ledger (Col 2) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm" id="banking-activity-list">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-sans">Bank Transactions Feed</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Real-time cleared transaction imports</p>
            </div>
            <button 
              onClick={() => navigate('/banking')}
              className="text-xs font-bold text-primary hover:text-primary-hover outline-none flex items-center"
            >
              Reconcile All <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100" id="transactions-feed-scroller">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/40 rounded-xl px-1.5 transition">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50/70 text-rose-600'}`}>
                    {tx.amount > 0 ? <PlusCircle className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-800 truncate leading-tight">{tx.description}</h4>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold font-mono inline-block mt-1">{tx.category}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <AmountDisplay amountInKobo={tx.amount} colorize="debit-credit" type={tx.amount > 0 ? 'debit' : 'credit'} className="text-xs font-bold font-mono" />
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5 font-mono">{tx.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Corporate Quick Operations panel (Col 1) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between" id="operations-payouts-box">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 font-sans">Financial Quick Actions</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Strategic operations launcher</p>

            <div className="space-y-3 mt-5" id="dashboard-shortcuts-stack">
              <button 
                onClick={() => navigate('/sales/invoices/new')}
                className="w-full text-left p-3 border border-slate-150 rounded-xl hover:border-primary-light hover:bg-primary-light/10 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800">Issue Corporate Invoice</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">B2B client invoices with 7.5% VAT</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-350 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              <button 
                onClick={() => navigate('/purchases/bills/new')}
                className="w-full text-left p-3 border border-slate-150 rounded-xl hover:border-primary-light hover:bg-primary-light/10 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800">Post Outgoing Expense</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Capture immediate spend and OCR receipt</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-350 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>

              <button 
                onClick={() => navigate('/banking')}
                className="w-full text-left p-3 border border-slate-150 rounded-xl hover:border-primary-light hover:bg-primary-light/10 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800">Review Payroll Runs</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Approve current PAYE and pension payrolls</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-350 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-6 bg-slate-50/35 p-3 rounded-xl flex items-center space-x-3" id="quick-actions-help-bubble">
            <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0"></span>
            <p className="text-[10px] text-slate-505 text-slate-500 leading-snug">
              GAAP Audit ledger guarantees balanced double-record reconciliation on all outflow actions.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
export default Dashboard;










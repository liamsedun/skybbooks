import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, DollarSign, TrendingUp, Users, CreditCard, RefreshCw,
  Loader2, ArrowUpRight, ArrowDownLeft, PieChart, Activity, Globe,
  Building2, Calendar, Filter, Download,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart as RePieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface AnalyticsData {
  mrrKobo: number;
  arrKobo: number;
  ltvKobo: number;
  arpuKobo: number;
  churnRate: number;
  trialConversionRate: number;
  paymentSuccessRate: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalRevenueKobo: number;
  totalAtStart: number;
  renewalRate: number;
  upgradeRate: number;
  downgradeRate: number;
  planBreakdown: Array<{ planName: string; subs: number; mrrKobo: number; arrKobo: number }>;
  revenueByPlan: Array<{ planName: string; revenueKobo: number; count: number }>;
  revenueByCountry: Array<{ country: string; revenueKobo: number; count: number }>;
  growthTrends: Array<{ month: string; newOrgs: number; revenueKobo: number; newSubs: number; churnedSubs: number }>;
  topCustomers: Array<{ orgId: string; orgName: string; orgEmail: string; totalRevenueKobo: number; invoiceCount: number; lastPayment: string }>;
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function fmtPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

export function SaaSAnalyticsDashboard() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('');

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (planFilter) params.set('planId', planFilter);
    if (regionFilter) params.set('region', regionFilter);
    if (billingFilter) params.set('billingCycle', billingFilter);
    return params.toString();
  }, [startDate, endDate, planFilter, regionFilter, billingFilter]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['super-admin', 'analytics', filters],
    queryFn: async () => {
      const res = await api.get(`/admin/analytics?${filters}`);
      return res.data.data as AnalyticsData;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['super-admin', 'plans-list'],
    queryFn: async () => {
      const res = await api.get('/admin/plans');
      return res.data.data as Array<{ id: string; name: string }>;
    },
  });

  const kpiCards = data ? [
    { label: 'MRR', value: fmtNaira(data.mrrKobo), icon: DollarSign, color: 'blue', change: '' },
    { label: 'ARR', value: fmtNaira(data.arrKobo), icon: TrendingUp, color: 'blue', change: '' },
    { label: 'LTV', value: fmtNaira(data.ltvKobo), icon: CreditCard, color: 'green', change: '' },
    { label: 'ARPU', value: fmtNaira(data.arpuKobo), icon: Users, color: 'green', change: '' },
    { label: 'Churn Rate', value: fmtPercent(data.churnRate), icon: ArrowDownLeft, color: data.churnRate > 5 ? 'red' : 'green', change: '' },
    { label: 'Trial Conversion', value: fmtPercent(data.trialConversionRate), icon: TrendingUp, color: 'blue', change: '' },
    { label: 'Payment Success', value: fmtPercent(data.paymentSuccessRate), icon: Activity, color: data.paymentSuccessRate > 90 ? 'green' : 'red', change: '' },
    { label: 'Renewal Rate', value: fmtPercent(data.renewalRate), icon: RefreshCw, color: 'blue', change: '' },
    { label: 'Active Subs', value: data.activeSubscriptions.toLocaleString(), icon: Users, color: 'green', change: '' },
    { label: 'Cancelled', value: data.cancelledSubscriptions.toLocaleString(), icon: Users, color: 'red', change: '' },
    { label: 'Upgrade Rate', value: fmtPercent(data.upgradeRate), icon: ArrowUpRight, color: 'green', change: '' },
    { label: 'Downgrade Rate', value: fmtPercent(data.downgradeRate), icon: ArrowDownLeft, color: 'amber', change: '' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SaaS Analytics Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide subscription & revenue analytics</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plan</label>
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All Plans</option>
              {plans?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Billing Cycle</label>
            <select value={billingFilter} onChange={e => setBillingFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All Cycles</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <input type="text" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
              placeholder="Filter by country..." className="border rounded-lg px-3 py-1.5 text-sm w-40" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiCards.map(k => (
              <div key={k.label} className="bg-white rounded-xl border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${
                    k.color === 'red' ? 'bg-red-50 text-red-600' :
                    k.color === 'green' ? 'bg-green-50 text-green-600' :
                    k.color === 'amber' ? 'bg-amber-50 text-amber-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    <k.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs text-gray-500">{k.label}</span>
                </div>
                <p className="text-base font-bold text-gray-900">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">MRR by Plan</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.planBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="planName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => `₦${(Number(v) / 100_000_000).toFixed(0)}M`} />
                  <Tooltip formatter={(v: any) => fmtNaira(Number(v))} />
                  <Bar dataKey="mrrKobo" fill="#3b82f6" radius={[4, 4, 0, 0]} name="MRR" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Plan (All Time)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <RePieChart>
                  <Pie data={data.revenueByPlan} dataKey="revenueKobo" nameKey="planName" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.planName}`}>
                    {data.revenueByPlan.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtNaira(Number(v))} />
                </RePieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Growth Trends (12 months)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.growthTrends}>
                  <defs>
                    <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="subsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} yAxisId="left" tickFormatter={(v: any) => `₦${(Number(v) / 100_000_000).toFixed(0)}M`} />
                  <YAxis tick={{ fontSize: 11 }} yAxisId="right" orientation="right" />
                  <Tooltip formatter={(v: any, name: any) => name === 'revenueKobo' ? fmtNaira(Number(v)) : v} />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="revenueKobo" stroke="#3b82f6" fill="url(#revGrad2)" strokeWidth={2} name="Revenue" />
                  <Area yAxisId="right" type="monotone" dataKey="newSubs" stroke="#10b981" fill="url(#subsGrad)" strokeWidth={2} name="New Subs" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Country</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.revenueByCountry} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => `₦${(Number(v) / 100_000_000).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => fmtNaira(Number(v))} />
                  <Bar dataKey="revenueKobo" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Top Paying Customers</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Organization</th>
                  <th className="text-left p-3 font-medium text-gray-600">Email</th>
                  <th className="text-right p-3 font-medium text-gray-600">Total Revenue</th>
                  <th className="text-right p-3 font-medium text-gray-600">Invoices</th>
                  <th className="text-right p-3 font-medium text-gray-600">Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map(c => (
                  <tr key={c.orgId} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.orgName}</td>
                    <td className="p-3 text-gray-500">{c.orgEmail}</td>
                    <td className="p-3 text-right font-medium text-green-600">{fmtNaira(c.totalRevenueKobo)}</td>
                    <td className="p-3 text-right text-gray-500">{c.invoiceCount}</td>
                    <td className="p-3 text-right text-gray-500">{fmtDate(c.lastPayment)}</td>
                  </tr>
                ))}
                {data.topCustomers.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">No data found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

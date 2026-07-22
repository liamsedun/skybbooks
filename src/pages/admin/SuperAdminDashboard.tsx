import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, CreditCard, AlertTriangle, DollarSign, Activity,
  Clock, HardDrive, BarChart3, Loader2, TrendingUp, RefreshCw,
  CheckCircle2, XCircle, Search, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface DashboardData {
  kpis: {
    totalOrganizations: number;
    activeSubscriptions: number;
    trialAccounts: number;
    expiredAccounts: number;
    suspendedAccounts: number;
    mrrKobo: number;
    arrKobo: number;
    totalRevenueKobo: number;
    totalUsers: number;
    failedPayments: number;
    storageUsed: number;
    apiCalls: number;
  };
  revenueOverTime: Array<{ month: string; revenueKobo: number; subscriptions: number }>;
  planDistribution: Array<{ planName: string; count: number; revenueKobo: number }>;
  orgGrowth: Array<{ month: string; newOrgs: number; newUsers: number }>;
  recentOrganizations: Array<{ id: string; name: string; email: string; createdAt: string; status: string }>;
  failedPayments: Array<{ id: string; orgName: string; amountKobo: number; date: string; reason: string }>;
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function SuperAdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'organizations' | 'payments' | 'plans'>('overview');

  const { data: dashData, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/platform/dashboard');
      return res.data.data as DashboardData;
    },
    refetchInterval: 30000,
  });

  const { data: orgList, isLoading: orgsLoading } = useQuery({
    queryKey: ['super-admin', 'organizations'],
    queryFn: async () => {
      const res = await api.get('/platform/organizations?pageSize=50');
      return res.data;
    },
    enabled: tab === 'organizations',
  });

  const { data: failedPmts, isLoading: pmtsLoading } = useQuery({
    queryKey: ['super-admin', 'failed-payments'],
    queryFn: async () => {
      const res = await api.get('/platform/failed-payments?limit=50');
      return res.data.data as Array<any>;
    },
    enabled: tab === 'payments',
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: async () => {
      const res = await api.get('/platform/plans');
      return res.data.data as Array<any>;
    },
    enabled: tab === 'plans',
  });

  const kpis = dashData?.kpis;

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'organizations' as const, label: 'Organizations', icon: Building2 },
    { id: 'payments' as const, label: 'Failed Payments', icon: AlertTriangle },
    { id: 'plans' as const, label: 'Plans & Coupons', icon: CreditCard },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide oversight and analytics</p>
        </div>
        <button onClick={() => refetchDash()} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${tab === t.id ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {dashLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
          ) : kpis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={Building2} label="Organizations" value={kpis.totalOrganizations.toLocaleString()} color="blue" />
                <KpiCard icon={Users} label="Active Subscriptions" value={kpis.activeSubscriptions.toLocaleString()} color="green" />
                <KpiCard icon={Clock} label="Trial Accounts" value={kpis.trialAccounts.toLocaleString()} color="amber" />
                <KpiCard icon={XCircle} label="Expired" value={kpis.expiredAccounts.toLocaleString()} color="red" />
                <KpiCard icon={AlertTriangle} label="Suspended" value={kpis.suspendedAccounts.toLocaleString()} color="red" />
                <KpiCard icon={TrendingUp} label="MRR" value={fmtNaira(kpis.mrrKobo)} color="blue" />
                <KpiCard icon={DollarSign} label="ARR" value={fmtNaira(kpis.arrKobo)} color="blue" />
                <KpiCard icon={CreditCard} label="Total Revenue" value={fmtNaira(kpis.totalRevenueKobo)} color="green" />
                <KpiCard icon={Users} label="Total Users" value={kpis.totalUsers.toLocaleString()} color="blue" />
                <KpiCard icon={AlertTriangle} label="Failed Payments" value={kpis.failedPayments.toLocaleString()} color="red" />
                <KpiCard icon={HardDrive} label="Storage" value={formatBytes(kpis.storageUsed)} color="gray" />
                <KpiCard icon={Activity} label="API Calls (month)" value={kpis.apiCalls.toLocaleString()} color="gray" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue Trend (6 months)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={dashData.revenueOverTime}>
                      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 100_000_000).toFixed(0)}M`} />
                      <Tooltip formatter={(v: any) => fmtNaira(Number(v))} />
                      <Area type="monotone" dataKey="revenueKobo" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Plan Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={dashData.planDistribution} dataKey="count" nameKey="planName" cx="50%" cy="50%" outerRadius={80} label={(entry: any) => `${entry.planName}: ${entry.count}`}>
                        {dashData.planDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Organization Growth (12 months)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={dashData.orgGrowth}>
                      <defs><linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="newOrgs" stroke="#10b981" fill="url(#orgGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Plan Revenue</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashData.planDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="planName" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 100_000_000).toFixed(0)}M`} />
                      <Tooltip formatter={(v: any) => fmtNaira(Number(v))} />
                      <Bar dataKey="revenueKobo" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Organizations</h3>
                  <div className="space-y-3">
                    {dashData.recentOrganizations.slice(0, 5).map(org => (
                      <div key={org.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{org.name}</p>
                          <p className="text-xs text-gray-500">{org.email}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${org.status === 'active' ? 'bg-green-100 text-green-700' : org.status === 'free_trial' ? 'bg-blue-100 text-blue-700' : org.status === 'expired' ? 'bg-red-100 text-red-700' : org.status === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {org.status || 'N/A'}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(org.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Failed Payments</h3>
                  <div className="space-y-3">
                    {dashData.failedPayments.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.orgName}</p>
                          <p className="text-xs text-gray-500">{p.reason || 'No reason'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">{fmtNaira(p.amountKobo)}</p>
                          <p className="text-xs text-gray-400">{fmtDate(p.date)}</p>
                        </div>
                      </div>
                    ))}
                    {dashData.failedPayments.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">No failed payments</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {tab === 'organizations' && (
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input placeholder="Search organizations..." className="flex-1 text-sm outline-none" />
          </div>
          {orgsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Name</th>
                  <th className="text-left p-3 font-medium text-gray-600">Email</th>
                  <th className="text-left p-3 font-medium text-gray-600">Plan</th>
                  <th className="text-left p-3 font-medium text-gray-600">Status</th>
                  <th className="text-left p-3 font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgList?.data?.map((org: any) => (
                  <tr key={org.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{org.name}</td>
                    <td className="p-3 text-gray-500">{org.email}</td>
                    <td className="p-3">{org.planName || '-'}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${org.status === 'active' ? 'bg-green-100 text-green-700' : org.status === 'free_trial' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {org.status || 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{fmtDate(org.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white rounded-xl border">
          {pmtsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-600">Organization</th>
                  <th className="text-left p-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left p-3 font-medium text-gray-600">Gateway</th>
                  <th className="text-left p-3 font-medium text-gray-600">Reason</th>
                  <th className="text-left p-3 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {failedPmts?.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{p.orgName}</td>
                    <td className="p-3 text-red-600 font-medium">{fmtNaira(p.amountKobo)}</td>
                    <td className="p-3 text-gray-500">{p.gateway}</td>
                    <td className="p-3 text-gray-500 max-w-[200px] truncate">{p.failureReason || '-'}</td>
                    <td className="p-3 text-gray-500">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
                {(!failedPmts || failedPmts.length === 0) && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">No failed payments found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Subscription Plans</h3>
            {plansLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-3">
                {plans?.map((plan: any) => (
                  <div key={plan.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                      <p className="text-xs text-gray-500">{plan.code} · {fmtNaira(plan.amountKobo)}/{plan.interval}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Successful Payments</h3>
            <p className="text-sm text-gray-400 text-center py-10">Payment history available in subscriptions billing section</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, DollarSign, Building2, Users, Clock, XCircle, Activity,
  CreditCard, LifeBuoy, HardDrive, Zap, Shield, BarChart3, Loader2,
  RefreshCw, ArrowUpRight, ArrowDownRight, Hash, Ticket, Server,
  PieChart, Package, UserPlus, AlertTriangle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart as RePieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000_000) return `\u20A6${(v / 100_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `\u20A6${(v / 100_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `\u20A6${(v / 100_000).toFixed(1)}K`;
  return fmtNaira(v);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface DashboardData {
  kpis: {
    totalOrganizations: number; activeSubscriptions: number; trialAccounts: number;
    expiredAccounts: number; suspendedAccounts: number; mrrKobo: number; arrKobo: number;
    totalRevenueKobo: number; totalUsers: number; failedPayments: number;
    storageUsed: number; apiCalls: number; churnRate: number; revenueGrowth: number;
    orgGrowthRate: number; totalPlatformUsers: number; openTickets: number; totalTickets: number;
  };
  revenueOverTime: Array<{ month: string; revenueKobo: number; subscriptions: number }>;
  planDistribution: Array<{ planName: string; count: number; revenueKobo: number }>;
  orgGrowth: Array<{ month: string; newOrgs: number; newUsers: number }>;
  recentOrganizations: Array<{ id: string; name: string; email: string; createdAt: string; status: string }>;
  topCustomers: Array<{ id: string; name: string; email: string; planName: string; totalPaidKobo: number; status: string }>;
  topPlans: Array<{ planName: string; orgCount: number; revenueKobo: number; monthlyPriceKobo: number }>;
  supportTicketStats: { open: number; inProgress: number; resolved: number; closed: number };
  serverStatus: { activeUsers: number; newOrgsToday: number; storageUsedBytes: number; dbSize: number; uptime: number };
  featureUsage: Array<{ featureKey: string; usageCount: number; orgCount: number }>;
}

export function PlatformDashboardPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['platform-dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data.data as DashboardData;
    },
    refetchInterval: 60000,
  });

  const k = data?.kpis;

  const SummaryCards = [
    { label: 'MRR', value: k ? fmtK(k.mrrKobo) : '—', icon: TrendingUp, color: 'indigo', sub: k ? `${k.revenueGrowth >= 0 ? '+' : ''}${k.revenueGrowth}% vs prev` : '' },
    { label: 'ARR', value: k ? fmtK(k.arrKobo) : '—', icon: DollarSign, color: 'indigo', sub: 'Annual Run Rate' },
    { label: 'Active Orgs', value: k ? k.activeSubscriptions.toLocaleString() : '—', icon: Building2, color: 'emerald', sub: `${k ? k.orgGrowthRate + '% growth' : ''}` },
    { label: 'Trial Orgs', value: k ? k.trialAccounts.toLocaleString() : '—', icon: Clock, color: 'amber', sub: `${k ? ((k.trialAccounts / Math.max(k.totalOrganizations, 1)) * 100).toFixed(0) : 0}% of total` },
    { label: 'Expired', value: k ? k.expiredAccounts.toLocaleString() : '—', icon: XCircle, color: 'red', sub: `Churn: ${k ? k.churnRate : 0}%` },
    { label: 'Total Revenue', value: k ? fmtK(k.totalRevenueKobo) : '—', icon: CreditCard, color: 'emerald', sub: 'Lifetime' },
    { label: 'Total Users', value: k ? k.totalUsers.toLocaleString() : '—', icon: Users, color: 'blue', sub: `${k ? k.totalPlatformUsers : 0} platform admins` },
    { label: 'Failed Payments', value: k ? k.failedPayments.toLocaleString() : '—', icon: AlertTriangle, color: 'red', sub: 'Requires attention' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm text-slate-400 font-medium">Loading platform intelligence...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Executive overview of your entire SaaS ecosystem</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SummaryCards.map(card => {
          const colorMap: Record<string, string> = {
            indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600',
            amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
            blue: 'bg-blue-50 text-blue-600',
          };
          return (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${colorMap[card.color] || 'bg-indigo-50 text-indigo-600'}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                {card.label === 'MRR' && k && k.revenueGrowth !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${k.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {k.revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(k.revenueGrowth)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3">{card.label}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{card.value}</p>
              {card.sub && <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Revenue Trend</h3>
            <span className="text-[11px] text-slate-400">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.revenueOverTime || []}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `₦${(v / 100_000_000).toFixed(0)}M`} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(v: any) => [fmtNaira(Number(v)), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenueKobo" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Organization Growth */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Organization Growth</h3>
            <span className="text-[11px] text-slate-400">12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data?.orgGrowth || []}>
              <defs>
                <linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(v: any) => [Number(v).toLocaleString(), 'New Orgs']}
              />
              <Area type="monotone" dataKey="newOrgs" stroke="#10b981" fill="url(#orgGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RePieChart>
              <Pie
                data={data?.planDistribution || []}
                dataKey="count" nameKey="planName"
                cx="50%" cy="50%" outerRadius={80}
                label={({ planName, count }: any) => `${planName}: ${count}`}
              >
                {(data?.planDistribution || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        {/* Support Tickets */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Support Tickets</h3>
            <LifeBuoy className="w-4 h-4 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{data?.supportTicketStats.open || 0}</p>
              <p className="text-xs text-red-500">Open</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{data?.supportTicketStats.inProgress || 0}</p>
              <p className="text-xs text-amber-500">In Progress</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{data?.supportTicketStats.resolved || 0}</p>
              <p className="text-xs text-blue-500">Resolved</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{data?.supportTicketStats.closed || 0}</p>
              <p className="text-xs text-emerald-500">Closed</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total: {data?.kpis.totalTickets || 0}</span>
            <span>{(data?.kpis.openTickets || 0) > 0
              ? `${((data?.supportTicketStats.closed || 0) / Math.max(data?.kpis.totalTickets || 1, 1) * 100).toFixed(0)}% resolved`
              : 'No tickets'}</span>
          </div>
        </div>

        {/* Platform Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Platform Health</h3>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">Server Status</span>
              </div>
              <span className="text-sm font-semibold text-emerald-600">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Uptime</span>
              <span className="text-sm font-semibold text-slate-800">{data?.serverStatus.uptime || 99.9}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Active Users</span>
              <span className="text-sm font-semibold text-slate-800">{fmtCompact(data?.serverStatus.activeUsers || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Storage</span>
              <span className="text-sm font-semibold text-slate-800">{formatBytes(data?.serverStatus.storageUsedBytes || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">DB Size</span>
              <span className="text-sm font-semibold text-slate-800">{formatBytes(data?.serverStatus.dbSize || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Platform Admins</span>
              <span className="text-sm font-semibold text-slate-800">{data?.kpis.totalPlatformUsers || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Usage + Top Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700">Feature Usage</h3>
          </div>
          <div className="space-y-2">
            {data?.featureUsage.slice(0, 8).map(f => (
              <div key={f.featureKey} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700 capitalize">{f.featureKey.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-slate-400">({f.orgCount} orgs)</span>
                </div>
                <span className="text-xs font-semibold text-slate-800">{fmtCompact(f.usageCount)}</span>
              </div>
            ))}
            {(!data?.featureUsage || data.featureUsage.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No feature usage data yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700">Top Plans by Revenue</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.topPlans || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `₦${(v / 100_000_000).toFixed(0)}M`} />
              <YAxis dataKey="planName" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                formatter={(v: any) => [fmtNaira(Number(v)), 'Revenue']}
              />
              <Bar dataKey="revenueKobo" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers & Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700">Top Customers by Revenue</h3>
          </div>
          <div className="space-y-1">
            {data?.topCustomers.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.planName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{fmtNaira(c.totalPaidKobo)}</p>
                  <span className={`text-[11px] ${c.status === 'active' ? 'text-emerald-600' : c.status === 'free_trial' ? 'text-amber-600' : 'text-red-500'}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
            {(!data?.topCustomers || data.topCustomers.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No customer data yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700">Recent Registrations</h3>
          </div>
          <div className="space-y-1">
            {data?.recentOrganizations.slice(0, 10).map(org => (
              <div key={org.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{org.name}</p>
                  <p className="text-xs text-slate-400">{org.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{fmtDate(org.createdAt)}</p>
                </div>
              </div>
            ))}
            {(!data?.recentOrganizations || data.recentOrganizations.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No recent registrations</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

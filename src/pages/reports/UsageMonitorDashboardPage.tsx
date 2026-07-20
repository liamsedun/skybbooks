import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import {
  Loader2, AlertTriangle, CheckCircle2, XCircle, Users, Building2,
  FileText, UserCheck, Truck, Package, ArrowLeftRight, Globe, HardDrive,
  ScanLine, Zap, Layers, Briefcase, Warehouse, Search, RefreshCw,
  BarChart3, Info, TrendingUp, AlertCircle
} from 'lucide-react';

interface UsageMetric {
  resource: string;
  label: string;
  current: number;
  limit: number;
  percent: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded' | 'unlimited';
}

interface DashboardData {
  metrics: UsageMetric[];
  overall: {
    totalResources: number;
    totalLimit: number;
    overallPercent: number;
    status: UsageMetric['status'];
  };
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  users: Users, companies: Building2, invoices: FileText,
  customers: UserCheck, suppliers: Truck, products: Package,
  transactions: ArrowLeftRight, apiCalls: Globe, storage: HardDrive,
  ocrDocuments: ScanLine, aiRequests: Zap, projects: Layers,
  assets: Briefcase, warehouses: Warehouse,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  ok: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  critical: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle },
  exceeded: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  unlimited: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Info },
};

function UsageBar({ percent, status }: { percent: number; status: string }) {
  const colorMap: Record<string, string> = {
    ok: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-orange-500', exceeded: 'bg-red-500', unlimited: 'bg-slate-300',
  };
  return (
    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${colorMap[status] || 'bg-emerald-500'}`}
        style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function MetricCard({ metric, onCheck }: { metric: UsageMetric; onCheck?: (r: string) => void }) {
  const Icon = RESOURCE_ICONS[metric.resource] || BarChart3;
  const StatusIcon = STATUS_STYLES[metric.status]?.icon || Info;
  const statusStyle = STATUS_STYLES[metric.status] || STATUS_STYLES.ok;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{metric.label}</h3>
            <p className="text-sm text-slate-500">{metric.resource}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {metric.status === 'unlimited' ? 'Unlimited' : metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-slate-900">{metric.current.toLocaleString()}</span> used
          </span>
          <span className="text-slate-500">
            {metric.limit > 0 ? `${metric.limit.toLocaleString()} limit` : 'No limit'}
          </span>
        </div>
        <UsageBar percent={metric.percent} status={metric.status} />
        {metric.limit > 0 && (
          <p className="text-xs text-slate-400">
            {metric.percent}% consumed
            {metric.status === 'exceeded' && ' — Upgrade required'}
            {metric.status === 'critical' && ' — Almost full'}
            {metric.status === 'warning' && ' — Nearing limit'}
          </p>
        )}
      </div>
    </div>
  );
}

export function UsageMonitorDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = user?.organisationId;
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch, isRefetching } = useQuery<{ data: DashboardData }>({
    queryKey: ['usage-monitor', orgId],
    queryFn: () => reportsApi.getUsageDashboard(),
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const dashboard = data?.data;
  const metrics = dashboard?.metrics || [];
  const overall = dashboard?.overall;

  const filtered = search
    ? metrics.filter(m => m.label.toLowerCase().includes(search.toLowerCase()) || m.resource.toLowerCase().includes(search.toLowerCase()))
    : metrics;

  const statusCounts = metrics.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-700 mb-1">Failed to load usage data</h2>
          <p className="text-sm text-red-600 mb-4">{(error as any)?.message || 'An unexpected error occurred'}</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" /> Usage Monitor
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time resource usage vs. subscription plan limits</p>
        </div>
        <button onClick={() => refetch()} disabled={isRefetching}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Overall Status Bar */}
      {overall && (
        <div className={`rounded-xl border p-5 ${
          overall.status === 'exceeded' ? 'bg-red-50 border-red-200' :
          overall.status === 'critical' ? 'bg-orange-50 border-orange-200' :
          overall.status === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className={`w-5 h-5 ${
                  overall.status === 'exceeded' ? 'text-red-600' :
                  overall.status === 'critical' ? 'text-orange-600' :
                  overall.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'
                }`} />
                <span className="font-semibold text-slate-900">Overall Consumption</span>
              </div>
              <UsageBar percent={overall.overallPercent} status={overall.status} />
            </div>
            <div className="text-center md:text-right">
              <p className="text-2xl font-bold text-slate-900">{overall.overallPercent}%</p>
              <p className="text-sm text-slate-500">{overall.totalResources.toLocaleString()} / {overall.totalLimit.toLocaleString()} total</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['ok', 'warning', 'critical', 'exceeded', 'unlimited'].map(status => {
          const count = statusCounts[status] || 0;
          const style = STATUS_STYLES[status];
          return (
            <div key={status} className={`rounded-xl border p-4 ${style.bg} border-transparent`}>
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${style.bg} ${style.text}`}>
                <style.icon className="w-3 h-3" /> {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
              <p className="text-xs text-slate-500">resources</p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search resources..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(metric => (
          <MetricCard key={metric.resource} metric={metric} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-2" />
          <p>No resources match your search.</p>
        </div>
      )}
    </div>
  );
}

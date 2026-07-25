import { useQuery } from '@tanstack/react-query';
import {
  Users, AlertTriangle, Loader2, RefreshCw,
  CheckCircle2, Server, BarChart3, Zap, Database, HardDrive,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../../lib/api';

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-surface-subtle text-ink-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-surface rounded-xl border p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-lg font-bold text-ink-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-surface rounded-xl border p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-sm font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}

export function SystemHealthPage() {
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await api.get('/platform/system-health');
      return res.data.data as any;
    },
    retry: 1,
  });

  const kpis = healthData?.kpis;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">System Health</h1>
          <p className="text-sm text-ink-500 mt-1">Performance monitoring and error tracking</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle2} label="Uptime" value={healthData?.uptime != null ? `${healthData.uptime.toFixed(1)}%` : 'N/A'} sub="Last 30 days" color={healthData?.uptime != null && healthData.uptime < 99 ? 'red' : 'green'} />
        <KpiCard icon={Users} label="Active Users" value={kpis?.activeUsers?.toLocaleString() ?? 'N/A'} sub="Registered users" color="blue" />
        <KpiCard icon={Database} label="Platform Users" value={kpis?.activePlatformUsers?.toLocaleString() ?? 'N/A'} sub="Active sessions" color="purple" />
        <KpiCard icon={HardDrive} label="Storage" value={kpis?.storageUsedBytes != null ? fmtBytes(kpis.storageUsedBytes) : 'N/A'} sub="Documents" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">New Organisations Today</h3>
          <p className="text-3xl font-bold text-ink-900">{kpis?.newOrgsToday ?? 0}</p>
          <p className="text-xs text-ink-400 mt-1">Organisations created in the last 24 hours</p>
          <div className="mt-4 h-2 bg-surface-subtle rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (kpis?.newOrgsToday || 0) * 5)}%` }} />
          </div>
        </div>
        <div className="bg-surface rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Chat Messages</h3>
          <p className="text-3xl font-bold text-ink-900">{kpis?.totalChatMessages?.toLocaleString() ?? 0}</p>
          <p className="text-xs text-ink-400 mt-1">Total messages across all organisations</p>
          <div className="mt-4 h-2 bg-surface-subtle rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, ((kpis?.totalChatMessages || 0) / 1000) * 10)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard icon={Server} label="Application Server" value={healthData?.appServer || 'Healthy'} color="green" />
        <InfoCard icon={BarChart3} label="Database" value={healthData?.dbStatus || 'Connected'} color="blue" />
        <InfoCard icon={Zap} label="Cache / Queue" value={healthData?.cacheStatus || 'Operational'} color="purple" />
      </div>

      {kpis?.errorCount != null && kpis.errorCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {kpis.errorCount} error{kpis.errorCount !== 1 ? 's' : ''} recorded in the last 24 hours. Check the <a href="/platform/audit-log" className="underline font-medium">Audit Log</a> for details.
          </p>
        </div>
      )}

      {kpis?.dbSize != null && kpis.dbSize > 0 && (
        <div className="bg-surface rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-2">Database Size</h3>
          <p className="text-2xl font-bold text-ink-900">{fmtBytes(kpis.dbSize)}</p>
        </div>
      )}
    </div>
  );
}

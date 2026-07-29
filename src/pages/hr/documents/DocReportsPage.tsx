import { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Download } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { hrApi } from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { exportToCsv } from '../../../lib/hrExport';

interface DashboardData {
  totalFiles: number;
  activeFiles: number;
  expiredFiles: number;
  totalCategories: number;
  totalSize: number;
}

function fmtFileSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function DocReportsPage() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getDocDashboard();
      setDashboard(res?.data || res);
    } catch (err) { console.toast(err, 'error'); }
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, []);

  const stats = dashboard ? [
    { label: 'Total Files', value: dashboard.totalFiles, icon: <BarChart3 className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Active', value: dashboard.activeFiles, icon: <BarChart3 className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Expired', value: dashboard.expiredFiles, icon: <BarChart3 className="w-4 h-4" />, color: 'rose' as const },
    { label: 'Categories', value: dashboard.totalCategories, icon: <BarChart3 className="w-4 h-4" />, color: 'purple' as const },
    { label: 'Total Size', value: fmtFileSize(dashboard.totalSize), icon: <BarChart3 className="w-4 h-4" />, color: 'amber' as const },
  ] : [];

  return (
    <HrPageShell title="Document Reports" description="Overview of document management activity"
      pageKey="doc-reports"
      headerActions={
        <>
          <button onClick={fetchDashboard} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {dashboard && (
            <button onClick={() => {
              exportToCsv(['Metric', 'Value'], [
                ['Total Files', String(dashboard.totalFiles)],
                ['Active', String(dashboard.activeFiles)],
                ['Expired', String(dashboard.expiredFiles)],
                ['Categories', String(dashboard.totalCategories)],
                ['Total Size', fmtFileSize(dashboard.totalSize)],
              ], 'doc-report');
              toast('Exported', 'success');
            }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
        </>
      }>
      {loading ? (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-ink-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-sm font-medium">Loading dashboard...</p>
          </div>
        </div>
      ) : !dashboard ? (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 flex items-center justify-center">
          <p className="text-sm text-ink-400">No data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{s.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-ink-900 tabular-nums">{s.value}</p>
                </div>
                <div className={`p-2 rounded-xl shrink-0 ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : s.color === 'rose' ? 'bg-rose-100 text-rose-600' : s.color === 'purple' ? 'bg-purple-100 text-purple-600' : s.color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {s.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </HrPageShell>
  );
}

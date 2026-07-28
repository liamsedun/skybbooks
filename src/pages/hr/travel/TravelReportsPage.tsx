import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { hrApi } from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { exportToCsv } from '../../../lib/hrExport';

const fmtAmount = (n: number) => `₦${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function TravelReportsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    hrApi.getTravelReport().then((res: any) => {
      setReport(res?.data ?? res);
    }).catch(() => showError('Failed to load travel report'))
    .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => [
    { label: 'Total Requests', value: report?.totalRequests ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Approved', value: report?.approved ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Completed', value: report?.completed ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'cyan' as const },
    { label: 'Total Cost (₦)', value: report?.totalCost != null ? fmtAmount(report.totalCost) : '₦0', icon: <BarChart3 className="w-4 h-4" />, color: 'purple' as const },
    { label: 'Total Advances', value: report?.totalAdvances ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Advance Amount (₦)', value: report?.totalAdvanceAmount != null ? fmtAmount(report.totalAdvanceAmount) : '₦0', icon: <BarChart3 className="w-4 h-4" />, color: 'amber' as const },
    { label: 'Total Expenses', value: report?.totalExpenses != null ? fmtAmount(report.totalExpenses) : '₦0', icon: <BarChart3 className="w-4 h-4" />, color: 'rose' as const },
    { label: 'Reimbursed', value: report?.reimbursed ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Pending Settlements', value: report?.pendingSettlements ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'amber' as const },
  ], [report]);

  return (
    <HrPageShell title="Travel Reports" description="Overview and analytics for travel activity"
      pageKey="travel-reports"
      headerActions={
        <>
          <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => {
            const rows = stats.map(s => [s.label, String(s.value)]);
            exportToCsv(['Metric', 'Value'], rows, 'travel-report');
            showSuccess('Exported');
          }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
        </>
      }>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm font-medium">Loading report...</span>
        </div>
      ) : (
        <HrStatCards items={stats} columns={3} />
      )}
    </HrPageShell>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Users, Wallet, Gift, Percent, Award, Shield, RefreshCw, Download } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { hrApi } from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';
import { exportToCsv } from '../../../lib/hrExport';

const fmtCurrency = (n: number) => '₦' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });

export function CompensationReportsPage() {
  const { success, error: showError } = useToast();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrApi.getCompensationReport();
      setReport(res?.data ?? res);
    } catch (e) {
      showError('Failed to load compensation report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const r = report ?? {};

  const statCards = [
    { label: 'Total Pay Grades', value: r.totalPayGrades ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900 text-blue-600' },
    { label: 'Active Pay Grades', value: r.activePayGrades ?? 0, icon: <Award className="w-4 h-4" />, color: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900 text-emerald-600' },
    { label: 'Employees w/ Compensation', value: r.totalEmployees ?? 0, icon: <Users className="w-4 h-4" />, color: 'bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900 text-purple-600' },
    { label: 'Total Salary Cost', value: fmtCurrency(r.totalSalaryCost ?? 0), icon: <DollarSign className="w-4 h-4" />, color: 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900 text-rose-600' },
    { label: 'Total Allowances', value: fmtCurrency(r.totalAllowances ?? 0), icon: <Wallet className="w-4 h-4" />, color: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900 text-amber-600' },
    { label: 'Total Deductions', value: fmtCurrency(r.totalDeductions ?? 0), icon: <Percent className="w-4 h-4" />, color: 'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900 text-orange-600' },
    { label: 'Pending Salary Reviews', value: r.pendingReviews ?? 0, icon: <Shield className="w-4 h-4" />, color: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-100 dark:border-yellow-900 text-yellow-600' },
    { label: 'Approved Bonuses', value: r.approvedBonuses ?? 0, icon: <Gift className="w-4 h-4" />, color: 'bg-teal-50 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900 text-teal-600' },
    { label: 'Total Benefits', value: r.totalBenefits ?? 0, icon: <BarChart3 className="w-4 h-4" />, color: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900 text-indigo-600' },
    { label: 'Total Benefits Cost', value: fmtCurrency(r.totalBenefitsCost ?? 0), icon: <DollarSign className="w-4 h-4" />, color: 'bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900 text-violet-600' },
  ];

  const handleExport = () => {
    const headers = ['Metric', 'Value'];
    const rows = statCards.map(s => [s.label, typeof s.value === 'string' ? s.value : String(s.value)]);
    exportToCsv(headers, rows, 'compensation-report');
    success('Compensation report exported');
  };

  return (
    <HrPageShell title="Compensation Reports" description="Overview of pay grades, salary costs, allowances, deductions, and benefits"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={handleExport} disabled={loading || !report} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all disabled:opacity-40"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={fetchReport} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all disabled:opacity-40"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </>
      }>
      {loading && !report ? (
        <div className="text-center py-12 text-ink-400">
          <p>Loading compensation report...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card, i) => (
            <div key={i} className={`rounded-xl p-4 border ${card.color}`}>
              <div className="flex items-center gap-2 mb-2">{card.icon}<span className="text-xs font-medium opacity-80">{card.label}</span></div>
              <p className="text-lg font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </HrPageShell>
  );
}

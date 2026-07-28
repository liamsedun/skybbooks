import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Wallet, Award, Percent, Gift, Shield, Users, BarChart3, History, RefreshCw, ArrowRight } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { hrApi } from '../../../lib/api';

export function CompensationPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getCompensationReport();
      setReport(res.data || res);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, []);

  const fmt = (n: number) => '₦' + (n || 0).toLocaleString();

  const stats = useMemo(() => report ? [
    { label: 'Total Salary Cost', value: fmt(report.totalSalaryCost), icon: <Wallet className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Employees', value: report.totalEmployees || 0, icon: <Users className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Pay Grades', value: report.totalPayGrades || 0, icon: <BarChart3 className="w-4 h-4" />, color: 'purple' as const },
    { label: 'Benefits Cost', value: fmt(report.totalBenefitsCost), icon: <Shield className="w-4 h-4" />, color: 'amber' as const },
  ] : [], [report]);

  const quickLinks = [
    { label: 'Pay Grades', desc: 'Manage salary bands and pay structures', path: '/app/hr/compensation/pay-grades', icon: <BarChart3 className="w-5 h-5" />, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' },
    { label: 'Allowances', desc: 'Define allowance types and amounts', path: '/app/hr/compensation/allowances', icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Bonuses', desc: 'Manage employee bonuses and approvals', path: '/app/hr/compensation/bonuses', icon: <Award className="w-5 h-5" />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Deductions', desc: 'Configure deduction types and rules', path: '/app/hr/compensation/deductions', icon: <Percent className="w-5 h-5" />, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30' },
    { label: 'Benefits', desc: 'Administer employee benefits and enrollments', path: '/app/hr/compensation/benefits', icon: <Gift className="w-5 h-5" />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Salary Reviews', desc: 'Review and approve salary adjustments', path: '/app/hr/compensation/salary-reviews', icon: <Wallet className="w-5 h-5" />, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' },
    { label: 'History', desc: 'View compensation change history', path: '/app/hr/compensation/history', icon: <History className="w-5 h-5" />, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' },
    { label: 'Reports', desc: 'Compensation analytics and insights', path: '/app/hr/compensation/reports', icon: <BarChart3 className="w-5 h-5" />, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/30' },
  ];

  return (
    <HrPageShell title="Compensation & Benefits" description="Comprehensive compensation management — salary bands, allowances, bonuses, deductions, benefits, and salary reviews"
      pageKey="compensation"
      headerActions={
        <button onClick={fetchReport} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      }>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-400 text-sm">Loading dashboard...</div>
      ) : (
        <>
          <HrStatCards items={stats} columns={4} />
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-ink-800 mb-4">Quick Links</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {quickLinks.map(link => (
                <button key={link.path} onClick={() => navigate(link.path)}
                  className="flex items-start gap-3 p-4 rounded-2xl border border-border-custom bg-surface hover:shadow-sm hover:border-primary/30 transition-all text-left group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${link.color}`}>{link.icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900 group-hover:text-primary transition-colors">{link.label}</p>
                    <p className="text-[11px] text-ink-400 mt-0.5">{link.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-300 ml-auto shrink-0 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </HrPageShell>
  );
}

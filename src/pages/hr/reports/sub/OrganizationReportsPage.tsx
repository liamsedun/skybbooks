import { useState, useEffect, useMemo } from 'react';
import { Building2, Users, TrendingUp, DollarSign, Download, FileText } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { hrApi } from '../../../../lib/api';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function OrganizationReportsPage() {
  const [emp, setEmp] = useState<any>(null);
  const [turnover, setTurnover] = useState<any>(null);
  const [comp, setComp] = useState<any>(null);
  const [recruit, setRecruit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.getReportEmployees(),
      hrApi.getReportTurnover(),
      hrApi.getReportCompensation(),
      hrApi.getReportRecruitment(),
    ]).then(([e, t, c, r]) => {
      setEmp(e.data); setTurnover(t.data); setComp(c.data); setRecruit(r.data);
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => [
    { label: 'Total Employees', value: emp?.total || 0, icon: Users, color: 'blue' as const },
    { label: 'Turnover Rate', value: `${turnover?.turnoverRate || 0}%`, icon: TrendingUp, color: 'red' as const },
    { label: 'Total Salary', value: `₦${((comp?.totalSalary || 0) / 1000000).toFixed(1)}M`, icon: DollarSign, color: 'green' as const },
    { label: 'Open Positions', value: recruit?.openPositions || 0, icon: Building2, color: 'purple' as const },
  ], [emp, turnover, comp, recruit]);

  const orgExport = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Employees', String(emp?.total || 0)],
      ['Active', String(emp?.activeCount || 0)],
      ['Turnover Rate', `${turnover?.turnoverRate || 0}%`],
      ['Total Leavers', String(turnover?.totalLeavers || 0)],
      ['Total Salary', String(comp?.totalSalary || 0)],
      ['Open Positions', String(recruit?.openPositions || 0)],
      ['Candidates', String(recruit?.totalCandidates || 0)],
      ['Hired', String(recruit?.hired || 0)],
    ];
    exportToCsv(headers, rows, 'org-wide-report');
  };

  if (loading) return <HrPageShell title="Organization Reports" description="Organization-wide metrics"><div className="text-sm text-ink-400 p-4">Loading...</div></HrPageShell>;

  return (
    <HrPageShell title="Organization Reports" description="Organization-wide metrics and analytics"
      headerActions={
        <div className="flex gap-1">
          <button onClick={orgExport} className="p-1.5 rounded-lg hover:bg-ink-50" title="CSV"><Download className="w-4 h-4" /></button>
        </div>
      }>
      <HrStatCards items={stats} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Employees by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={(emp?.byDepartment || []).map((d: any) => ({ name: d.department || 'Unknown', count: Number(d.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Employee Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={(emp?.byStatus || []).map((s: any) => ({ name: s.status, value: Number(s.count) }))} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {(emp?.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Turnover by Department</h3>
          <div className="space-y-2">
            {(turnover?.byDepartment || []).map((d: any) => (
              <div key={d.department} className="flex items-center justify-between text-sm"><span className="text-ink-600">{d.department || 'Unknown'}</span><span className="font-semibold">{d.count}</span></div>
            ))}
            {(!turnover?.byDepartment || turnover.byDepartment.length === 0) && <p className="text-xs text-ink-400">No turnover data</p>}
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Recruitment Funnel</h3>
          <div className="space-y-2">
            {(recruit?.funnel || []).map((s: any) => (
              <div key={s.stage} className="flex items-center gap-3">
                <span className="text-sm capitalize text-ink-600 w-24">{s.stage}</span>
                <div className="flex-1 bg-ink-100 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(s.conversionRate || 0, 100)}%` }} />
                </div>
                <span className="text-xs font-semibold w-16 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}

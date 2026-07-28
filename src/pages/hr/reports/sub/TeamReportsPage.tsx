import { useState, useEffect, useMemo } from 'react';
import { Users, CalendarCheck, Clock, Target, Download, FileText } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { hrApi } from '../../../../lib/api';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DEPARTMENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function TeamReportsPage() {
  const [emp, setEmp] = useState<any>(null);
  const [leave, setLeave] = useState<any>(null);
  const [perf, setPerf] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.getReportEmployees(),
      hrApi.getReportLeave(),
      hrApi.getReportPerformance(),
    ]).then(([e, l, p]) => {
      setEmp(e.data); setLeave(l.data); setPerf(p.data);
      setLoading(false);
    });
  }, []);

  const deptData = useMemo(() => (emp?.byDepartment || []).map((d: any, i: number) => ({ ...d, fill: DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length] })), [emp]);

  const stats = useMemo(() => [
    { label: 'Departments', value: deptData.length || 0, icon: Users, color: 'blue' as const },
    { label: 'Active Employees', value: emp?.activeCount || 0, icon: Users, color: 'green' as const },
    { label: 'Pending Leave', value: leave?.byStatus?.find((s: any) => s.status === 'pending')?.count || 0, icon: CalendarCheck, color: 'amber' as const },
    { label: 'Avg Rating', value: perf?.avgRating || '-', icon: Target, color: 'purple' as const },
  ], [deptData, emp, leave, perf]);

  const exportDept = () => {
    const headers = ['Department', 'Count'];
    const rows = deptData.map((d: any) => [d.department || 'Unknown', String(d.count)]);
    exportToCsv(headers, rows, 'department-report');
  };

  if (loading) return <HrPageShell title="Team Reports" description="Team and department-level analytics"><div className="text-sm text-ink-400 p-4">Loading...</div></HrPageShell>;

  return (
    <HrPageShell title="Team Reports" description="Team and department-level analytics"
      headerActions={
        <div className="flex gap-1">
          <button onClick={exportDept} className="p-1.5 rounded-lg hover:bg-ink-50" title="CSV"><Download className="w-4 h-4" /></button>
        </div>
      }>
      <HrStatCards items={stats} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Department Headcount</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deptData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="department" type="category" tick={{ fontSize: 11 }} width={100} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {deptData.map((entry: any, i: number) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Department Details</h3>
          <div className="space-y-3">
            {deptData.map((d: any) => (
              <div key={d.department} className="flex items-center justify-between p-2 rounded-lg hover:bg-ink-50">
                <span className="text-sm text-ink-700">{d.department || 'Unknown'}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-ink-100 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${emp?.total ? Math.round((d.count / emp.total) * 100) : 0}%`, backgroundColor: d.fill }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{d.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}

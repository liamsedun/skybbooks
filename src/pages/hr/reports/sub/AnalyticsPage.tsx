import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, FileText, Users, TrendingUp, Clock, Target, Briefcase, DollarSign, Plane, GraduationCap } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrViewDrawer } from '../../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { hrApi } from '../../../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

function useReportApi(fn: () => Promise<any>) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fn().then(r => { setData(r.data); setLoading(false); }); }, []);
  return { data, loading };
}

export function ReportsAnalyticsPage() {
  const emp = useReportApi(() => hrApi.getReportEmployees());
  const leave = useReportApi(() => hrApi.getReportLeave());
  const attendance = useReportApi(() => hrApi.getReportAttendance());
  const perf = useReportApi(() => hrApi.getReportPerformance());
  const travel = useReportApi(() => hrApi.getReportTravel());
  const comp = useReportApi(() => hrApi.getReportCompensation());
  const turnover = useReportApi(() => hrApi.getReportTurnover());
  const recruit = useReportApi(() => hrApi.getReportRecruitment());

  const loading = emp.loading || leave.loading || attendance.loading || perf.loading || travel.loading || comp.loading || turnover.loading || recruit.loading;

  const kpiCards = useMemo(() => [
    { label: 'Total Employees', value: emp.data?.total || 0, icon: Users, color: 'blue' as const, prefix: '' },
    { label: 'Active', value: emp.data?.activeCount || 0, icon: Users, color: 'green' as const },
    { label: 'Pending Leave', value: leave.data?.byStatus?.find((s: any) => s.status === 'pending')?.count || 0, icon: Clock, color: 'amber' as const },
    { label: 'Attendance Today', value: attendance.data?.total || 0, icon: Clock, color: 'purple' as const },
    { label: 'Avg Rating', value: perf.data?.avgRating || '-', icon: Target, color: 'indigo' as const, suffix: '' },
    { label: 'Open Positions', value: recruit.data?.openPositions || 0, icon: Briefcase, color: 'rose' as const },
    { label: 'Turnover Rate', value: `${turnover.data?.turnoverRate || 0}%`, icon: TrendingUp, color: 'red' as const },
    { label: 'Pending Reviews', value: comp.data?.pendingReviews || 0, icon: BarChart3, color: 'amber' as const },
  ], [emp, leave, attendance, perf, recruit, turnover, comp]);

  const [drillDown, setDrillDown] = useState<{ title: string; rows: any[]; headers: string[] } | null>(null);

  const viewDrillDown = async (reportType: string, groupKey: string, groupValue: string, title: string, headers: string[]) => {
    try {
      const r = await hrApi.getReportDrillDown(reportType, groupKey, groupValue);
      setDrillDown({ title, rows: r.data || [], headers });
    } catch { /* ignore */ }
  };

  const exportReport = (type: string) => {
    hrApi.getReportExport(type).then(r => {
      const { headers, rows, title } = r.data || r;
      exportToCsv(headers, rows, title);
    });
  };

  if (loading) return <HrPageShell title="HR Analytics" description="Key metrics and performance indicators"><div className="text-sm text-ink-400 p-4">Loading analytics...</div></HrPageShell>;

  return (
    <HrPageShell title="HR Analytics" description="Key metrics and performance indicators"
      headerActions={
        <div className="flex gap-1">
          <button onClick={() => exportReport('employees')} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export CSV"><Download className="w-4 h-4" /></button>
          <button onClick={() => { const h = ['KPI', 'Value']; const r = Object.entries(kpiCards).map(([k, v]) => [v.label, String(v.value)]); exportToPdf('HR KPI Dashboard', h, r, 'hr-kpi-dashboard'); }} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export PDF"><FileText className="w-4 h-4" /></button>
        </div>
      }>
      <HrStatCards items={kpiCards} columns={4} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Headcount by Department */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Employees by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={emp.data?.byDepartment || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} onClick={(entry: any) => viewDrillDown('department', 'department', entry.department, `Department: ${entry.department}`, ['Name', 'Email', 'Department', 'Designation', 'Status'])} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leave by Status */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Leave Requests by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={(leave.data?.byStatus || []).map((s: any) => ({ name: s.status, value: Number(s.count) }))} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {(leave.data?.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance by Status */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Attendance by Status</h3>
          <div className="space-y-3">
            {(attendance.data?.byStatus || []).map((s: any) => (
              <div key={s.status} className="flex items-center justify-between cursor-pointer hover:bg-ink-50 p-2 rounded-lg"
                onClick={() => viewDrillDown('attendance', 'status', s.status, `Attendance: ${s.status}`, ['Date', 'Employee', 'Status', 'Check In', 'Check Out'])}>
                <span className="capitalize text-sm text-ink-600">{s.status}</span>
                <span className="font-semibold text-sm">{s.count}</span>
              </div>
            ))}
            {(!attendance.data?.byStatus || attendance.data.byStatus.length === 0) && <p className="text-xs text-ink-400">No data</p>}
          </div>
          <p className="text-xs text-ink-400 mt-3">Avg Hours: {attendance.data?.avgHours || 0}h</p>
        </div>

        {/* Recruitment Funnel */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Recruitment Funnel</h3>
          <div className="space-y-2">
            {(recruit.data?.funnel || []).map((s: any) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize text-ink-600">{s.stage}</span>
                    <span className="text-xs font-semibold">{s.count} ({s.conversionRate}%)</span>
                  </div>
                  <div className="w-full bg-ink-100 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min(s.conversionRate, 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Performance Summary</h3>
          <div className="space-y-2">
            {(perf.data?.byStatus || []).map((s: any) => (
              <div key={s.status} className="flex items-center justify-between text-sm"><span className="capitalize text-ink-600">{s.status}</span><span className="font-semibold">{s.count}</span></div>
            ))}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-border-custom"><span className="text-ink-600">Avg Rating</span><span className="font-semibold">{perf.data?.avgRating || '-'}/5</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-600">Active Goals</span><span className="font-semibold">{perf.data?.activeGoals || 0}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-ink-600">Dev Plans</span><span className="font-semibold">{perf.data?.activeDevPlans || 0}</span></div>
          </div>
        </div>

        {/* Turnover & Compensation */}
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Workforce Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-ink-50 rounded-xl text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1 text-rose-500" />
              <p className="text-lg font-bold">{turnover.data?.turnoverRate || 0}%</p>
              <p className="text-xs text-ink-400">Turnover Rate</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-bold">{turnover.data?.totalLeavers || 0}</p>
              <p className="text-xs text-ink-400">Total Leavers</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl text-center">
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-lg font-bold">{((comp.data?.totalSalary || 0) / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-ink-400">Total Salary</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl text-center">
              <GraduationCap className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-lg font-bold">{recruit.data?.hired || 0}</p>
              <p className="text-xs text-ink-400">Hired</p>
            </div>
          </div>
        </div>
      </div>

      <HrViewDrawer open={!!drillDown} onClose={() => setDrillDown(null)} title={drillDown?.title || ''}>
        {drillDown && (
          <div className="space-y-2">
            {drillDown.rows.length === 0 && <p className="text-sm text-ink-400">No details available</p>}
            <table className="w-full text-xs">
              <thead><tr className="bg-ink-50">{drillDown.headers.map(h => <th key={h} className="p-2 text-left font-medium text-ink-500">{h}</th>)}</tr></thead>
              <tbody>
                {drillDown.rows.map((r, i) => (
                  <tr key={i} className="border-t border-border-custom">
                    {Object.values(r).map((v: any, j) => <td key={j} className="p-2 text-ink-600">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => exportToCsv(drillDown.headers, drillDown.rows.map((r: any) => Object.values(r).map(String)), drillDown.title)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg mt-3"><Download className="w-3 h-3" />Export CSV</button>
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

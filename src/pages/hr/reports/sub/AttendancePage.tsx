import { useState, useEffect, useMemo } from 'react';
import { Clock, Download, FileText, Users } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../../components/hr/HrFilterBar';
import { HrViewDrawer } from '../../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { hrApi } from '../../../../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS: Record<string, string> = { present: '#10b981', absent: '#ef4444', late: '#f59e0b', half_day: '#8b5cf6', remote: '#3b82f6' };

export function AttendancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [drillRows, setDrillRows] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    hrApi.getReportAttendance(params).then(r => { setData(r.data); setLoading(false); });
  };
  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const stats = useMemo(() => [
    { label: 'Total Records', value: data?.total || 0, icon: Clock, color: 'blue' as const },
    { label: 'Avg Hours', value: data?.avgHours || 0, icon: Clock, color: 'green' as const, suffix: 'h' },
    { label: 'Statuses', value: Object.keys(data?.byStatus || {}).length || 0, icon: Users, color: 'purple' as const },
  ], [data]);

  const viewDrill = async (status: string) => {
    try {
      const params: any = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const r = await hrApi.getReportDrillDown('attendance', 'status', status, params);
      setDrillRows(r.data || []);
      setSelected(status);
    } catch { /* ignore */ }
  };

  const columns: Column<any>[] = [
    { key: 'status', label: 'Status', render: r => <span className="capitalize font-medium cursor-pointer hover:text-primary" onClick={() => viewDrill(r.status)}>{r.status}</span> },
    { key: 'count', label: 'Count', render: r => <span className="font-semibold">{r.count}</span> },
  ];

  return (
    <HrPageShell title="Attendance Report" description="Employee attendance analysis and trends"
      headerActions={
        <div className="flex gap-1">
          <button onClick={() => { const h = ['Status', 'Count']; const r = (data?.byStatus || []).map((s: any) => [s.status, String(s.count)]); exportToCsv(h, r, 'attendance-report'); }} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export CSV"><Download className="w-4 h-4" /></button>
          <button onClick={() => { const h = ['Status', 'Count']; const r = (data?.byStatus || []).map((s: any) => [s.status, String(s.count)]); exportToPdf('Attendance Report', h, r, 'attendance-report'); }} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export PDF"><FileText className="w-4 h-4" /></button>
        </div>
      }>
      <HrFilterBar search="" onSearchChange={() => {}}
        dateFrom={dateFrom} dateTo={dateTo}
        onDateFromChange={setDateFrom} onDateToChange={setDateTo}
        onClear={() => { setDateFrom(''); setDateTo(''); }} hasActiveFilters={!!dateFrom || !!dateTo} />
      {!loading && <HrStatCards items={stats} columns={3} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Attendance Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={(data?.byStatus || []).map((s: any) => ({ name: s.status, count: Number(s.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(data?.byStatus || []).map((entry: any, i: number) => (
                  <rect key={i} fill={COLORS[entry.status] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-semibold text-ink-700 mb-4">Click to Drill Down</h3>
          <HrDataTable columns={columns} data={data?.byStatus || []} keyExtractor={r => r.status} loading={loading} emptyMessage="No attendance data" />
        </div>
      </div>

      <HrViewDrawer open={!!selected} onClose={() => { setSelected(null); setDrillRows([]); }} title={`Attendance: ${selected}`}>
        {drillRows.length > 0 ? (
          <div className="space-y-2">
            <table className="w-full text-xs">
              <thead><tr className="bg-ink-50"><th className="p-2 text-left font-medium">Date</th><th className="p-2 text-left font-medium">Employee</th><th className="p-2 text-left font-medium">Status</th><th className="p-2 text-left font-medium">Check In</th></tr></thead>
              <tbody>
                {drillRows.map((r, i) => (
                  <tr key={i} className="border-t border-border-custom">
                    <td className="p-2">{r.date ? new Date(r.date).toLocaleDateString() : '-'}</td>
                    <td className="p-2">{r.employee || '-'}</td>
                    <td className="p-2 capitalize">{r.status || '-'}</td>
                    <td className="p-2">{r.checkIn || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-400">No records</p>}
      </HrViewDrawer>
    </HrPageShell>
  );
}

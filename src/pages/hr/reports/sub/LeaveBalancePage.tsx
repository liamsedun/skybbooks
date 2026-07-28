import { useState, useEffect, useMemo } from 'react';
import { CalendarCheck, Download, FileText } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../../components/hr/HrFilterBar';
import { exportToCsv, exportToPdf } from '../../../../lib/hrExport';
import { hrApi } from '../../../../lib/api';

export function LeaveBalancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hrApi.getReportLeave(),
      hrApi.getReportLeaveBalances(),
    ]).then(([leave, balances]) => {
      setData({ ...leave.data, balances: balances.data || [] });
      setLoading(false);
    });
  }, []);

  const stats = useMemo(() => [
    { label: 'Total Requests', value: data?.totalRequests || 0, icon: CalendarCheck, color: 'blue' as const },
    { label: 'Total Days', value: data?.totalDays || 0, icon: CalendarCheck, color: 'green' as const },
    { label: 'Balances', value: data?.balances?.length || 0, icon: CalendarCheck, color: 'purple' as const },
  ], [data]);

  const columns: Column<any>[] = [
    { key: 'employee', label: 'Employee', render: r => r.hr_employees?.firstName + ' ' + r.hr_employees?.lastName || r.hr_leave_balances?.employeeId || '-' },
    { key: 'leaveType', label: 'Leave Type', render: r => r.hr_leave_types?.name || r.leaveTypeId || '-' },
    { key: 'total', label: 'Total', render: r => r.hr_leave_balances?.totalDays ?? r.totalDays ?? '-' },
    { key: 'used', label: 'Used', render: r => r.hr_leave_balances?.usedDays ?? r.usedDays ?? '-' },
    { key: 'pending', label: 'Pending', render: r => r.hr_leave_balances?.pendingDays ?? r.pendingDays ?? '-' },
    { key: 'remaining', label: 'Remaining', render: r => {
      const total = Number(r.hr_leave_balances?.totalDays ?? r.totalDays ?? 0);
      const used = Number(r.hr_leave_balances?.usedDays ?? r.usedDays ?? 0);
      return total - used;
    }},
  ];

  const exportCsv = () => {
    const headers = ['Leave Type', 'Total', 'Used', 'Pending'];
    const rows = (data?.byType || []).map((t: any) => [t.leaveType || 'Unknown', String(t.count), '', '']);
    exportToCsv(headers, rows, 'leave-report');
  };

  return (
    <HrPageShell title="Leave & Balances" description="Leave request analysis and employee leave balances"
      headerActions={
        <div className="flex gap-1">
          <button onClick={exportCsv} className="p-1.5 rounded-lg hover:bg-ink-50" title="Export CSV"><Download className="w-4 h-4" /></button>
        </div>
      }>
      {!loading && <HrStatCards items={stats} columns={3} />}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">By Status</h3>
            <div className="space-y-2">
              {(data?.byStatus || []).map((s: any) => (
                <div key={s.status} className="flex items-center justify-between text-sm"><span className="capitalize text-ink-600">{s.status}</span><span className="font-semibold">{s.count}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4">
            <h3 className="text-sm font-semibold text-ink-700 mb-3">By Type</h3>
            <div className="space-y-2">
              {(data?.byType || []).map((t: any) => (
                <div key={t.leaveTypeId} className="flex items-center justify-between text-sm"><span className="text-ink-600">{t.leaveType || 'Unknown'}</span><span className="font-semibold">{t.count}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-ink-700 mb-3">Leave Balances</h3>
      <HrDataTable columns={columns} data={data?.balances || []} keyExtractor={r => r.hr_leave_balances?.id || r.id}
        loading={loading} emptyMessage="No leave balances found" />
    </HrPageShell>
  );
}

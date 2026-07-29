import { useState, useEffect } from 'react';
import { Download, Calendar, Users, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { exportToCsv, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

export function AttendanceReportsPage() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!dateFrom || !dateTo) return;
    try {
      setLoading(true);
      const res = await hrApi.getAttendanceReport({ dateFrom, dateTo });
      setReportData(res?.data ?? []);
    } catch (e) {
      toast('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [dateFrom, dateTo]);

  const exportCsv = () => {
    if (!reportData?.length) return;
    const headers = ['Employee', 'Total Days', 'Present', 'Absent', 'Late', 'Early Departure', 'Overtime Hours', 'Remote Days'];
    const rows = reportData.map((r: any) => [
      r.employeeName || r.employeeId,
      r.totalDays ?? 0,
      r.presentDays ?? 0,
      r.absentDays ?? 0,
      r.lateDays ?? 0,
      r.earlyDepartureDays ?? 0,
      r.totalOvertimeMinutes ? (r.totalOvertimeMinutes / 60).toFixed(1) : 0,
      r.remoteDays ?? 0,
    ]);
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance-report-${dateFrom}-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('Report exported', 'success');
  };

  const totalPresent = reportData?.reduce((a: number, r: any) => a + (r.presentDays ?? 0), 0) ?? 0;
  const totalAbsent = reportData?.reduce((a: number, r: any) => a + (r.absentDays ?? 0), 0) ?? 0;
  const totalLate = reportData?.reduce((a: number, r: any) => a + (r.lateDays ?? 0), 0) ?? 0;
  const totalEmployees = reportData?.length ?? 0;

  return (
    <HrPageShell title="Attendance Reports" description="View and export attendance summary reports"
      pageKey="attendance-reports"
      headerActions={<>
        <button onClick={exportCsv} disabled={!reportData?.length} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export CSV</button>
      </>}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-500">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-500">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs text-emerald-700 dark:text-emerald-400">Present Days</span></div>
          <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{totalPresent}</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl p-4 border border-rose-100 dark:border-rose-900">
          <div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-rose-600" /><span className="text-xs text-rose-700 dark:text-rose-400">Absent Days</span></div>
          <p className="text-2xl font-bold text-rose-800 dark:text-rose-300">{totalAbsent}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-600" /><span className="text-xs text-amber-700 dark:text-amber-400">Late Occurrences</span></div>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{totalLate}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-600" /><span className="text-xs text-blue-700 dark:text-blue-400">Employees</span></div>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{totalEmployees}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-ink-400"><p>Loading report...</p></div>
      ) : reportData?.length > 0 ? (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-custom bg-ink-50 dark:bg-ink-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ink-600">Employee</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-ink-600">Days</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-emerald-700">Present</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-rose-700">Absent</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-amber-700">Late</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-purple-700">Early Dep.</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-blue-700">OT (hrs)</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-ink-600">Remote</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((r: any, i: number) => (
                  <tr key={r.employeeId || i} className="border-b border-border-custom hover:bg-ink-50 dark:hover:bg-ink-800/30">
                    <td className="px-4 py-3 font-medium text-ink-900">{r.employeeName || r.employeeId}</td>
                    <td className="px-3 py-3 text-center text-ink-700">{r.totalDays ?? 0}</td>
                    <td className="px-3 py-3 text-center text-emerald-700 font-medium">{r.presentDays ?? 0}</td>
                    <td className="px-3 py-3 text-center text-rose-700 font-medium">{r.absentDays ?? 0}</td>
                    <td className="px-3 py-3 text-center text-amber-700 font-medium">{r.lateDays ?? 0}</td>
                    <td className="px-3 py-3 text-center text-purple-700 font-medium">{r.earlyDepartureDays ?? 0}</td>
                    <td className="px-3 py-3 text-center text-blue-700 font-medium">{r.totalOvertimeMinutes ? (r.totalOvertimeMinutes / 60).toFixed(1) : '0'}</td>
                    <td className="px-3 py-3 text-center text-ink-700">{r.remoteDays ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 text-center text-ink-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-ink-300" />
          <p className="text-sm">No attendance data for the selected period. Try a different date range.</p>
        </div>
      )}
    </HrPageShell>
  );
}

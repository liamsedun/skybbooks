import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck, MapPin, Wifi } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string;
  totalHours: string;
  totalMinutes: number;
  status: string;
  isLate: boolean;
  lateMinutes: number;
  isEarlyDeparture: boolean;
  earlyDepartureMinutes: number;
  isRemote: boolean;
  overtimeMinutes: number;
  shiftName: string;
}

export function AttendanceSummaryPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await hrApi.getAttendance({ pageSize: 500 });
      setRecords(res?.data ?? []);
    } catch (e) {
      toast('Failed to load attendance records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const ps = useHrPageState({ data: records, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'status'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Present', value: records.filter(i => i.status === 'present' || i.status === 'on_time').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'present', onClick: () => ps.setStatusFilter('present') },
    { label: 'Late', value: records.filter(i => i.isLate).length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'late', onClick: () => ps.setStatusFilter('late') },
    { label: 'Early Departure', value: records.filter(i => i.isEarlyDeparture).length, icon: <AlertTriangle className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'early', onClick: () => ps.setStatusFilter('early') },
    { label: 'Remote', value: records.filter(i => i.isRemote).length, icon: <Wifi className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'remote', onClick: () => ps.setStatusFilter('remote') },
    { label: 'Absent', value: records.filter(i => i.status === 'absent').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'absent', onClick: () => ps.setStatusFilter('absent') },
  ], [records, ps.statusFilter]);

  const getStatusBadge = (status: string, isLate: boolean) => {
    if (status === 'absent') return 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400';
    if (isLate) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
    if (status === 'present' || status === 'on_time' || status === 'clocked_in') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400';
    return 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400';
  };
  const getStatusLabel = (status: string, isLate: boolean) => {
    if (status === 'absent') return 'Absent';
    if (isLate) return 'Late';
    if (status === 'present' || status === 'on_time' || status === 'clocked_in') return 'Present';
    return status;
  };

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'employeeName', label: 'Employee', sortable: true, render: (i) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-900">{i.employeeName}</span>
          {i.isRemote && <MapPin className="w-3 h-3 text-blue-500" title="Remote" />}
        </div>
      ),
    },
    { key: 'date', label: 'Date', sortable: true, render: (i) => formatDate(i.date) },
    { key: 'clockIn', label: 'Clock In', sortable: true, className: 'text-center' },
    { key: 'clockOut', label: 'Clock Out', sortable: true, className: 'text-center' },
    { key: 'totalHours', label: 'Hours', sortable: true, className: 'text-center' },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(i.status, i.isLate)}`}>
          {getStatusLabel(i.status, i.isLate)}
        </span>
      ),
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? filtered.find(i => i.id === ps.viewDrawerId) : null;
  const editItem = ps.editModalId ? filtered.find(i => i.id === ps.editModalId) : null;

  return (
    <HrPageShell title="Attendance Summary" description="Daily attendance overview for all employees"
      pageKey="attendance"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Mark Attendance</button>
        <button onClick={() => exportToCsv(filtered, columns, 'attendance-summary')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={5} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'present', 'late', 'absent', 'early', 'remote']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Attendance Summary')}
      />
      <HrDataTable columns={columns} data={loading ? [] : paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage={loading ? 'Loading...' : 'No attendance records found'} emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Mark attendance</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Attendance Record' : 'Mark Attendance'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.date ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Clock In</label><input type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.clockIn ?? '08:00'} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Clock Out</label><input type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.clockOut ?? '17:00'} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={async () => {
            try { await hrApi.updateAttendance(editItem!.id, {}); toast('Attendance record updated', 'success'); ps.closeModals(); await fetchRecords(); } catch { toast('Failed to update', 'error'); }
          }}>{ps.editModalId ? 'Update' : 'Save'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={async () => {
        try { await hrApi.updateAttendance(ps.confirmDeleteId!, {}); ps.confirmDelete(); toast('Attendance record deleted', 'success'); await fetchRecords(); } catch { toast('Failed to delete', 'error'); }
      }} title="Delete Attendance Record" message="Are you sure you want to delete this attendance record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Attendance Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.date)}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">Clock In</label><p className="text-sm font-medium text-ink-900">{selectedItem.clockIn}</p></div>
            <div><label className="text-xs text-ink-500">Clock Out</label><p className="text-sm font-medium text-ink-900">{selectedItem.clockOut}</p></div>
            <div><label className="text-xs text-ink-500">Hours</label><p className="text-sm font-medium text-ink-900">{selectedItem.totalHours}</p></div>
          </div>
          {selectedItem.isLate && <div><label className="text-xs text-ink-500">Late By</label><p className="text-sm font-medium text-amber-600">{selectedItem.lateMinutes} min</p></div>}
          {selectedItem.isEarlyDeparture && <div><label className="text-xs text-ink-500">Early Departure</label><p className="text-sm font-medium text-purple-600">{selectedItem.earlyDepartureMinutes} min</p></div>}
          {selectedItem.overtimeMinutes > 0 && <div><label className="text-xs text-ink-500">Overtime</label><p className="text-sm font-medium text-blue-600">{selectedItem.overtimeMinutes} min</p></div>}
          <div><label className="text-xs text-ink-500">Remote</label><p className="text-sm font-medium text-ink-900">{selectedItem.isRemote ? 'Yes' : 'No'}</p></div>
          {selectedItem.shiftName && <div><label className="text-xs text-ink-500">Shift</label><p className="text-sm font-medium text-ink-900">{selectedItem.shiftName}</p></div>}
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';

interface AttendanceRecord {
  id: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string;
  hours: string;
  status: 'present' | 'absent' | 'late' | 'half-day';
}

const MOCK: AttendanceRecord[] = [
  { id: 'A001', employeeName: 'Amara Okafor', date: '2026-07-27', clockIn: '08:05', clockOut: '17:00', hours: '8:55', status: 'present' },
  { id: 'A002', employeeName: 'Chidi Nwosu', date: '2026-07-27', clockIn: '08:30', clockOut: '17:15', hours: '8:45', status: 'present' },
  { id: 'A003', employeeName: 'Fatima Usman', date: '2026-07-27', clockIn: '--:--', clockOut: '--:--', hours: '0:00', status: 'absent' },
  { id: 'A004', employeeName: 'Emeka Eze', date: '2026-07-27', clockIn: '09:45', clockOut: '17:30', hours: '7:45', status: 'late' },
  { id: 'A005', employeeName: 'Yetunde Bello', date: '2026-07-27', clockIn: '08:10', clockOut: '13:00', hours: '4:50', status: 'half-day' },
  { id: 'A006', employeeName: 'Segun Adeyemi', date: '2026-07-27', clockIn: '08:00', clockOut: '17:00', hours: '9:00', status: 'present' },
  { id: 'A007', employeeName: 'Ngozi Obi', date: '2026-07-27', clockIn: '--:--', clockOut: '--:--', hours: '0:00', status: 'absent' },
  { id: 'A008', employeeName: 'Ibrahim Danjuma', date: '2026-07-27', clockIn: '10:15', clockOut: '17:05', hours: '6:50', status: 'late' },
];

export function AttendanceSummaryPage() {
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName'], pageSize: 10 });
  const { filtered, paginated } = ps;
  const [localData, setLocalData] = useState<AttendanceRecord[]>(MOCK);

  const stats = useMemo(() => [
    { label: 'Present', value: localData.filter(i => i.status === 'present').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'present', onClick: () => ps.setStatusFilter('present') },
    { label: 'Absent', value: localData.filter(i => i.status === 'absent').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'absent', onClick: () => ps.setStatusFilter('absent') },
    { label: 'Late', value: localData.filter(i => i.status === 'late').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'late', onClick: () => ps.setStatusFilter('late') },
    { label: 'Half-day', value: localData.filter(i => i.status === 'half-day').length, icon: <AlertTriangle className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'half-day', onClick: () => ps.setStatusFilter('half-day') },
  ], [localData, ps.statusFilter]);

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span>,
    },
    { key: 'date', label: 'Date', sortable: true, render: (i) => formatDate(i.date) },
    { key: 'clockIn', label: 'Clock In', sortable: true, className: 'text-center' },
    { key: 'clockOut', label: 'Clock Out', sortable: true, className: 'text-center' },
    { key: 'hours', label: 'Hours', sortable: true, className: 'text-center' },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', absent: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400', late: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', 'half-day': 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status]}`}>{i.status}</span>;
      },
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
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'present', 'absent', 'late', 'half-day']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Attendance Summary')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No attendance records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Mark attendance</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Attendance Record' : 'Mark Attendance'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.date ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Clock In</label><input type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.clockIn ?? '08:00'} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Clock Out</label><input type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.clockOut ?? '17:00'} /></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'present'}>
              <option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="half-day">Half-day</option>
            </select>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editModalId ? 'Attendance record updated' : 'Attendance marked'); ps.closeModals(); }}>{ps.editModalId ? 'Update' : 'Save'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => { ps.confirmDelete(); success('Attendance record deleted'); }} title="Delete Attendance Record" message="Are you sure you want to delete this attendance record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Attendance Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.date)}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">Clock In</label><p className="text-sm font-medium text-ink-900">{selectedItem.clockIn}</p></div>
            <div><label className="text-xs text-ink-500">Clock Out</label><p className="text-sm font-medium text-ink-900">{selectedItem.clockOut}</p></div>
            <div><label className="text-xs text-ink-500">Hours</label><p className="text-sm font-medium text-ink-900">{selectedItem.hours}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



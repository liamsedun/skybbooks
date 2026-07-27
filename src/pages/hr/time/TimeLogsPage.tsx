import { useMemo } from 'react';
import { Timer, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Play, Square } from 'lucide-react';
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

interface TimeLog {
  id: string; employee: string; project: string; date: string; startTime: string; endTime: string; hours: number; billable: boolean; status: string;
}

const MOCK: TimeLog[] = [
  { id: 'TL1', employee: 'Chioma Okafor', project: 'Payroll System', date: '2026-07-27', startTime: '08:00', endTime: '12:00', hours: 4, billable: true, status: 'approved' },
  { id: 'TL2', employee: 'Segun Adebayo', project: 'Mobile App', date: '2026-07-27', startTime: '09:00', endTime: '17:00', hours: 8, billable: true, status: 'approved' },
  { id: 'TL3', employee: 'Amina Bello', project: 'HR Dashboard', date: '2026-07-27', startTime: '08:30', endTime: '16:30', hours: 8, billable: true, status: 'pending' },
  { id: 'TL4', employee: 'Tunde Bakare', project: 'Marketing Campaign', date: '2026-07-26', startTime: '10:00', endTime: '15:00', hours: 5, billable: false, status: 'approved' },
  { id: 'TL5', employee: 'Ngozi Eze', project: 'Sales Training', date: '2026-07-26', startTime: '08:00', endTime: '14:00', hours: 6, billable: true, status: 'approved' },
  { id: 'TL6', employee: 'Femi Ogunlade', project: 'Data Pipeline', date: '2026-07-26', startTime: '09:00', endTime: '18:00', hours: 9, billable: true, status: 'pending' },
  { id: 'TL7', employee: 'Zainab Abdullah', project: 'Customer Portal', date: '2026-07-25', startTime: '08:00', endTime: '16:00', hours: 8, billable: true, status: 'rejected' },
  { id: 'TL8', employee: 'Chinedu Okonkwo', project: 'Payroll System', date: '2026-07-25', startTime: '07:00', endTime: '15:00', hours: 8, billable: true, status: 'approved' },
  { id: 'TL9', employee: 'Yemi Lawson', project: 'Mobile App', date: '2026-07-24', startTime: '09:00', endTime: '13:00', hours: 4, billable: false, status: 'approved' },
  { id: 'TL10', employee: 'Adaeze Obi', project: 'HR Dashboard', date: '2026-07-24', startTime: '08:30', endTime: '17:30', hours: 9, billable: true, status: 'pending' },
];

export function TimeLogsPage() {
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'date', initialSortDirection: 'desc', searchKeys: ['employee', 'project'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const totalHours = useMemo(() => filtered.reduce((sum, i) => sum + i.hours, 0), [filtered]);

  const stats = useMemo(() => [
    { label: 'Total Entries', value: filtered.length, icon: <Timer className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Total Hours', value: `${totalHours}h`, icon: <Play className="w-4 h-4" />, color: 'purple' as const },
    { label: 'Approved', value: filtered.filter(i => i.status === 'approved').length, icon: <Square className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: filtered.filter(i => i.status === 'pending').length, icon: <Square className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
  ], [filtered, totalHours, ps.statusFilter]);

  const columns: Column<TimeLog>[] = [
    { key: 'employee', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employee}</span> },
    { key: 'project', label: 'Project', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
    { key: 'startTime', label: 'Start', sortable: true },
    { key: 'endTime', label: 'End', sortable: true },
    { key: 'hours', label: 'Hours', sortable: true, className: 'text-center font-semibold text-ink-900' },
    { key: 'billable', label: 'Billable', render: (i) => i.billable ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">Yes</span> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">No</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const selectedItem = ps.viewingId ? filtered.find(i => i.id === ps.viewingId) : null;
  const editItem = ps.editingId ? filtered.find(i => i.id === ps.editingId) : null;

  return (
    <HrPageShell title="Time Logs" description="View and manage time entries per employee, track billable hours, and monitor productivity"
      pageKey="time-logs"
      headerActions={<>
        <button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Log Time</button>
        <button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button>
        <button onClick={() => exportToCsv(['Employee', 'Project', 'Date', 'Start', 'End', 'Hours', 'Billable', 'Status'], filtered.map(i => [i.employee, i.project, i.date, i.startTime, i.endTime, String(i.hours), i.billable ? 'Yes' : 'No', i.status]), 'time-logs')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee or project..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No time logs found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Log your first entry</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Time Log' : 'Log Time'} onSubmit={(e) => { e.preventDefault(); success(ps.editingId ? 'Time log updated' : 'Time log created'); ps.closeModal(); }}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.employee ?? ''} placeholder="e.g. Chioma Okafor" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Project</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.project ?? ''} placeholder="e.g. Payroll System" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.date ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Hours</label><input type="number" step="0.5" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.hours ?? ''} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Start Time</label><input type="time" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.startTime ?? '08:00'} /></div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">End Time</label><input type="time" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.endTime ?? '17:00'} /></div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" className="rounded border-ink-300 text-primary focus:ring-primary/30" defaultChecked={editItem?.billable ?? true} />
            <label className="text-sm text-ink-700">Billable</label>
          </div>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { success('Time log deleted'); ps.closeConfirmDelete(); }} title="Delete Time Log" message="Are you sure you want to delete this time entry?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Time Log Details">
        {selectedItem && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employee}</p></div>
            <div><label className="text-xs text-ink-500">Project</label><p className="text-sm font-medium text-ink-900">{selectedItem.project}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.date)}</p></div>
            <div><label className="text-xs text-ink-500">Hours</label><p className="text-sm font-medium text-ink-900">{selectedItem.hours}h</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Start Time</label><p className="text-sm font-medium text-ink-900">{selectedItem.startTime}</p></div>
            <div><label className="text-xs text-ink-500">End Time</label><p className="text-sm font-medium text-ink-900">{selectedItem.endTime}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Billable</label><p className="text-sm font-medium text-ink-900">{selectedItem.billable ? 'Yes' : 'No'}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Time Logs" onSubmit={(e) => { e.preventDefault(); success('Time logs imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with time entries (Employee, Project, Date, Start, End, Hours, Billable, Status).</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}



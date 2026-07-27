import { useMemo } from 'react';
import { Timer, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Clock, CheckCircle2 } from 'lucide-react';
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

interface TimeEntry { id: string; employeeName: string; project: string; task: string; hours: number; date: string; status: string; }
const MOCK: TimeEntry[] = [
  { id: 'TM1', employeeName: 'Chioma Okafor', project: 'Payroll Engine', task: 'API Development', hours: 8, date: '2026-07-27', status: 'approved' },
  { id: 'TM2', employeeName: 'Segun Adebayo', project: 'Marketing Site', task: 'Content Writing', hours: 6, date: '2026-07-27', status: 'approved' },
  { id: 'TM3', employeeName: 'Amina Bello', project: 'Audit Reports', task: 'Data Analysis', hours: 7.5, date: '2026-07-27', status: 'pending' },
  { id: 'TM4', employeeName: 'Tunde Bakare', project: 'Sales Dashboard', task: 'UI Design', hours: 8, date: '2026-07-27', status: 'approved' },
  { id: 'TM5', employeeName: 'Ngozi Eze', project: 'Payroll Engine', task: 'Database Optimization', hours: 6.5, date: '2026-07-26', status: 'approved' },
  { id: 'TM6', employeeName: 'Femi Ogunlade', project: 'HR Module', task: 'Feature Testing', hours: 7, date: '2026-07-26', status: 'pending' },
  { id: 'TM7', employeeName: 'Zainab Abdullah', project: 'Recruitment Portal', task: 'Requirement Gathering', hours: 5, date: '2026-07-26', status: 'rejected' },
  { id: 'TM8', employeeName: 'Chinedu Okonkwo', project: 'Payroll Engine', task: 'Bug Fixing', hours: 8, date: '2026-07-26', status: 'approved' },
  { id: 'TM9', employeeName: 'Yemi Lawson', project: 'Marketing Site', task: 'SEO Optimization', hours: 4, date: '2026-07-27', status: 'pending' },
  { id: 'TM10', employeeName: 'Adaeze Obi', project: 'Audit Reports', task: 'Report Generation', hours: 7, date: '2026-07-27', status: 'approved' },
];
export function OpsTimeTrackerPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'project', 'task'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total Entries', value: ps.filtered.length.toString(), icon: <Timer className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Total Hours', value: ps.filtered.reduce((s, i) => s + i.hours, 0).toFixed(1), icon: <Clock className="w-4 h-4" />, color: 'cyan' as const },
    { label: 'Approved', value: ps.filtered.filter(i => i.status === 'approved').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: ps.filtered.filter(i => i.status === 'pending').length.toString(), icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
  ], [ps.filtered]);
  const columns: Column<TimeEntry>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'project', label: 'Project', sortable: true },
    { key: 'task', label: 'Task', sortable: true },
    { key: 'hours', label: 'Hours', sortable: true, render: (i) => <span className="font-semibold">{i.hours}h</span> },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="Time Tracker" description="Time logs, timesheets, billable hours tracking, and productivity monitoring."
      pageKey="time-logs"
      headerActions={<><button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Entry</button><button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button><button onClick={() => exportToCsv(ps.filtered, 'time-entries.csv')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search time entries..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No time entries found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first entry</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Entry' : 'Add Entry'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Entry updated' : 'Entry created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Project</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Task</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Hours</label><input type="number" step="0.5" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Entry deleted'); ps.closeConfirmDelete(); }} title="Delete Entry" message="Are you sure you want to delete this time entry?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Time Entry Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Time Entries" onSubmit={(e) => { e.preventDefault(); showSuccess('Entries imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with time entries.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}



import { useMemo } from 'react';
import { CalendarClock, CheckCircle2, XCircle, Clock, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
import { useHrPageState } from '../../hooks/useHrPageState';
import { HrPageShell } from '../../components/hr/HrPageShell';
import { HrStatCards } from '../../components/hr/HrStatCards';
import { HrFilterBar } from '../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../components/hr/HrDataTable';
import { HrFormModal } from '../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../lib/hrExport';
import { useToast } from '../../contexts/ToastContext';

interface JobSchedule {
  id: string; jobTitle: string; candidate: string;
  interviewDate: string; interviewer: string; status: string;
}

const MOCK: JobSchedule[] = [
  { id: 'sched-1', jobTitle: 'Senior Frontend Developer', candidate: 'John Doe', interviewDate: '2026-08-10T10:00', interviewer: 'Alice Johnson', status: 'scheduled' },
  { id: 'sched-2', jobTitle: 'Backend Engineer', candidate: 'Jane Smith', interviewDate: '2026-08-11T14:00', interviewer: 'Bob Brown', status: 'scheduled' },
  { id: 'sched-3', jobTitle: 'Product Designer', candidate: 'Mike Wilson', interviewDate: '2026-08-05T11:00', interviewer: 'Carol White', status: 'completed' },
  { id: 'sched-4', jobTitle: 'Data Analyst', candidate: 'Sarah Davis', interviewDate: '2026-08-12T09:00', interviewer: 'David Lee', status: 'scheduled' },
  { id: 'sched-5', jobTitle: 'Marketing Lead', candidate: 'Emily Taylor', interviewDate: '2026-07-28T15:00', interviewer: 'Eve Brown', status: 'completed' },
  { id: 'sched-6', jobTitle: 'Senior Frontend Developer', candidate: 'Chris Martin', interviewDate: '2026-08-03T10:00', interviewer: 'Frank Wilson', status: 'cancelled' },
  { id: 'sched-7', jobTitle: 'Customer Success Manager', candidate: 'Lisa Anderson', interviewDate: '2026-08-15T13:00', interviewer: 'Grace Kim', status: 'scheduled' },
  { id: 'sched-8', jobTitle: 'Technical Writer', candidate: 'Tom Harris', interviewDate: '2026-08-01T09:00', interviewer: 'Henry Davis', status: 'completed' },
];

export function JobSchedulePage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'candidate', searchKeys: ['candidate', 'jobTitle', 'interviewer'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <CalendarClock className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Scheduled', value: MOCK.filter(i => i.status === 'scheduled').length, icon: <Clock className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'scheduled', onClick: () => ps.setStatusFilter('scheduled') },
    { label: 'Completed', value: MOCK.filter(i => i.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Cancelled', value: MOCK.filter(i => i.status === 'cancelled').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'cancelled', onClick: () => ps.setStatusFilter('cancelled') },
  ], [ps.statusFilter]);
  const columns: Column<JobSchedule>[] = [
    { key: 'candidate', label: 'Candidate', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.candidate}</span> },
    { key: 'jobTitle', label: 'Job Title', sortable: true },
    { key: 'interviewer', label: 'Interviewer', sortable: true },
    { key: 'interviewDate', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.interviewDate)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="Interview Schedule" description="Manage job interviews and candidate schedules"
      pageKey="jobs"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Candidate','Job Title','Interviewer','Date','Status'], ps.filtered.map(i => [i.candidate,i.jobTitle,i.interviewer,i.interviewDate,i.status]), 'schedules'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Interview Schedule', ['Candidate','Job Title','Interviewer','Date','Status'], ps.filtered.map(i => [i.candidate,i.jobTitle,i.interviewer,i.interviewDate,i.status]), 'schedules')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search candidates, jobs or interviewers..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Scheduled', value: 'scheduled' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No interviews scheduled" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Interview' : 'Schedule Interview'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Scheduled'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Candidate</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Job Title</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Schedule" message="Are you sure you want to delete this interview?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Interview Details">
        <div className="space-y-3 text-sm text-ink-600"><p>Interview details displayed here.</p></div>
      </HrViewDrawer>
    </HrPageShell>
  );
}



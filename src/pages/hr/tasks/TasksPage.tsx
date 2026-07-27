import { useMemo } from 'react';
import { CheckSquare, ArrowUpCircle, MinusCircle, ArrowDownCircle, Calendar, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Task {
  id: string; title: string; assignedTo: string;
  priority: string; dueDate: string; status: string;
}

const MOCK: Task[] = [
  { id: 'task-1', title: 'Review Q3 performance goals', assignedTo: 'Alice Johnson', priority: 'high', dueDate: '2026-08-10', status: 'pending' },
  { id: 'task-2', title: 'Update employee handbook', assignedTo: 'Bob Smith', priority: 'medium', dueDate: '2026-08-15', status: 'in-progress' },
  { id: 'task-3', title: 'Prepare onboarding materials', assignedTo: 'Carol White', priority: 'high', dueDate: '2026-08-08', status: 'completed' },
  { id: 'task-4', title: 'Schedule training sessions', assignedTo: 'David Lee', priority: 'low', dueDate: '2026-08-20', status: 'pending' },
  { id: 'task-5', title: 'Process payroll adjustments', assignedTo: 'Eve Brown', priority: 'high', dueDate: '2026-08-05', status: 'completed' },
  { id: 'task-6', title: 'Update leave policy document', assignedTo: 'Frank Wilson', priority: 'medium', dueDate: '2026-08-18', status: 'in-progress' },
  { id: 'task-7', title: 'Conduct exit interviews', assignedTo: 'Grace Kim', priority: 'medium', dueDate: '2026-08-25', status: 'pending' },
  { id: 'task-8', title: 'Verify employee records', assignedTo: 'Henry Davis', priority: 'low', dueDate: '2026-08-30', status: 'completed' },
  { id: 'task-9', title: 'Prepare diversity report', assignedTo: 'Ivy Chen', priority: 'high', dueDate: '2026-08-12', status: 'in-progress' },
  { id: 'task-10', title: 'Organize team building event', assignedTo: 'Jack Taylor', priority: 'low', dueDate: '2026-09-01', status: 'pending' },
  { id: 'task-11', title: 'Update org chart', assignedTo: 'Kevin Moore', priority: 'medium', dueDate: '2026-08-22', status: 'in-progress' },
  { id: 'task-12', title: 'Compliance checklist review', assignedTo: 'Laura Garcia', priority: 'high', dueDate: '2026-08-07', status: 'completed' },
];

const priorityIcon = (p: string) => {
  switch (p) {
    case 'high': return <ArrowUpCircle className="w-3.5 h-3.5 text-rose-500" />;
    case 'medium': return <MinusCircle className="w-3.5 h-3.5 text-amber-500" />;
    case 'low': return <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />;
    default: return null;
  }
};

export function TasksPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'title', searchKeys: ['title', 'assignedTo'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <CheckSquare className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: MOCK.filter(i => i.status === 'pending').length, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'In Progress', value: MOCK.filter(i => i.status === 'in-progress').length, icon: <ArrowUpCircle className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'in-progress', onClick: () => ps.setStatusFilter('in-progress') },
    { label: 'Completed', value: MOCK.filter(i => i.status === 'completed').length, icon: <CheckSquare className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [ps.statusFilter]);
  const columns: Column<Task>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'assignedTo', label: 'Assigned To', sortable: true },
    { key: 'priority', label: 'Priority', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-1.5">
        {priorityIcon(i.priority)}
        <span className="text-xs font-medium text-ink-600 capitalize">{i.priority}</span>
      </span>
    )},
    { key: 'dueDate', label: 'Due Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.dueDate)}</span> },
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
    <HrPageShell title="HR Tasks" description="Manage HR department tasks and to-dos"
      pageKey="tasks"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Assigned To','Priority','Due Date','Status'], ps.filtered.map(i => [i.title,i.assignedTo,i.priority,i.dueDate,i.status]), 'tasks'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('HR Tasks', ['Title','Assigned To','Priority','Due Date','Status'], ps.filtered.map(i => [i.title,i.assignedTo,i.priority,i.dueDate,i.status]), 'tasks')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search tasks..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'In Progress', value: 'in-progress' }, { label: 'Completed', value: 'completed' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No tasks" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Task' : 'Add Task'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Task Title</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Review Q3 performance goals" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Assigned To</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Alice Johnson" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Priority</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Due Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Task" message="Are you sure you want to delete this task?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Task Details">
        {ps.viewingId && (() => { const t = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><CheckSquare className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{t.title}</p><p className="text-xs text-ink-400">Assigned to {t.assignedTo}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Priority</p><p className="text-sm text-ink-700 mt-1 flex items-center gap-1">{priorityIcon(t.priority)}{t.priority}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Due Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.dueDate)}</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(t.status)}`}>{t.status}</span></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



import { useMemo } from 'react';
import { ClipboardList, BarChart3, Target, Users, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Survey {
  id: string; title: string; department: string;
  responses: number; target: number; status: string;
}

const MOCK: Survey[] = [
  { id: 'srv-1', title: 'Employee Engagement Q3', department: 'All Departments', responses: 142, target: 200, status: 'active' },
  { id: 'srv-2', title: 'Remote Work Satisfaction', department: 'Engineering', responses: 38, target: 45, status: 'active' },
  { id: 'srv-3', title: 'Training Needs Assessment', department: 'All Departments', responses: 95, target: 200, status: 'draft' },
  { id: 'srv-4', title: 'Onboarding Feedback Q2', department: 'HR', responses: 22, target: 30, status: 'completed' },
  { id: 'srv-5', title: 'Compensation Survey 2026', department: 'Finance', responses: 67, target: 100, status: 'active' },
  { id: 'srv-6', title: 'Diversity & Inclusion', department: 'All Departments', responses: 156, target: 200, status: 'completed' },
  { id: 'srv-7', title: 'Manager Effectiveness', department: 'Management', responses: 28, target: 40, status: 'active' },
  { id: 'srv-8', title: 'Wellness Program Feedback', department: 'All Departments', responses: 0, target: 150, status: 'draft' },
];

export function SurveysPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'title', searchKeys: ['title', 'department'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <ClipboardList className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: MOCK.filter(i => i.status === 'active').length, icon: <BarChart3 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Completed', value: MOCK.filter(i => i.status === 'completed').length, icon: <Target className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Draft', value: MOCK.filter(i => i.status === 'draft').length, icon: <Users className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [ps.statusFilter]);
  const columns: Column<Survey>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'responses', label: 'Responses', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{i.responses} / {i.target}</span> },
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
    <HrPageShell title="Surveys" description="Manage employee surveys and feedback forms"
      pageKey="surveys"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Department','Responses/Target','Status'], ps.filtered.map(i => [i.title,i.department,`${i.responses}/${i.target}`,i.status]), 'surveys'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Surveys', ['Title','Department','Responses/Target','Status'], ps.filtered.map(i => [i.title,i.department,`${i.responses}/${i.target}`,i.status]), 'surveys')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search surveys..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No surveys" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Survey' : 'Add Survey'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Survey Title</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Employee Engagement Q3" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. All Departments" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Target Responses</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="200" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Describe the survey purpose and instructions..." /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Survey" message="Are you sure you want to delete this survey?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Survey Details">
        {ps.viewingId && (() => { const s = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{s.title}</p><p className="text-xs text-ink-400">{s.department}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Responses</p><p className="text-lg font-bold text-ink-900 mt-1">{s.responses} / {s.target}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Completion</p><p className="text-lg font-bold text-ink-900 mt-1">{s.target > 0 ? Math.round((s.responses / s.target) * 100) : 0}%</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(s.status)}`}>{s.status}</span></div>
            <div className="w-full bg-ink-100 dark:bg-ink-800 rounded-full h-2 mt-2"><div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${s.target > 0 ? Math.round((s.responses / s.target) * 100) : 0}%` }} /></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



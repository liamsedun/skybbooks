import { useEffect, useMemo, useState } from 'react';
import { FolderKanban, PlayCircle, CheckCircle2, PauseCircle, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Project {
  id: string; name: string; lead: string; teamSize: number;
  startDate: string; endDate: string; progress: number; status: string;
}

const progressColor = (pct: number) => {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
};

export function ProjectsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data] = useState<Project[]>([]);
  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'lead'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <FolderKanban className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.status === 'active').length, icon: <PlayCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Completed', value: data.filter(i => i.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'On Hold', value: data.filter(i => i.status === 'on-hold').length, icon: <PauseCircle className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'on-hold', onClick: () => ps.setStatusFilter('on-hold') },
  ], [data, ps.statusFilter]);
  const columns: Column<Project>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'lead', label: 'Lead', sortable: true },
    { key: 'teamSize', label: 'Team Size', sortable: true, render: (i) => <span className="text-ink-600">{i.teamSize}</span> },
    { key: 'progress', label: 'Progress', sortable: true, render: (i) => (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressColor(i.progress)}`} style={{ width: `${i.progress}%` }} />
        </div>
        <span className="text-xs font-semibold text-ink-600 w-8 text-right">{i.progress}%</span>
      </div>
    )},
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
    <HrPageShell title="HR Projects" description="Manage HR initiatives and projects"
      pageKey="projects"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name','Lead','Team Size','Progress','Status'], ps.filtered.map(i => [i.name,i.lead,String(i.teamSize),`${i.progress}%`,i.status]), 'projects'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('HR Projects', ['Name','Lead','Team Size','Progress','Status'], ps.filtered.map(i => [i.name,i.lead,String(i.teamSize),`${i.progress}%`,i.status]), 'projects')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search projects..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'On Hold', value: 'on-hold' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No projects" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Project' : 'Add Project'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Lead</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Project" message="Are you sure you want to delete this project?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Project Details">
        <div className="space-y-3 text-sm text-ink-600"><p>Project details displayed here.</p></div>
      </HrViewDrawer>
    </HrPageShell>
  );
}




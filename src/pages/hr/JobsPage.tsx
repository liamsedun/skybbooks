import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Globe, MapPin, Users, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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
import { hrApi } from '../../lib/api';

interface JobPosting {
  id: string; title: string; department: string; location: string;
  type: string; applicants: number; postedDate: string; status: string;
}

export function JobsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'title', searchKeys: ['title', 'department', 'location'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getJobOpenings({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { toast(e?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Briefcase className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Open', value: data.filter(i => i.status === 'open').length, icon: <Globe className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'open', onClick: () => ps.setStatusFilter('open') },
    { label: 'Closed', value: data.filter(i => i.status === 'closed').length, icon: <MapPin className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'closed', onClick: () => ps.setStatusFilter('closed') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <Users className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [data, ps.statusFilter]);
  const columns: Column<JobPosting>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'location', label: 'Location', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'applicants', label: 'Applicants', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{i.applicants}</span> },
    { key: 'postedDate', label: 'Posted Date', render: (i) => <span className="text-ink-500">{formatDate(i.postedDate)}</span> },
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
    <HrPageShell title="Job Postings" description="Manage recruitment and job openings"
      pageKey="jobs"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Department','Location','Type','Applicants','Status'], ps.filtered.map(i => [i.title,i.department,i.location,i.type,String(i.applicants),i.status]), 'jobs'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Job Postings', ['Title','Department','Location','Type','Status'], ps.filtered.map(i => [i.title,i.department,i.location,i.type,i.status]), 'jobs')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search jobs..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No job postings" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Job' : 'Add Job'} onSubmit={(e) => { e.preventDefault(); toast(ps.editingId ? 'Updated' : 'Created', 'success'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Title</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { toast('Deleted', 'success'); ps.closeConfirmDelete(); }} title="Delete Job" message="Are you sure you want to delete this job posting?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Job Details">
        <div className="space-y-3 text-sm text-ink-600"><p>Job posting details displayed here.</p></div>
      </HrViewDrawer>
    </HrPageShell>
  );
}



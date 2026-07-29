import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Users, Clock, GraduationCap, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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
import { hrApi } from '../../../lib/api';

interface Course {
  id: string; title: string; provider: string;
  duration: string; enrolled: number; status: string;
}

export function CoursesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getCourses({});
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'title', searchKeys: ['title', 'provider'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <BookOpen className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.status === 'active').length, icon: <GraduationCap className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Completed', value: data.filter(i => i.status === 'completed').length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [data, ps.statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteCourse(id);
      setData(prev => prev.filter(i => i.id !== id));
      toast('Deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      title: (form.elements.nativeItem('title') as HTMLInputElement).value,
      provider: (form.elements.nativeItem('provider') as HTMLInputElement).value,
      duration: (form.elements.nativeItem('duration') as HTMLInputElement).value,
      status: (form.elements.nativeItem('status') as HTMLSelectElement).value,
    };
    try {
      if (ps.editingId) {
        await hrApi.updateCourse(ps.editingId, payload);
        const res = await hrApi.getCourses({});
        if (res?.data) setData(res.data);
        toast('Updated', 'success');
      } else {
        await hrApi.createCourse(payload);
        const res = await hrApi.getCourses({});
        if (res?.data) setData(res.data);
        toast('Created', 'success');
      }
      ps.closeModal();
    } catch { toast('Failed to save', 'error'); }
  };

  const columns: Column<Course>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'provider', label: 'Provider', sortable: true },
    { key: 'duration', label: 'Duration', sortable: true },
    { key: 'enrolled', label: 'Enrolled', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{i.enrolled}</span> },
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
    <HrPageShell title="Courses" description="Manage training courses and programs"
      pageKey="courses"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Provider','Duration','Enrolled','Status'], ps.filtered.map(i => [i.title,i.provider,i.duration,String(i.enrolled),i.status]), 'courses'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Courses', ['Title','Provider','Duration','Enrolled','Status'], ps.filtered.map(i => [i.title,i.provider,i.duration,String(i.enrolled),i.status]), 'courses')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search courses..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No courses" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Course' : 'Add Course'} onSubmit={handleSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Course Title</label><input name="title" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Leadership Essentials" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Provider</label><input name="provider" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. LinkedIn Learning" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Duration</label><input name="duration" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 4 weeks" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select name="status" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { if (ps.confirmingId) { handleDelete(ps.confirmingId); } ps.closeConfirmDelete(); }} title="Delete Course" message="Are you sure you want to delete this course?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Course Details">
        {ps.viewingId && (() => { const c = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><BookOpen className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{c.title}</p><p className="text-xs text-ink-400">{c.provider}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Duration</p><p className="text-sm font-medium text-ink-700 mt-1">{c.duration}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Enrolled</p><p className="text-sm font-medium text-ink-700 mt-1">{c.enrolled} students</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(c.status)}`}>{c.status}</span></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



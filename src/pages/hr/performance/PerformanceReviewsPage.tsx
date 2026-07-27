import { useMemo } from 'react';
import { ClipboardCheck, Star, User, Calendar, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Review {
  id: string; employeeName: string; reviewer: string;
  period: string; rating: number; status: string;
}

const MOCK: Review[] = [
  { id: 'rev-1', employeeName: 'John Doe', reviewer: 'Alice Johnson', period: 'Q2 2026', rating: 4.5, status: 'completed' },
  { id: 'rev-2', employeeName: 'Jane Smith', reviewer: 'Bob Brown', period: 'Q2 2026', rating: 3.8, status: 'completed' },
  { id: 'rev-3', employeeName: 'Mike Wilson', reviewer: 'Carol White', period: 'Q3 2026', rating: 0, status: 'pending' },
  { id: 'rev-4', employeeName: 'Sarah Davis', reviewer: 'David Lee', period: 'Q2 2026', rating: 4.2, status: 'completed' },
  { id: 'rev-5', employeeName: 'Emily Taylor', reviewer: 'Eve Brown', period: 'Q3 2026', rating: 0, status: 'in-progress' },
  { id: 'rev-6', employeeName: 'Chris Martin', reviewer: 'Frank Wilson', period: 'Q2 2026', rating: 3.5, status: 'completed' },
  { id: 'rev-7', employeeName: 'Lisa Anderson', reviewer: 'Grace Kim', period: 'Q3 2026', rating: 0, status: 'pending' },
  { id: 'rev-8', employeeName: 'Tom Harris', reviewer: 'Henry Davis', period: 'Q1 2026', rating: 4.8, status: 'completed' },
  { id: 'rev-9', employeeName: 'Nancy Moore', reviewer: 'Ivy Chen', period: 'Q3 2026', rating: 0, status: 'in-progress' },
  { id: 'rev-10', employeeName: 'Oscar White', reviewer: 'Jack Taylor', period: 'Q2 2026', rating: 4.0, status: 'completed' },
];

const ratingStars = (r: number) => {
  if (r === 0) return <span className="text-ink-300 text-xs">â€”</span>;
  return <span className="text-amber-500 font-semibold text-sm">{r.toFixed(1)}</span>;
};

export function PerformanceReviewsPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'reviewer', 'period'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <ClipboardCheck className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Completed', value: MOCK.filter(i => i.status === 'completed').length, icon: <Star className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'In Progress', value: MOCK.filter(i => i.status === 'in-progress').length, icon: <User className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'in-progress', onClick: () => ps.setStatusFilter('in-progress') },
    { label: 'Pending', value: MOCK.filter(i => i.status === 'pending').length, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
  ], [ps.statusFilter]);
  const columns: Column<Review>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'reviewer', label: 'Reviewer', sortable: true },
    { key: 'period', label: 'Period', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true, render: (i) => ratingStars(i.rating) },
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
    <HrPageShell title="Performance Reviews" description="Manage employee performance evaluations"
      pageKey="performance-reviews"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Reviewer','Period','Rating','Status'], ps.filtered.map(i => [i.employeeName,i.reviewer,i.period,String(i.rating),i.status]), 'reviews'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Performance Reviews', ['Employee','Reviewer','Period','Rating','Status'], ps.filtered.map(i => [i.employeeName,i.reviewer,i.period,String(i.rating),i.status]), 'reviews')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees, reviewers..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Completed', value: 'completed' }, { label: 'In Progress', value: 'in-progress' }, { label: 'Pending', value: 'pending' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No reviews" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Review' : 'Add Review'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. John Doe" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Reviewer</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Alice Johnson" /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-ink-500 mb-1">Period</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="Q1 2026">Q1 2026</option><option value="Q2 2026">Q2 2026</option><option value="Q3 2026">Q3 2026</option><option value="Q4 2026">Q4 2026</option></select></div><div><label className="block text-xs font-medium text-ink-500 mb-1">Rating</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="1">1.0 — Needs Improvement</option><option value="2">2.0 — Below Expectations</option><option value="3">3.0 — Meets Expectations</option><option value="4">4.0 — Exceeds Expectations</option><option value="5">5.0 — Outstanding</option></select></div></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Comments</label><textarea className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Reviewer comments and feedback..." /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Review" message="Are you sure you want to delete this review?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Review Details">
        {ps.viewingId && (() => { const r = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><ClipboardCheck className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{r.employeeName}</p><p className="text-xs text-ink-400">Reviewer: {r.reviewer} · {r.period}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Rating</p><p className="text-xl font-bold text-ink-900 mt-1">{r.rating > 0 ? r.rating.toFixed(1) : '—'}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(r.status)}`}>{r.status}</span></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Review Period</p><p className="text-sm text-ink-700">{r.period}</p></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



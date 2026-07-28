import { useState, useEffect, useMemo } from 'react';
import { ClipboardCheck, Star, User, Calendar, Plus, Download, FileText, Edit3, Trash2, Eye, Send, CheckCircle2 } from 'lucide-react';
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

interface Review {
  id: string;
  employeeName: string;
  reviewerName: string;
  reviewPeriod: string;
  rating: number;
  reviewType: string;
  status: string;
  employeeId: string;
  reviewerId: string;
  summary?: string;
  strengths?: string;
  improvements?: string;
  goals?: string;
  dueDate?: string;
  createdAt?: string;
}

const ratingStars = (r: number) => {
  if (!r || r === 0) return <span className="text-ink-300 text-xs">—</span>;
  return <span className="text-amber-500 font-semibold text-sm">{r.toFixed(1)}</span>;
};

export function PerformanceReviewsPage() {
  const { success, error: showError } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formReviewerId, setFormReviewerId] = useState('');
  const [formReviewPeriod, setFormReviewPeriod] = useState('Q3 2026');
  const [formRating, setFormRating] = useState('3');
  const [formReviewType, setFormReviewType] = useState('manager');
  const [formStatus, setFormStatus] = useState('draft');
  const [formSummary, setFormSummary] = useState('');

  const loadReviews = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await hrApi.getPerformanceReviews({ pageSize: 500 });
      const data = res.data ?? res ?? [];
      const mapped: Review[] = data.map((r: any) => ({
        id: r.id,
        employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—',
        reviewerName: r.reviewer ? (r.reviewer.fullName || r.reviewer.email || '—') : '—',
        reviewPeriod: r.reviewPeriod,
        rating: r.rating ?? 0,
        reviewType: r.reviewType || 'manager',
        status: r.status,
        employeeId: r.employeeId,
        reviewerId: r.reviewerId,
        summary: r.summary,
        strengths: r.strengths,
        improvements: r.improvements,
        goals: r.goals,
        dueDate: r.dueDate,
        createdAt: r.createdAt,
      }));
      setReviews(mapped);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load reviews';
      setFetchError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReviews(); }, []);

  const ps = useHrPageState({
    data: reviews,
    initialSortKey: 'employeeName',
    searchKeys: ['employeeName', 'reviewerName', 'reviewPeriod', 'status', 'reviewType'],
    pageSize: 10,
  });

  const stats = useMemo(() => [
    { label: 'Total', value: reviews.length, icon: <ClipboardCheck className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Completed', value: reviews.filter(i => i.status === 'completed').length, icon: <Star className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Pending Review', value: reviews.filter(i => i.status === 'pending_review').length, icon: <User className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending_review', onClick: () => ps.setStatusFilter('pending_review') },
    { label: 'Draft', value: reviews.filter(i => i.status === 'draft').length, icon: <Calendar className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [reviews, ps.statusFilter]);

  const columns: Column<Review>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'reviewerName', label: 'Reviewer', sortable: true },
    { key: 'reviewPeriod', label: 'Period', sortable: true },
    { key: 'rating', label: 'Rating', sortable: true, render: (i) => ratingStars(i.rating) },
    { key: 'reviewType', label: 'Type', sortable: true, render: (i) => <span className="text-xs text-ink-500 capitalize">{i.reviewType}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status.replace('_', ' ')}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        {(i.status === 'draft' || i.status === 'pending_review') && (
          <button onClick={() => { handleOpenEditModal(i.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        )}
        {i.status === 'draft' && (
          <button onClick={() => handleSubmitReview(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Submit"><Send className="w-3.5 h-3.5" /></button>
        )}
        {i.status === 'pending_review' && (
          <button onClick={() => handleCompleteReview(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Complete"><CheckCircle2 className="w-3.5 h-3.5" /></button>
        )}
        {i.status === 'draft' && (
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    ), className: 'text-right' },
  ];

  const handleOpenAddModal = () => {
    setFormEmployeeId('');
    setFormReviewerId('');
    setFormReviewPeriod('Q3 2026');
    setFormRating('3');
    setFormReviewType('manager');
    setFormStatus('draft');
    setFormSummary('');
    ps.openAddModal();
  };

  const handleOpenEditModal = (id: string) => {
    const r = reviews.find(i => i.id === id);
    if (r) {
      setFormEmployeeId(r.employeeId || '');
      setFormReviewerId(r.reviewerId || '');
      setFormReviewPeriod(r.reviewPeriod);
      setFormRating(String(r.rating || 3));
      setFormReviewType(r.reviewType);
      setFormStatus(r.status);
      setFormSummary(r.summary || '');
    }
    ps.openEditModal(id);
  };

  const handleSubmitReview = async (id: string) => {
    try {
      await hrApi.submitPerformanceReview(id);
      success('Submitted for review');
      loadReviews();
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to submit');
    }
  };

  const handleCompleteReview = async (id: string) => {
    try {
      await hrApi.completePerformanceReview(id, { rating: 3, summary: 'Completed' });
      success('Review completed');
      loadReviews();
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to complete');
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        employeeId: formEmployeeId || undefined,
        reviewerId: formReviewerId || undefined,
        reviewPeriod: formReviewPeriod,
        reviewType: formReviewType,
        status: formStatus,
        summary: formSummary || undefined,
      };
      if (formStatus === 'completed') payload.rating = parseInt(formRating);
      if (ps.editingId) {
        await hrApi.updatePerformanceReview(ps.editingId, payload);
        success('Updated');
      } else {
        await hrApi.createPerformanceReview(payload);
        success('Created');
      }
      ps.closeModal();
      loadReviews();
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deletePerformanceReview(ps.deletingId);
      success('Deleted');
      ps.closeConfirmDelete();
      loadReviews();
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to delete');
    }
  };

  return (
    <HrPageShell title="Performance Reviews" description="Manage employee performance evaluations"
      pageKey="performance-reviews"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Reviewer','Period','Rating','Type','Status'], ps.filtered.map(i => [i.employeeName,i.reviewerName,i.reviewPeriod,String(i.rating),i.reviewType,i.status]), 'reviews'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Performance Reviews', ['Employee','Reviewer','Period','Rating','Type','Status'], ps.filtered.map(i => [i.employeeName,i.reviewerName,i.reviewPeriod,String(i.rating),i.reviewType,i.status]), 'reviews')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={handleOpenAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees, reviewers, types..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Draft', value: 'draft' },
          { label: 'Pending Review', value: 'pending_review' },
          { label: 'Completed', value: 'completed' },
          { label: 'Self', value: 'self' },
          { label: 'Manager', value: 'manager' },
          { label: 'Peer', value: 'peer' },
          { label: '360', value: '360' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400 text-sm">Loading reviews...</div>
      ) : fetchError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 text-sm">{fetchError}</div>
      ) : (
        <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
          sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
          selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
          page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
          from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
          emptyMessage="No reviews" emptyAction={<button onClick={handleOpenAddModal} className="text-xs font-medium text-primary">Add</button>} />
      )}
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Review' : 'Add Review'} onSubmit={handleCreateOrUpdate}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label><input value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Employee UUID" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Reviewer ID</label><input value={formReviewerId} onChange={e => setFormReviewerId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Reviewer UUID" /></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-ink-500 mb-1">Period</label><select value={formReviewPeriod} onChange={e => setFormReviewPeriod(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="Q1 2026">Q1 2026</option><option value="Q2 2026">Q2 2026</option><option value="Q3 2026">Q3 2026</option><option value="Q4 2026">Q4 2026</option></select></div><div><label className="block text-xs font-medium text-ink-500 mb-1">Review Type</label><select value={formReviewType} onChange={e => setFormReviewType(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="self">Self</option><option value="manager">Manager</option><option value="peer">Peer</option><option value="360">360</option></select></div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-ink-500 mb-1">Rating</label><select value={formRating} onChange={e => setFormRating(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="1">1.0 — Needs Improvement</option><option value="2">2.0 — Below Expectations</option><option value="3">3.0 — Meets Expectations</option><option value="4">4.0 — Exceeds Expectations</option><option value="5">5.0 — Outstanding</option></select></div><div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="pending_review">Pending Review</option><option value="completed">Completed</option></select></div></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Summary</label><textarea value={formSummary} onChange={e => setFormSummary(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Review summary and feedback..." /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Review" message="Are you sure you want to delete this review?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Review Details">
        {ps.viewingId && (() => { const r = reviews.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><ClipboardCheck className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{r.employeeName}</p><p className="text-xs text-ink-400">Reviewer: {r.reviewerName} · {r.reviewPeriod}</p></div></div>
            <div className="grid grid-cols-3 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Rating</p><p className="text-xl font-bold text-ink-900 mt-1">{r.rating > 0 ? r.rating.toFixed(1) : '—'}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Type</p><p className="text-sm font-medium text-ink-900 mt-1 capitalize">{r.reviewType}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(r.status)}`}>{r.status.replace('_', ' ')}</span></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Review Period</p><p className="text-sm text-ink-700">{r.reviewPeriod}</p></div>
            {r.summary && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Summary</p><p className="text-sm text-ink-700">{r.summary}</p></div>}
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}
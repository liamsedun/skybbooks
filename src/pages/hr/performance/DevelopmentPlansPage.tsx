import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
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

interface DevelopmentPlan {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  goal?: string;
  actionItems?: string;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  status: string;
}

const statusIcon = (s: string) => {
  switch (s) {
    case 'not_started': return <Clock className="w-3.5 h-3.5" />;
    case 'in_progress': return <TrendingUp className="w-3.5 h-3.5" />;
    case 'completed': return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'cancelled': return <XCircle className="w-3.5 h-3.5" />;
    default: return <AlertTriangle className="w-3.5 h-3.5" />;
  }
};

const statusBadge = (status: string) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(status)}`}>
    {statusIcon(status)}
    {status.replace('_', ' ')}
  </span>
);

export function DevelopmentPlansPage() {
  const { success: showSuccess, error: showError } = useToast();

  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGoal, setFormGoal] = useState('');
  const [formActionItems, setFormActionItems] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');

  const fetchPlans = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await hrApi.getDevelopmentPlans({ pageSize: 500 });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setPlans(items);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load development plans';
      setFetchError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const ps = useHrPageState({
    data: plans,
    initialSortKey: 'title',
    searchKeys: ['title', 'goal'],
    pageSize: 10,
  });

  const statusCounts = useMemo(() => ({
    all: plans.length,
    not_started: plans.filter(i => i.status === 'not_started').length,
    in_progress: plans.filter(i => i.status === 'in_progress').length,
    completed: plans.filter(i => i.status === 'completed').length,
  }), [plans]);

  const stats = useMemo(() => [
    { label: 'Total', value: statusCounts.all, icon: <TrendingUp className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Not Started', value: statusCounts.not_started, icon: <Clock className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'not_started', onClick: () => ps.setStatusFilter('not_started') },
    { label: 'In Progress', value: statusCounts.in_progress, icon: <TrendingUp className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'in_progress', onClick: () => ps.setStatusFilter('in_progress') },
    { label: 'Completed', value: statusCounts.completed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [statusCounts, ps.statusFilter]);

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'all') return plans;
    return plans.filter(i => i.status === ps.statusFilter);
  }, [plans, ps.statusFilter]);

  const columns: Column<DevelopmentPlan>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'goal', label: 'Goal', sortable: true, render: (i) => <span className="text-ink-600 line-clamp-1">{i.goal || '\u2014'}</span> },
    { key: 'status', label: 'Status', render: (i) => statusBadge(i.status) },
    { key: 'startDate', label: 'Start Date', sortable: true, render: (i) => <span className="text-ink-600 text-xs">{formatDate(i.startDate)}</span> },
    { key: 'targetDate', label: 'Target Date', sortable: true, render: (i) => <span className="text-ink-600 text-xs">{formatDate(i.targetDate)}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => { ps.openEditModal(i.id); populateForm(i); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const resetForm = () => {
    setFormTitle('');
    setFormEmployeeId('');
    setFormDescription('');
    setFormGoal('');
    setFormActionItems('');
    setFormStartDate('');
    setFormTargetDate('');
  };

  const populateForm = (p: DevelopmentPlan) => {
    setFormTitle(p.title);
    setFormEmployeeId(p.employeeId);
    setFormDescription(p.description || '');
    setFormGoal(p.goal || '');
    setFormActionItems(p.actionItems || '');
    setFormStartDate(p.startDate || '');
    setFormTargetDate(p.targetDate || '');
  };

  const handleOpenAdd = () => {
    resetForm();
    ps.openAddModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { showError('Title is required'); return; }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        title: formTitle.trim(),
        employeeId: formEmployeeId.trim() || undefined,
        description: formDescription.trim() || undefined,
        goal: formGoal.trim() || undefined,
        actionItems: formActionItems.trim() || undefined,
        startDate: formStartDate || undefined,
        targetDate: formTargetDate || undefined,
      };
      if (ps.editingId) {
        await hrApi.updateDevelopmentPlan(ps.editingId, payload);
        showSuccess('Development plan updated');
      } else {
        await hrApi.createDevelopmentPlan(payload);
        showSuccess('Development plan created');
      }
      ps.closeModal();
      resetForm();
      await fetchPlans();
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    setSubmitting(true);
    try {
      await hrApi.deleteDevelopmentPlan(ps.deletingId);
      showSuccess('Development plan deleted');
      ps.closeConfirmDelete();
      await fetchPlans();
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };

  const csvHeaders = ['Title', 'Employee ID', 'Description', 'Goal', 'Action Items', 'Start Date', 'Target Date', 'Completed Date', 'Status'];
  const csvRows = (data: DevelopmentPlan[]) => data.map(p => [
    p.title, p.employeeId, p.description || '', p.goal || '', p.actionItems || '',
    formatDate(p.startDate), formatDate(p.targetDate), formatDate(p.completedDate), p.status,
  ]);

  return (
    <HrPageShell title="Development Plans" description="Track employee development and growth plans"
      pageKey="development-plans"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(csvHeaders, csvRows(ps.filtered), 'development-plans'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Development Plans', csvHeaders, csvRows(ps.filtered), 'development-plans')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={handleOpenAdd} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by title or goal..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Not Started', value: 'not_started' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Completed', value: 'completed' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400 text-sm">Loading development plans...</div>
      ) : fetchError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 text-sm">{fetchError}</div>
      ) : (
        <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
          sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
          selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
          page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
          from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
          emptyMessage="No development plans" emptyAction={<button onClick={handleOpenAdd} className="text-xs font-medium text-primary">Add</button>} />
      )}
      <HrFormModal open={ps.modalOpen} onClose={() => { ps.closeModal(); resetForm(); }} title={ps.editingId ? 'Edit Development Plan' : 'Add Development Plan'} onSubmit={handleSubmit} loading={submitting}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Title</label><input value={formTitle} onChange={e => setFormTitle(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Leadership Training" /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label><input value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Employee UUID" /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Describe the development plan..." /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Goal</label><textarea value={formGoal} onChange={e => setFormGoal(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={2} placeholder="What should the employee achieve?" /></div>
        <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Action Items</label><textarea value={formActionItems} onChange={e => setFormActionItems(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={2} placeholder="Key steps and milestones" /></div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Start Date</label><input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Target Date</label><input type="date" value={formTargetDate} onChange={e => setFormTargetDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Development Plan" message="Are you sure you want to delete this development plan?" confirmLabel="Delete" variant="danger" loading={submitting} />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Development Plan Details">
        {ps.viewingId && (() => {
          const p = plans.find(i => i.id === ps.viewingId);
          if (!p) return <p className="text-sm text-ink-400">Plan not found</p>;
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
                <div><p className="text-sm font-semibold text-ink-900">{p.title}</p><p className="text-xs text-ink-400">Employee {p.employeeId.slice(0, 8)}...</p></div>
              </div>
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Status</p>{statusBadge(p.status)}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Start Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(p.startDate) || '\u2014'}</p></div>
                <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Target Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(p.targetDate) || '\u2014'}</p></div>
              </div>
              {p.description && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Description</p><p className="text-sm text-ink-700">{p.description}</p></div>}
              {p.goal && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Goal</p><p className="text-sm text-ink-700">{p.goal}</p></div>}
              {p.actionItems && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Action Items</p><p className="text-sm text-ink-700 whitespace-pre-wrap">{p.actionItems}</p></div>}
              {p.completedDate && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Completed Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(p.completedDate)}</p></div>}
            </div>
          );
        })()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

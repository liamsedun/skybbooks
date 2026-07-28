import { useState, useEffect, useRef, useMemo } from 'react';
import { Target, TrendingUp, Users, Calendar, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Goal {
  id: string; title: string; owner: string; cycleName: string;
  keyResults: number; progress: number; status: string;
  description: string;
}

interface OkrPayload {
  title: string; description: string; isActive: boolean;
  ownerId?: string; cycleId?: string;
}

const progressColor = (pct: number) => {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
};

function deriveStatus(progress: number | null, isActive: boolean | null): string {
  if (progress !== null && progress >= 100) return 'completed';
  if (isActive === false) return 'draft';
  return 'active';
}

function deriveIsActive(status: string): boolean {
  if (status === 'draft') return false;
  return true;
}

function mapOkrToGoal(raw: any): Goal {
  const ownerName = raw.owner ? `${raw.owner.firstName || ''} ${raw.owner.lastName || ''}`.trim() : '';
  const cycleName = raw.cycle?.name || '';
  const progress = raw.progress ?? 0;
  const krCount = Array.isArray(raw.keyResults) ? raw.keyResults.length : 0;
  const status = deriveStatus(raw.progress, raw.isActive);
  return {
    id: raw.id,
    title: raw.title || '',
    owner: ownerName,
    cycleName,
    keyResults: krCount,
    progress,
    status,
    description: raw.description || '',
  };
}

export function GoalsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getOkrs({ pageSize: 500 });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setData(items.map(mapOkrToGoal));
    } catch {
      toast('Failed to load goals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'title', searchKeys: ['title', 'owner', 'cycleName'], pageSize: 10 });

  const statusCounts = useMemo(() => ({
    all: data.length,
    active: data.filter(i => i.status === 'active').length,
    completed: data.filter(i => i.status === 'completed').length,
    draft: data.filter(i => i.status === 'draft').length,
  }), [data]);

  const stats = useMemo(() => [
    { label: 'Total', value: statusCounts.all, icon: <Target className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: statusCounts.active, icon: <TrendingUp className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Completed', value: statusCounts.completed, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Draft', value: statusCounts.draft, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [statusCounts, ps.statusFilter]);

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'all') return data;
    return data.filter(i => i.status === ps.statusFilter);
  }, [data, ps.statusFilter]);

  const columns: Column<Goal>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'owner', label: 'Owner', sortable: true },
    { key: 'cycleName', label: 'Cycle', sortable: true },
    { key: 'keyResults', label: 'Key Results', sortable: true, render: (i) => <span className="text-ink-600">{i.keyResults}</span> },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const title = fd.get('title') as string;
    const description = fd.get('description') as string;
    const status = fd.get('status') as string;
    if (!title?.trim()) { toast('Title is required', 'error'); return; }
    const payload: OkrPayload = { title: title.trim(), description: description?.trim() || '', isActive: deriveIsActive(status) };
    try {
      if (ps.editingId) {
        await hrApi.updateOkr(ps.editingId, payload);
        toast('Goal updated', 'success');
      } else {
        await hrApi.createOkr(payload);
        toast('Goal created', 'success');
      }
      ps.closeModal();
      await fetchData();
    } catch {
      toast(ps.editingId ? 'Failed to update goal' : 'Failed to create goal', 'error');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteOkr(ps.deletingId);
      toast('Goal deleted', 'success');
      ps.closeConfirmDelete();
      await fetchData();
    } catch {
      toast('Failed to delete goal', 'error');
    }
  };

  const editingGoal = ps.editingId ? data.find(i => i.id === ps.editingId) : null;
  const viewingGoal = ps.viewingId ? data.find(i => i.id === ps.viewingId) : null;

  if (loading) {
    return (
      <HrPageShell title="OKR Goals" description="Manage objectives and key results" pageKey="goals">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title="OKR Goals" description="Manage objectives and key results"
      pageKey="goals"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Owner','Cycle','Key Results','Progress','Status'], ps.filtered.map(i => [i.title,i.owner,i.cycleName,String(i.keyResults),`${i.progress}%`,i.status]), 'goals'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('OKR Goals', ['Title','Owner','Cycle','Key Results','Progress','Status'], ps.filtered.map(i => [i.title,i.owner,i.cycleName,String(i.keyResults),`${i.progress}%`,i.status]), 'goals')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search goals..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No goals" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Goal' : 'Add Goal'} onSubmit={handleSubmit}>
        <form ref={formRef}>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Goal Title</label><input name="title" defaultValue={editingGoal?.title || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Increase Employee Retention" /></div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Cycle</label>
              <select name="cycleName" defaultValue={editingGoal?.cycleName || 'Q3 2026'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="Q1 2026">Q1 2026</option>
                <option value="Q2 2026">Q2 2026</option>
                <option value="Q3 2026">Q3 2026</option>
                <option value="Q4 2026">Q4 2026</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
              <select name="status" defaultValue={editingGoal?.status || 'draft'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="mt-3"><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea name="description" defaultValue={editingGoal?.description || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Describe the objective and its impact..." /></div>
        </form>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Goal" message="Are you sure you want to delete this goal?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Goal Details">
        {viewingGoal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><Target className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{viewingGoal.title}</p><p className="text-xs text-ink-400">Owned by {viewingGoal.owner || 'Unassigned'} · {viewingGoal.cycleName || 'No cycle'}</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Progress</p><div className="flex items-center gap-2"><div className="flex-1 h-2.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${progressColor(viewingGoal.progress)}`} style={{ width: `${viewingGoal.progress}%` }} /></div><span className="text-sm font-semibold text-ink-700 w-10 text-right">{viewingGoal.progress}%</span></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Key Results</p><p className="text-sm font-medium text-ink-700">{viewingGoal.keyResults} key result{viewingGoal.keyResults !== 1 ? 's' : ''}</p></div>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingGoal.status)}`}>{viewingGoal.status}</span></div><div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Cycle</p><p className="text-sm text-ink-700 mt-1">{viewingGoal.cycleName || '—'}</p></div></div>
            {viewingGoal.description && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Description</p><p className="text-sm text-ink-700">{viewingGoal.description}</p></div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

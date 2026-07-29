import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
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

interface PerformanceCycleItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  reviewType: string;
  isActive: boolean;
}

const reviewTypeColors: Record<string, string> = {
  self: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  manager: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  peer: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  '360': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
};

export function PerformanceCyclesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PerformanceCycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '', reviewType: 'manager' });
  const [submitting, setSubmitting] = useState(false);

  const ps = useHrPageState({ data: items, initialSortKey: 'name', searchKeys: ['name'], pageSize: 10 });

  const fetchItems = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await hrApi.getPerformanceCycles();
      setItems(Array.isArray(res) ? res : res.data ?? []);
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to load performance cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const activeCount = useMemo(() => items.filter(i => i.isActive).length, [items]);
  const inactiveCount = useMemo(() => items.filter(i => !i.isActive).length, [items]);

  const stats = useMemo(() => [
    { label: 'Total Cycles', value: items.length.toString(), icon: <Calendar className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: activeCount.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: inactiveCount.toString(), icon: <XCircle className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [items, ps.statusFilter, activeCount, inactiveCount]);

  const columns: Column<PerformanceCycleItem>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'startDate', label: 'Start Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.startDate)}</span> },
    { key: 'endDate', label: 'End Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.endDate)}</span> },
    { key: 'reviewType', label: 'Review Type', render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${reviewTypeColors[i.reviewType] || reviewTypeColors.manager}`}>{i.reviewType}</span>
    )},
    { key: 'isActive', label: 'Status', render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.isActive ? statusColor('active') : statusColor('inactive')}`}>{i.isActive ? 'Active' : 'Inactive'}</span>
    )},
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => { setFormData({ name: i.name, startDate: i.startDate, endDate: i.endDate, reviewType: i.reviewType }); ps.openEditModal(i.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    ps.setFormError(null);
    try {
      if (ps.editingId) {
        await hrApi.updatePerformanceCycle(ps.editingId, formData);
        toast('Performance cycle updated', 'success');
      } else {
        await hrApi.createPerformanceCycle(formData);
        toast('Performance cycle created', 'success');
      }
      ps.closeModal();
      await fetchItems();
    } catch (err: any) {
      const msg = err?.message || 'Operation failed';
      ps.setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    setSubmitting(true);
    try {
      await hrApi.deletePerformanceCycle(ps.deletingId);
      toast('Performance cycle deleted', 'success');
      ps.closeConfirmDelete();
      await fetchItems();
    } catch (err: any) {
      toast(err?.message || 'Delete failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNew = () => {
    setFormData({ name: '', startDate: '', endDate: '', reviewType: 'manager' });
    ps.openAddModal();
  };

  const csvHeaders = ['Name', 'Start Date', 'End Date', 'Review Type', 'Status'];
  const csvRows = items.map(i => [i.name, formatDate(i.startDate), formatDate(i.endDate), i.reviewType, i.isActive ? 'Active' : 'Inactive']);

  return (
    <HrPageShell title="Performance Cycles" description="Manage performance review cycles and periods"
      pageKey="performance-cycles"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'performance-cycles'); toast('CSV exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Performance Cycles', csvHeaders, csvRows, 'performance-cycles')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={handleAddNew} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Cycle</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search cycles..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        loading={loading} error={fetchError}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No performance cycles found" emptyAction={<button onClick={handleAddNew} className="text-xs font-medium text-primary">Add your first cycle</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Cycle' : 'Add Cycle'}
        onSubmit={handleSubmit} error={ps.formError} loading={submitting}>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Cycle Name</label>
          <input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Start Date</label>
          <input type="date" value={formData.startDate} onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))} required
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">End Date</label>
          <input type="date" value={formData.endDate} onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))} required
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Review Type</label>
          <select value={formData.reviewType} onChange={e => setFormData(p => ({ ...p, reviewType: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            <option value="self">Self</option>
            <option value="manager">Manager</option>
            <option value="peer">Peer</option>
            <option value="360">360</option>
          </select>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete}
        title="Delete Cycle" message="Are you sure you want to delete this performance cycle?" confirmLabel="Delete" variant="danger" loading={submitting} />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Cycle Details">
        {ps.viewingId && (() => {
          const c = items.find(i => i.id === ps.viewingId);
          if (!c) return null;
          return (
            <div className="space-y-3 text-sm text-ink-600">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{c.name}</p></div>
                <div><p className="text-ink-400 text-xs">Review Type</p><p className="font-medium text-ink-900 capitalize">{c.reviewType}</p></div>
                <div><p className="text-ink-400 text-xs">Start Date</p><p className="font-medium text-ink-900">{formatDate(c.startDate)}</p></div>
                <div><p className="text-ink-400 text-xs">End Date</p><p className="font-medium text-ink-900">{formatDate(c.endDate)}</p></div>
                <div><p className="text-ink-400 text-xs">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.isActive ? statusColor('active') : statusColor('inactive')}`}>{c.isActive ? 'Active' : 'Inactive'}</span></div>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
    </HrPageShell>
  );
}
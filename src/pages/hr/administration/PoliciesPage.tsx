import { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle, Clock, Archive, Plus, Download, Edit3, Trash2, Eye } from 'lucide-react';
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

interface PolicyItem {
  id: string;
  title: string;
  category: string;
  effectiveDate: string;
  version: number;
  status: string;
}

export function PoliciesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PolicyItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getPolicies();
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'title', searchKeys: ['title', 'category'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Policies', value: data.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.status === 'active').length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
    { label: 'Archived', value: data.filter(i => i.status === 'archived').length, icon: <Archive className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'archived', onClick: () => ps.setStatusFilter('archived') },
  ], [data, ps.statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deletePolicy(id);
      setData(prev => prev.filter(i => i.id !== id));
      toast('Deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      title: (form.elements.nativeItem('title') as HTMLInputElement).value,
      category: (form.elements.nativeItem('category') as HTMLSelectElement).value,
      effectiveDate: (form.elements.nativeItem('effectiveDate') as HTMLInputElement).value,
      status: (form.elements.nativeItem('status') as HTMLSelectElement).value,
    };
    try {
      if (ps.editingId) {
        await hrApi.updatePolicy(ps.editingId, payload);
        const res = await hrApi.getPolicies();
        if (res?.data) setData(res.data);
        toast('Updated', 'success');
      } else {
        await hrApi.createPolicy(payload);
        const res = await hrApi.getPolicies();
        if (res?.data) setData(res.data);
        toast('Created', 'success');
      }
      ps.closeModal();
    } catch { toast('Failed to save', 'error'); }
  };

  const columns: Column<PolicyItem>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title}</span> },
    { key: 'category', label: 'Category', sortable: true, render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        i.category === 'leave' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400' :
        i.category === 'conduct' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400' :
        i.category === 'attendance' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' :
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
      }`}>{i.category}</span>
    )},
    { key: 'effectiveDate', label: 'Effective', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.effectiveDate)}</span> },
    { key: 'version', label: 'Version', render: (i) => <span className="text-ink-500">v{i.version}</span> },
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
    <HrPageShell title="HR Policies" description="Manage company policies"
      pageKey="policies"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title', 'Category', 'Effective Date', 'Version', 'Status'], ps.filtered.map(p => [p.title, p.category, p.effectiveDate, String(p.version), p.status]), 'policies'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('HR Policies', ['Title', 'Category', 'Effective Date', 'Version', 'Status'], ps.filtered.map(p => [p.title, p.category, p.effectiveDate, String(p.version), p.status]), 'policies')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Policy</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search policies..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }, { label: 'Archived', value: 'archived' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No policies found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add your first policy</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Policy' : 'Add Policy'} onSubmit={handleSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Title</label><input name="title" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Category</label><select name="category" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>leave</option><option>conduct</option><option>attendance</option><option>compensation</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Effective Date</label><input name="effectiveDate" type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select name="status" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { if (ps.confirmingId) { handleDelete(ps.confirmingId); } ps.closeConfirmDelete(); }} title="Delete Policy" message="Are you sure you want to delete this policy?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Policy Details">
        {ps.viewingId && (() => { const p = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div className="col-span-2"><p className="text-ink-400 text-xs">Title</p><p className="font-semibold text-ink-900">{p.title}</p></div><div><p className="text-ink-400 text-xs">Category</p><p className="font-medium text-ink-900 capitalize">{p.category}</p></div><div><p className="text-ink-400 text-xs">Version</p><p className="font-medium text-ink-900">v{p.version}</p></div><div><p className="text-ink-400 text-xs">Effective Date</p><p className="font-medium text-ink-900">{formatDate(p.effectiveDate)}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{p.status}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


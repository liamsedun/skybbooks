import { useState, useEffect, useMemo } from 'react';
import { FileText, Clock, Layout, FileSignature, Plus, Download, FileText as FileTextIcon, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Template {
  id: string; name: string; type: string;
  lastUsed: string; status: string;
}

export function LetterTemplatesPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getLetterTemplates();
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'type'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Layout className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.status === 'active').length, icon: <FileSignature className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: data.filter(i => i.status === 'inactive').length, icon: <Clock className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [data, ps.statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteLetterTemplate(id);
      setData(prev => prev.filter(i => i.id !== id));
      showSuccess('Deleted');
    } catch { showError('Failed to delete'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      name: (form.elements.nativeItem('name') as HTMLInputElement).value,
      type: (form.elements.nativeItem('type') as HTMLSelectElement).value,
      status: (form.elements.nativeItem('status') as HTMLSelectElement).value,
    };
    try {
      if (ps.editingId) {
        await hrApi.updateLetterTemplate(ps.editingId, payload);
        const res = await hrApi.getLetterTemplates();
        if (res?.data) setData(res.data);
        showSuccess('Updated');
      } else {
        await hrApi.createLetterTemplate(payload);
        const res = await hrApi.getLetterTemplates();
        if (res?.data) setData(res.data);
        showSuccess('Created');
      }
      ps.closeModal();
    } catch { showError('Failed to save'); }
  };

  const columns: Column<Template>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'lastUsed', label: 'Last Used', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.lastUsed)}</span> },
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
    <HrPageShell title="Letter Templates" description="Manage HR letter and document templates"
      pageKey="letters"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name','Type','Last Used','Status'], ps.filtered.map(i => [i.name,i.type,i.lastUsed,i.status]), 'templates'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Letter Templates', ['Name','Type','Last Used','Status'], ps.filtered.map(i => [i.name,i.type,i.lastUsed,i.status]), 'templates')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileTextIcon className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search templates..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No templates" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Template' : 'Add Template'} onSubmit={handleSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Template Name</label><input name="name" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Standard Offer Letter" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select name="type" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Offer Letter</option><option>Promotion Letter</option><option>Confirmation Letter</option><option>Warning Letter</option><option>Resignation Letter</option><option>Transfer Letter</option><option>Salary Letter</option><option>Experience Letter</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select name="status" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { if (ps.confirmingId) { handleDelete(ps.confirmingId); } ps.closeConfirmDelete(); }} title="Delete Template" message="Are you sure you want to delete this template?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Template Details">
        {ps.viewingId && (() => { const t = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center"><Layout className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{t.name}</p><p className="text-xs text-ink-400">{t.type}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Last Used</p><p className="text-sm text-ink-700 mt-1">{formatDate(t.lastUsed)}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(t.status)}`}>{t.status}</span></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



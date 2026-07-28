import { useState, useEffect, useMemo } from 'react';
import { FolderOpen, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface DocCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  icon: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const EMPTY: DocCategory = { id: '', name: '', description: '', parentId: null, icon: null, color: '#3b82f6', sortOrder: 0, isActive: true, createdAt: '' };

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString() : '-'; }

export function DocCategoriesPage() {
  const { success: showSuccess } = useToast();
  const [data, setData] = useState<DocCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<DocCategory>({ ...EMPTY });
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getDocCategories();
      setData(Array.isArray(res) ? res : res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'description'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <FolderOpen className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.isActive).length, icon: <FolderOpen className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: data.filter(i => !i.isActive).length, icon: <FolderOpen className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [data, ps.statusFilter]);

  const openAdd = () => { setForm({ ...EMPTY }); setFormError(''); ps.openAddModal(); };
  const openEdit = (id: string) => { const item = data.find(d => d.id === id); if (item) { setForm({ ...item }); setFormError(''); ps.openEditModal(id); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name) { setFormError('Name is required'); return; }
    try {
      const payload = { name: form.name, description: form.description || null, parentId: form.parentId, icon: form.icon || null, color: form.color, sortOrder: form.sortOrder, isActive: form.isActive };
      if (ps.editingId) {
        await hrApi.updateDocCategory(ps.editingId, payload);
        showSuccess('Category updated');
      } else {
        await hrApi.createDocCategory(payload);
        showSuccess('Category created');
      }
      ps.closeModal();
      fetchData();
    } catch (err: any) { setFormError(err?.response?.data?.error || err?.message || 'Failed to save'); }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteDocCategory(ps.deletingId);
      showSuccess('Category deleted');
      ps.closeConfirmDelete();
      fetchData();
    } catch (err: any) { console.error(err); }
  };

  const columns: Column<DocCategory>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'description', label: 'Description', render: (i) => <span className="text-ink-500 truncate max-w-[200px] block">{i.description || '-'}</span> },
    { key: 'color', label: 'Color', render: (i) => <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded-full border border-border-custom" style={{ backgroundColor: i.color }} /><span className="text-xs text-ink-400 font-mono">{i.color}</span></span> },
    { key: 'sortOrder', label: 'Sort Order', sortable: true, render: (i) => <span className="text-ink-600">{i.sortOrder}</span> },
    { key: 'isActive', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-ink-100 text-ink-500 border-ink-200'}`}>{i.isActive ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => openEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'active') return ps.filtered.filter(i => i.isActive);
    if (ps.statusFilter === 'inactive') return ps.filtered.filter(i => !i.isActive);
    return ps.filtered;
  }, [ps.filtered, ps.statusFilter]);

  return (
    <HrPageShell title="Document Categories" description="Organize documents into categories for easy classification"
      pageKey="doc-categories"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Description', 'Color', 'Sort Order', 'Status'], filteredByStatus.map(a => [a.name, a.description || '', a.color, String(a.sortOrder), a.isActive ? 'Active' : 'Inactive']), 'doc-categories'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Document Categories', ['Name', 'Description', 'Color', 'Sort Order', 'Status'], filteredByStatus.map(a => [a.name, a.description || '', a.color, String(a.sortOrder), a.isActive ? 'Active' : 'Inactive']), 'doc-categories')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Category</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search categories..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No categories" emptyAction={<button onClick={openAdd} className="text-xs font-medium text-primary">Add your first category</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Category' : 'Add Category'} onSubmit={handleSubmit} formError={formError}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value || null})} rows={3} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Color (hex)</label><div className="flex items-center gap-3"><input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-10 h-10 rounded-xl border border-border-custom cursor-pointer" /><input value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" placeholder="#3b82f6" /></div></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Sort Order</label><input type="number" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: Number(e.target.value)})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <label className="flex items-center gap-2 text-sm text-ink-600"><input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="rounded border-border-custom" /> Active</label>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Category" message="Are you sure you want to delete this category? Files in this category will be uncategorized." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Category Details">
        {ps.viewingId && (() => { const a = data.find(i => i.id === ps.viewingId); if (!a) return null; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{a.name}</p></div>
              <div><p className="text-ink-400 text-xs">Color</p><p className="font-medium text-ink-900 flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />{a.color}</p></div>
              <div className="col-span-2"><p className="text-ink-400 text-xs">Description</p><p className="font-medium text-ink-900">{a.description || '-'}</p></div>
              <div><p className="text-ink-400 text-xs">Sort Order</p><p className="font-medium text-ink-900">{a.sortOrder}</p></div>
              <div><p className="text-ink-400 text-xs">Status</p><p className="font-medium capitalize">{a.isActive ? 'Active' : 'Inactive'}</p></div>
              <div><p className="text-ink-400 text-xs">Created</p><p className="font-medium text-ink-900">{fmtDate(a.createdAt)}</p></div>
            </div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

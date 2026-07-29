import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Allowance {
  id: string;
  name: string;
  type: string;
  amount: number;
  recurrence: string;
  isActive: boolean;
  createdAt: string;
}

const EMPTY: Allowance = { id: '', name: '', type: 'fixed', amount: 0, recurrence: 'monthly', isActive: true, createdAt: '' };

function fmtAmount(n: number) { return '₦' + (n || 0).toLocaleString(); }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString() : '-'; }

export function AllowancesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Allowance>({ ...EMPTY });
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getAllowances();
      setData(Array.isArray(res) ? res : res.data || []);
    } catch (err) { console.toast(err, 'error'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'type'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <DollarSign className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.isActive).length, icon: <DollarSign className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Fixed', value: data.filter(i => i.type === 'fixed').length, icon: <DollarSign className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'fixed', onClick: () => ps.setStatusFilter('fixed') },
    { label: 'Recurring', value: data.filter(i => i.type === 'recurring').length, icon: <DollarSign className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'recurring', onClick: () => ps.setStatusFilter('recurring') },
  ], [data, ps.statusFilter]);

  const openAdd = () => { setForm({ ...EMPTY }); setFormError(''); ps.openAddModal(); };
  const openEdit = (id: string) => { const item = data.find(d => d.id === id); if (item) { setForm({ ...item }); setFormError(''); ps.openEditModal(id); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name) { setFormError('Name is required'); return; }
    try {
      if (ps.editingId) {
        await hrApi.updateAllowance(ps.editingId, { name: form.name, type: form.type, amount: form.amount, recurrence: form.recurrence, isActive: form.isActive });
        toast('Allowance updated', 'success');
      } else {
        await hrApi.createAllowance({ name: form.name, type: form.type, amount: form.amount, recurrence: form.recurrence, isActive: form.isActive });
        toast('Allowance created', 'success');
      }
      ps.closeModal();
      fetchData();
    } catch (err: any) { setFormError(err?.response?.data?.error || err?.message || 'Failed to save'); }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteAllowance(ps.deletingId);
      toast('Allowance deleted', 'success');
      ps.closeConfirmDelete();
      fetchData();
    } catch (err: any) { console.toast(err, 'error'); }
  };

  const columns: Column<Allowance>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.type === 'fixed' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{i.type}</span> },
    { key: 'amount', label: 'Amount', render: (i) => <span className="font-medium text-ink-900">{fmtAmount(i.amount)}</span> },
    { key: 'recurrence', label: 'Recurrence', render: (i) => <span className="text-ink-600 capitalize">{i.recurrence}</span> },
    { key: 'isActive', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-ink-100 text-ink-500 border-ink-200'}`}>{i.isActive ? 'Active' : 'Inactive'}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => openEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Allowances" description="Define and manage allowance types and amounts"
      pageKey="allowances"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Type', 'Amount', 'Recurrence', 'Status'], ps.filtered.map(a => [a.name, a.type, String(a.amount), a.recurrence, a.isActive ? 'Active' : 'Inactive']), 'allowances'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Allowances', ['Name', 'Type', 'Amount', 'Recurrence', 'Status'], ps.filtered.map(a => [a.name, a.type, fmtAmount(a.amount), a.recurrence, a.isActive ? 'Active' : 'Inactive']), 'allowances')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Allowance</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search allowances..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Fixed', value: 'fixed' }, { label: 'Recurring', value: 'recurring' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No allowances" emptyAction={<button onClick={openAdd} className="text-xs font-medium text-primary">Add your first allowance</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Allowance' : 'Add Allowance'} onSubmit={handleSubmit} formError={formError}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="fixed">Fixed</option><option value="recurring">Recurring</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Amount (₦)</label><input type="number" value={form.amount || 0} onChange={e => setForm({...form, amount: Number(e.target.value)})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Recurrence</label><select value={form.recurrence} onChange={e => setForm({...form, recurrence: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></div>
        <label className="flex items-center gap-2 text-sm text-ink-600"><input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="rounded border-border-custom" /> Active</label>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Allowance" message="Are you sure you want to delete this allowance?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Allowance Details">
        {ps.viewingId && (() => { const a = data.find(i => i.id === ps.viewingId); if (!a) return null; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{a.name}</p></div>
              <div><p className="text-ink-400 text-xs">Type</p><p className="font-medium text-ink-900 capitalize">{a.type}</p></div>
              <div><p className="text-ink-400 text-xs">Amount</p><p className="font-semibold text-ink-900">{fmtAmount(a.amount)}</p></div>
              <div><p className="text-ink-400 text-xs">Recurrence</p><p className="font-medium text-ink-900 capitalize">{a.recurrence}</p></div>
              <div><p className="text-ink-400 text-xs">Status</p><p className="font-medium capitalize">{a.isActive ? 'Active' : 'Inactive'}</p></div>
              <div><p className="text-ink-400 text-xs">Created</p><p className="font-medium text-ink-900">{fmtDate(a.createdAt)}</p></div>
            </div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

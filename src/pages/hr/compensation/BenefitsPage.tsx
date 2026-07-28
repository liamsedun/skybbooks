import { useState, useEffect, useMemo } from 'react';
import { HeartPulse, Shield, ShieldCheck, Gift, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface BenefitItem {
  id: string;
  name: string;
  type: string;
  description: string;
  provider: string;
  costEmployer: number;
  costEmployee: number;
  isActive: boolean;
  createdAt: string;
}

function fmt(n: number) { return '₦' + (n || 0).toLocaleString(); }

const EMPTY: BenefitItem = { id: '', name: '', type: 'health', description: '', provider: '', costEmployer: 0, costEmployee: 0, isActive: true, createdAt: '' };

export function BenefitsPage() {
  const { success: showSuccess } = useToast();
  const [data, setData] = useState<BenefitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<BenefitItem>({ ...EMPTY });
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getBenefits();
      setData(Array.isArray(res) ? res : res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'type', 'provider'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Benefits', value: data.length, icon: <Gift className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.isActive).length, icon: <ShieldCheck className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Health', value: data.filter(i => i.type === 'health').length, icon: <HeartPulse className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'health', onClick: () => ps.setStatusFilter('health') },
    { label: 'Insurance', value: data.filter(i => i.type === 'insurance').length, icon: <Shield className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'insurance', onClick: () => ps.setStatusFilter('insurance') },
  ], [data, ps.statusFilter]);

  const openAdd = () => { setForm({ ...EMPTY }); setFormError(''); ps.openAddModal(); };
  const openEdit = (id: string) => { const item = data.find(d => d.id === id); if (item) { setForm({ ...item }); setFormError(''); ps.openEditModal(id); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name) { setFormError('Name is required'); return; }
    try {
      if (ps.editingId) {
        await hrApi.updateBenefit(ps.editingId, { name: form.name, type: form.type, description: form.description, provider: form.provider, costEmployer: form.costEmployer, costEmployee: form.costEmployee, isActive: form.isActive });
        showSuccess('Benefit updated');
      } else {
        await hrApi.createBenefit({ name: form.name, type: form.type, description: form.description, provider: form.provider, costEmployer: form.costEmployer, costEmployee: form.costEmployee, isActive: form.isActive });
        showSuccess('Benefit created');
      }
      ps.closeModal();
      fetchData();
    } catch (err: any) { setFormError(err?.response?.data?.error || err?.message || 'Failed to save'); }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteBenefit(ps.deletingId);
      showSuccess('Benefit deleted');
      ps.closeConfirmDelete();
      fetchData();
    } catch (err: any) { console.error(err); }
  };

  const columns: Column<BenefitItem>[] = [
    { key: 'name', label: 'Benefit', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.type === 'health' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : i.type === 'pension' ? 'bg-purple-50 text-purple-700 border-purple-200' : i.type === 'insurance' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>{i.type}</span> },
    { key: 'provider', label: 'Provider', render: (i) => <span className="text-ink-500">{i.provider || '-'}</span> },
    { key: 'costEmployer', label: 'Employer Cost', render: (i) => <span className="font-medium text-ink-900">{fmt(i.costEmployer)}</span> },
    { key: 'costEmployee', label: 'Employee Cost', render: (i) => <span className="text-ink-600">{fmt(i.costEmployee)}</span> },
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
    <HrPageShell title="Benefits" description="Manage employee benefits and enrollments"
      pageKey="benefits"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Benefit', 'Type', 'Provider', 'Employer Cost', 'Employee Cost', 'Status'], ps.filtered.map(b => [b.name, b.type, b.provider || '', String(b.costEmployer), String(b.costEmployee), b.isActive ? 'Active' : 'Inactive']), 'benefits'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Benefits', ['Benefit', 'Type', 'Provider', 'Employer Cost', 'Status'], ps.filtered.map(b => [b.name, b.type, b.provider || '', fmt(b.costEmployer), b.isActive ? 'Active' : 'Inactive']), 'benefits')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Benefit</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search benefits..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Health', value: 'health' }, { label: 'Pension', value: 'pension' }, { label: 'Insurance', value: 'insurance' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No benefits" emptyAction={<button onClick={openAdd} className="text-xs font-medium text-primary">Add your first benefit</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Benefit' : 'Add Benefit'} onSubmit={handleSubmit} formError={formError}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="health">Health</option><option value="pension">Pension</option><option value="insurance">Insurance</option><option value="perks">Perks</option><option value="other">Other</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Provider</label><input value={form.provider || ''} onChange={e => setForm({...form, provider: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Description</label><textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employer Cost (₦)</label><input type="number" value={form.costEmployer || 0} onChange={e => setForm({...form, costEmployer: Number(e.target.value)})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee Cost (₦)</label><input type="number" value={form.costEmployee || 0} onChange={e => setForm({...form, costEmployee: Number(e.target.value)})} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <label className="flex items-center gap-2 text-sm text-ink-600"><input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="rounded border-border-custom" /> Active</label>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Benefit" message="Are you sure you want to delete this benefit?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Benefit Details">
        {ps.viewingId && (() => { const b = data.find(i => i.id === ps.viewingId); if (!b) return null; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{b.name}</p></div>
              <div><p className="text-ink-400 text-xs">Type</p><p className="font-medium text-ink-900 capitalize">{b.type}</p></div>
              <div><p className="text-ink-400 text-xs">Provider</p><p className="font-medium text-ink-900">{b.provider || '-'}</p></div>
              <div><p className="text-ink-400 text-xs">Status</p><p className="font-medium capitalize">{b.isActive ? 'Active' : 'Inactive'}</p></div>
              <div><p className="text-ink-400 text-xs">Employer Cost</p><p className="font-semibold text-ink-900">{fmt(b.costEmployer)}</p></div>
              <div><p className="text-ink-400 text-xs">Employee Cost</p><p className="font-semibold text-ink-900">{fmt(b.costEmployee)}</p></div>
              {b.description && <div className="col-span-2"><p className="text-ink-400 text-xs">Description</p><p className="font-medium text-ink-900">{b.description}</p></div>}
            </div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

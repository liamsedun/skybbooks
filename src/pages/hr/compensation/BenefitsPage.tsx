import { useMemo } from 'react';
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

interface BenefitItem {
  id: string;
  name: string;
  type: string;
  provider: string;
  employeeCount: number;
  cost: number;
  status: string;
}

const MOCK: BenefitItem[] = [
  { id: '1', name: 'Health Insurance Platinum', type: 'health', provider: 'AXA Mansard', employeeCount: 45, cost: 12000000, status: 'active' },
  { id: '2', name: 'Pension Fund', type: 'pension', provider: 'Leadway Pensure', employeeCount: 60, cost: 24000000, status: 'active' },
  { id: '3', name: 'Life Insurance', type: 'insurance', provider: 'AIICO Insurance', employeeCount: 60, cost: 3600000, status: 'active' },
  { id: '4', name: 'Gym Membership', type: 'perks', provider: 'FitLife Centers', employeeCount: 25, cost: 1800000, status: 'active' },
  { id: '5', name: 'Dental Coverage', type: 'health', provider: 'ClinicPlus', employeeCount: 30, cost: 2400000, status: 'inactive' },
  { id: '6', name: 'Transport Allowance', type: 'perks', provider: 'In-House', employeeCount: 50, cost: 6000000, status: 'active' },
  { id: '7', name: 'Group Life Insurance', type: 'insurance', provider: 'Leadway Assurance', employeeCount: 60, cost: 4800000, status: 'active' },
  { id: '8', name: 'Meal Voucher', type: 'perks', provider: 'EdenMeals', employeeCount: 40, cost: 1200000, status: 'draft' },
];

function fmt(n: number) { return 'Ã¢â€šÂ¦' + n.toLocaleString(); }

export function BenefitsPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'name', searchKeys: ['name', 'type', 'provider'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Benefits', value: MOCK.length, icon: <Gift className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Health', value: MOCK.filter(i => i.type === 'health').length, icon: <HeartPulse className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'health', onClick: () => ps.setStatusFilter('health') },
    { label: 'Pension', value: MOCK.filter(i => i.type === 'pension').length, icon: <Shield className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'pension', onClick: () => ps.setStatusFilter('pension') },
    { label: 'Insurance', value: MOCK.filter(i => i.type === 'insurance').length, icon: <ShieldCheck className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'insurance', onClick: () => ps.setStatusFilter('insurance') },
  ], [ps.statusFilter]);

  const columns: Column<BenefitItem>[] = [
    { key: 'name', label: 'Benefit', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.type === 'health' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : i.type === 'pension' ? 'bg-purple-50 text-purple-700 border-purple-200' : i.type === 'insurance' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-700 border-cyan-200'}`}>{i.type}</span> },
    { key: 'provider', label: 'Provider', render: (i) => <span className="text-ink-500">{i.provider}</span> },
    { key: 'employeeCount', label: 'Enrolled', render: (i) => <span className="text-ink-600">{i.employeeCount}</span> },
    { key: 'cost', label: 'Annual Cost', render: (i) => <span className="font-medium text-ink-900">{fmt(i.cost)}</span> },
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
    <HrPageShell title="Benefits" description="Manage employee benefits and enrollments"
      pageKey="benefits"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Benefit', 'Type', 'Provider', 'Enrolled', 'Annual Cost', 'Status'], MOCK.map(b => [b.name, b.type, b.provider, String(b.employeeCount), String(b.cost), b.status]), 'benefits'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Benefits', ['Benefit', 'Type', 'Provider', 'Annual Cost', 'Status'], MOCK.map(b => [b.name, b.type, b.provider, fmt(b.cost), b.status]), 'benefits')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Benefit</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search benefits..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No benefits" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add your first benefit</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Benefit' : 'Add Benefit'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>health</option><option>pension</option><option>insurance</option><option>perks</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Provider</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Annual Cost (Ã¢â€šÂ¦)</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete Benefit" message="Are you sure?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Benefit Details">
        {ps.viewingId && (() => { const b = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Name</p><p className="font-medium text-ink-900">{b.name}</p></div><div><p className="text-ink-400 text-xs">Type</p><p className="font-medium text-ink-900 capitalize">{b.type}</p></div><div><p className="text-ink-400 text-xs">Provider</p><p className="font-medium text-ink-900">{b.provider}</p></div><div><p className="text-ink-400 text-xs">Enrolled</p><p className="font-medium text-ink-900">{b.employeeCount}</p></div><div><p className="text-ink-400 text-xs">Annual Cost</p><p className="font-semibold text-ink-900">{fmt(b.cost)}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{b.status}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


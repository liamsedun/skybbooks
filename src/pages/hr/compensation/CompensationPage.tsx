import { useMemo } from 'react';
import { DollarSign, Wallet, Award, Percent, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface CompensationItem {
  id: string;
  employeeName: string;
  type: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  status: string;
}

const MOCK: CompensationItem[] = [
  { id: '1', employeeName: 'Alice Johnson', type: 'salary', amount: 5000000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '2', employeeName: 'Bob Smith', type: 'salary', amount: 3500000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '3', employeeName: 'Carol White', type: 'bonus', amount: 500000, currency: 'NGN', effectiveDate: '2026-06-15', status: 'active' },
  { id: '4', employeeName: 'David Brown', type: 'allowance', amount: 200000, currency: 'NGN', effectiveDate: '2026-03-01', status: 'active' },
  { id: '5', employeeName: 'Eve Davis', type: 'commission', amount: 350000, currency: 'NGN', effectiveDate: '2026-07-01', status: 'active' },
  { id: '6', employeeName: 'Frank Miller', type: 'salary', amount: 4200000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '7', employeeName: 'Grace Wilson', type: 'bonus', amount: 300000, currency: 'NGN', effectiveDate: '2026-06-30', status: 'inactive' },
  { id: '8', employeeName: 'Hank Moore', type: 'allowance', amount: 150000, currency: 'NGN', effectiveDate: '2026-04-01', status: 'active' },
  { id: '9', employeeName: 'Ivy Taylor', type: 'salary', amount: 2800000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '10', employeeName: 'Jack Anderson', type: 'commission', amount: 450000, currency: 'NGN', effectiveDate: '2026-07-15', status: 'active' },
];

function fmt(n: number) { return 'Ã¢â€šÂ¦' + n.toLocaleString(); }

export function CompensationPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'type'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Records', value: MOCK.length, icon: <DollarSign className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Salary', value: MOCK.filter(i => i.type === 'salary').length, icon: <Wallet className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'salary', onClick: () => ps.setStatusFilter('salary') },
    { label: 'Bonus', value: MOCK.filter(i => i.type === 'bonus').length, icon: <Award className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'bonus', onClick: () => ps.setStatusFilter('bonus') },
    { label: 'Allowance', value: MOCK.filter(i => i.type === 'allowance').length, icon: <Percent className="w-4 h-4" />, color: 'purple' as const, active: ps.statusFilter === 'allowance', onClick: () => ps.setStatusFilter('allowance') },
  ], [ps.statusFilter]);

  const columns: Column<CompensationItem>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.type === 'salary' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : i.type === 'bonus' ? 'bg-amber-50 text-amber-700 border-amber-200' : i.type === 'commission' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{i.type}</span> },
    { key: 'amount', label: 'Amount', render: (i) => <span className="font-medium text-ink-900">{fmt(i.amount)}</span> },
    { key: 'effectiveDate', label: 'Effective Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.effectiveDate)}</span> },
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
    <HrPageShell title="Compensation" description="Manage salary bands and employee compensation"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee', 'Type', 'Amount', 'Currency', 'Effective Date', 'Status'], MOCK.map(c => [c.employeeName, c.type, String(c.amount), c.currency, c.effectiveDate, c.status]), 'compensation'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Compensation', ['Employee', 'Type', 'Amount', 'Status'], MOCK.map(c => [c.employeeName, c.type, fmt(c.amount), c.status]), 'compensation')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Compensation</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee or type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Salary', value: 'salary' }, { label: 'Bonus', value: 'bonus' }, { label: 'Commission', value: 'commission' }, { label: 'Allowance', value: 'allowance' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No compensation records" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add compensation</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Compensation' : 'Add Compensation'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>salary</option><option>bonus</option><option>commission</option><option>allowance</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Amount (Ã¢â€šÂ¦)</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete" message="Are you sure?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Compensation Details">
        {ps.viewingId && (() => { const c = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Employee</p><p className="font-medium text-ink-900">{c.employeeName}</p></div><div><p className="text-ink-400 text-xs">Type</p><p className="font-medium text-ink-900 capitalize">{c.type}</p></div><div><p className="text-ink-400 text-xs">Amount</p><p className="font-semibold text-ink-900">{fmt(c.amount)}</p></div><div><p className="text-ink-400 text-xs">Currency</p><p className="font-medium text-ink-900">{c.currency}</p></div><div><p className="text-ink-400 text-xs">Effective Date</p><p className="font-medium text-ink-900">{formatDate(c.effectiveDate)}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{c.status}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


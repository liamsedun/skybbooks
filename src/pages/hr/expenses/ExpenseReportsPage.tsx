import { useEffect, useMemo, useState } from 'react';
import { Receipt, ShoppingBag, Car, Utensils, Plane, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface ExpenseReport {
  id: string; employeeName: string; category: string;
  amount: number; submittedDate: string; status: string;
}

const categoryIcon = (cat: string) => {
  switch (cat) {
    case 'Travel': return <Plane className="w-3.5 h-3.5 text-blue-500" />;
    case 'Meals': return <Utensils className="w-3.5 h-3.5 text-amber-500" />;
    case 'Transportation': return <Car className="w-3.5 h-3.5 text-emerald-500" />;
    case 'Office Supplies': return <ShoppingBag className="w-3.5 h-3.5 text-purple-500" />;
    default: return <Receipt className="w-3.5 h-3.5 text-ink-500" />;
  }
};

const fmtAmount = (n: number) => `₦${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function ExpenseReportsPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'category'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getExpenseReports({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Receipt className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Approved', value: data.filter(i => i.status === 'approved').length, icon: <ShoppingBag className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: data.filter(i => i.status === 'pending').length, icon: <Car className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <Utensils className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [data, ps.statusFilter]);
  const columns: Column<ExpenseReport>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'category', label: 'Category', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-1.5">
        {categoryIcon(i.category)}
        <span className="text-xs font-medium text-ink-600">{i.category}</span>
      </span>
    )},
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{fmtAmount(i.amount)}</span> },
    { key: 'submittedDate', label: 'Submitted', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.submittedDate)}</span> },
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
    <HrPageShell title="Expense Reports" description="Manage employee expense claims"
      pageKey="expenses"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Category','Amount','Submitted','Status'], ps.filtered.map(i => [i.employeeName,i.category,String(i.amount),i.submittedDate,i.status]), 'expenses'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Expense Reports', ['Employee','Category','Amount','Submitted','Status'], ps.filtered.map(i => [i.employeeName,i.category,String(i.amount),i.submittedDate,i.status]), 'expenses')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search expense reports..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Draft', value: 'draft' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No expense reports" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Expense' : 'Add Expense'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Alice Johnson" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Category</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Travel</option><option>Meals</option><option>Office Supplies</option><option>Transportation</option><option>Accommodation</option><option>Equipment</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Amount (NGN)</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 450000" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option value="draft">Draft</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete Expense" message="Are you sure you want to delete this expense report?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Expense Details">
        {ps.viewingId && (() => { const e = data.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center"><Receipt className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{e.employeeName}</p><p className="text-xs text-ink-400">{e.category} � {formatDate(e.submittedDate)}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Category</p><p className="text-sm text-ink-700 mt-1 flex items-center gap-1">{categoryIcon(e.category)}{e.category}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Amount</p><p className="text-sm font-semibold text-ink-900 mt-1">{'?'}{(e.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(e.status)}`}>{e.status}</span></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}




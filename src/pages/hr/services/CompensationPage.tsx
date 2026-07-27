import { useMemo } from 'react';
import { DollarSign, Wallet, Gift, BadgePercent, Plus, Download, FileText, Upload, Edit3, Trash2, Eye, CheckCircle2 } from 'lucide-react';
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

interface CompensationRecord {
  id: string;
  employeeName: string;
  type: 'salary' | 'bonus' | 'commission' | 'allowance';
  amount: number;
  currency: string;
  effectiveDate: string;
  status: 'active' | 'inactive';
}

const MOCK: CompensationRecord[] = [
  { id: '1', employeeName: 'Alice Johnson', type: 'salary', amount: 6000000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '2', employeeName: 'Bob Williams', type: 'salary', amount: 4200000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '3', employeeName: 'Carol Davis', type: 'bonus', amount: 500000, currency: 'NGN', effectiveDate: '2026-03-15', status: 'active' },
  { id: '4', employeeName: 'Daniel Miller', type: 'allowance', amount: 150000, currency: 'NGN', effectiveDate: '2026-02-01', status: 'active' },
  { id: '5', employeeName: 'Eve Wilson', type: 'salary', amount: 3500000, currency: 'NGN', effectiveDate: '2026-01-01', status: 'active' },
  { id: '6', employeeName: 'Frank Moore', type: 'commission', amount: 750000, currency: 'NGN', effectiveDate: '2026-04-01', status: 'active' },
  { id: '7', employeeName: 'Grace Anderson', type: 'bonus', amount: 300000, currency: 'NGN', effectiveDate: '2026-02-28', status: 'inactive' },
  { id: '8', employeeName: 'Henry Thomas', type: 'allowance', amount: 200000, currency: 'NGN', effectiveDate: '2026-03-01', status: 'active' },
];

function TypeIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    salary: { icon: <Wallet className="w-4 h-4" />, color: 'text-blue-500' },
    bonus: { icon: <Gift className="w-4 h-4" />, color: 'text-emerald-500' },
    commission: { icon: <BadgePercent className="w-4 h-4" />, color: 'text-purple-500' },
    allowance: { icon: <DollarSign className="w-4 h-4" />, color: 'text-amber-500' },
  };
  const m = map[type] || { icon: <DollarSign className="w-4 h-4" />, color: 'text-ink-400' };
  return <span className={m.color}>{m.icon}</span>;
}

export function CompensationPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'type'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: MOCK.length, icon: <DollarSign className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Salary', value: MOCK.filter(i => i.type === 'salary').length, icon: <Wallet className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'salary', onClick: () => ps.setStatusFilter('salary') },
    { label: 'Bonus', value: MOCK.filter(i => i.type === 'bonus').length, icon: <Gift className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'bonus', onClick: () => ps.setStatusFilter('bonus') },
    { label: 'Allowance', value: MOCK.filter(i => i.type === 'allowance').length, icon: <BadgePercent className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'allowance', onClick: () => ps.setStatusFilter('allowance') },
  ], [ps.statusFilter]);

  const columns: Column<CompensationRecord>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="inline-flex items-center gap-1.5 text-ink-600 capitalize"><TypeIcon type={i.type} />{i.type}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => <span className="text-ink-600 font-medium tabular-nums">{i.currency === 'NGN' ? 'â‚¦' : '$'}{i.amount.toLocaleString()}</span> },
    { key: 'currency', label: 'Currency', render: (i) => <span className="text-ink-600">{i.currency}</span> },
    { key: 'effectiveDate', label: 'Effective Date', sortable: true, render: (i) => <span className="text-ink-600">{formatDate(i.effectiveDate)}</span> },
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
    <HrPageShell title="Compensation" description="Salary structures, bonuses, benefits administration, and compensation planning"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee', 'Type', 'Amount', 'Currency', 'Effective Date', 'Status'], ps.filtered.map(i => [i.employeeName, i.type, String(i.amount), i.currency, i.effectiveDate, i.status]), 'compensation'); showSuccess('CSV exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Compensation Records', ['Employee', 'Type', 'Amount', 'Currency', 'Effective Date', 'Status'], ps.filtered.map(i => [i.employeeName, i.type, String(i.amount), i.currency, i.effectiveDate, i.status]), 'compensation')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => ps.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Record</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee or type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Salary', value: 'salary' }, { label: 'Bonus', value: 'bonus' }, { label: 'Commission', value: 'commission' }, { label: 'Allowance', value: 'allowance' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {ps.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{ps.selectedIds.length} selected</span>
          <button onClick={() => { showSuccess('Selected records deleted'); ps.setSelectedIds([]); }} className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No compensation records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Record' : 'Add Compensation Record'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Record updated' : 'Record created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>salary</option><option>bonus</option><option>commission</option><option>allowance</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Amount</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Currency</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>NGN</option><option>USD</option><option>EUR</option><option>GBP</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Effective Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Record deleted'); ps.closeConfirmDelete(); }} title="Delete Record" message="Are you sure you want to delete this compensation record? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Compensation Details">
        {ps.viewingId && (() => {
          const item = MOCK.find(i => i.id === ps.viewingId);
          if (!item) return null;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Employee</span><span className="font-medium text-ink-900">{item.employeeName}</span></div>
                <div><span className="text-ink-400 text-xs block">Type</span><span className="inline-flex items-center gap-1.5 font-medium text-ink-900 capitalize"><TypeIcon type={item.type} />{item.type}</span></div>
                <div><span className="text-ink-400 text-xs block">Amount</span><span className="font-medium text-ink-900">{item.currency === 'NGN' ? 'â‚¦' : '$'}{item.amount.toLocaleString()}</span></div>
                <div><span className="text-ink-400 text-xs block">Currency</span><span className="font-medium text-ink-900">{item.currency}</span></div>
                <div><span className="text-ink-400 text-xs block">Effective Date</span><span className="font-medium text-ink-900">{formatDate(item.effectiveDate)}</span></div>
                <div className="col-span-2"><span className="text-ink-400 text-xs block">Status</span><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span></div>
              </div>
            </div>
          );
        })()}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Compensation" onSubmit={(e) => { e.preventDefault(); showSuccess('Records imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file to import compensation records.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}



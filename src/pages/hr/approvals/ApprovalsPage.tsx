import { useMemo } from 'react';
import { CheckCircle, XCircle, Clock, Plus, Download, FileText, Check, X, Edit3, Trash2, Eye } from 'lucide-react';
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

interface ApprovalItem {
  id: string;
  type: string;
  requester: string;
  date: string;
  amount: number;
  status: string;
}

const MOCK: ApprovalItem[] = [
  { id: 'A001', type: 'Leave Request', requester: 'Alice Johnson', date: '2026-07-25', amount: 0, status: 'pending' },
  { id: 'A002', type: 'Travel Request', requester: 'Bob Smith', date: '2026-07-24', amount: 250000, status: 'pending' },
  { id: 'A003', type: 'Expense Report', requester: 'Carol White', date: '2026-07-23', amount: 85000, status: 'approved' },
  { id: 'A004', type: 'Compensatory Off', requester: 'David Brown', date: '2026-07-22', amount: 0, status: 'rejected' },
  { id: 'A005', type: 'Leave Request', requester: 'Eve Davis', date: '2026-07-21', amount: 0, status: 'pending' },
  { id: 'A006', type: 'Purchase Request', requester: 'Frank Miller', date: '2026-07-20', amount: 500000, status: 'pending' },
  { id: 'A007', type: 'Expense Report', requester: 'Grace Wilson', date: '2026-07-19', amount: 120000, status: 'approved' },
  { id: 'A008', type: 'Leave Request', requester: 'Hank Moore', date: '2026-07-18', amount: 0, status: 'pending' },
  { id: 'A009', type: 'Travel Request', requester: 'Ivy Taylor', date: '2026-07-17', amount: 180000, status: 'rejected' },
  { id: 'A010', type: 'Expense Report', requester: 'Jack Anderson', date: '2026-07-16', amount: 45000, status: 'pending' },
];

function fmt(n: number) { return n ? 'Ã¢â€šÂ¦' + n.toLocaleString() : 'Ã¢â‚¬â€'; }

export function ApprovalsPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'date', searchKeys: ['requester', 'type'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Requests', value: MOCK.length, icon: <Clock className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: MOCK.filter(i => i.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: MOCK.filter(i => i.status === 'approved').length, icon: <CheckCircle className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: MOCK.filter(i => i.status === 'rejected').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [ps.statusFilter]);

  const columns: Column<ApprovalItem>[] = [
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.type}</span> },
    { key: 'requester', label: 'Requester', sortable: true, render: (i) => <span className="text-ink-600">{i.requester}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
    { key: 'amount', label: 'Amount', render: (i) => <span className="text-ink-900 font-medium">{fmt(i.amount)}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        {i.status === 'pending' && (<>
          <button onClick={() => showSuccess(`${i.type} approved`)} className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => showSuccess(`${i.type} rejected`)} className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Reject"><X className="w-3.5 h-3.5" /></button>
        </>)}
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Approvals" description="Pending approval requests"
      pageKey="approvals"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Type', 'Requester', 'Date', 'Amount', 'Status'], MOCK.map(a => [a.type, a.requester, a.date, String(a.amount), a.status]), 'approvals'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Approvals', ['Type', 'Requester', 'Date', 'Amount', 'Status'], MOCK.map(a => [a.type, a.requester, a.date, String(a.amount), a.status]), 'approvals')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> New Request</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by requester or type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No approval requests" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Create a request</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Request' : 'New Request'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Updated' : 'Created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Type</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>Leave Request</option><option>Travel Request</option><option>Expense Report</option><option>Compensatory Off</option><option>Purchase Request</option></select></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Amount (Ã¢â€šÂ¦)</label><input type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Deleted'); ps.closeConfirmDelete(); }} title="Delete" message="Are you sure?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Approval Details">
        {ps.viewingId && (() => { const a = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Type</p><p className="font-medium text-ink-900">{a.type}</p></div><div><p className="text-ink-400 text-xs">Requester</p><p className="font-medium text-ink-900">{a.requester}</p></div><div><p className="text-ink-400 text-xs">Date</p><p className="font-medium text-ink-900">{formatDate(a.date)}</p></div><div><p className="text-ink-400 text-xs">Amount</p><p className="font-medium text-ink-900">{fmt(a.amount)}</p></div><div><p className="text-ink-400 text-xs">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(a.status)}`}>{a.status}</span></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}


import { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
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

interface ApprovalItem { id: string; type: string; requester: string; date: string; amount: string; status: string; }
const MOCK: ApprovalItem[] = [
  { id: 'AP1', type: 'Leave Request', requester: 'Chioma Okafor', date: '2026-07-27', amount: '--', status: 'pending' },
  { id: 'AP2', type: 'Travel Request', requester: 'Segun Adebayo', date: '2026-07-26', amount: 'â‚¦1,200,000', status: 'pending' },
  { id: 'AP3', type: 'Expense Report', requester: 'Amina Bello', date: '2026-07-25', amount: 'â‚¦85,000', status: 'pending' },
  { id: 'AP4', type: 'Leave Request', requester: 'Tunde Bakare', date: '2026-07-27', amount: '--', status: 'approved' },
  { id: 'AP5', type: 'Purchase Request', requester: 'Ngozi Eze', date: '2026-07-24', amount: 'â‚¦450,000', status: 'pending' },
  { id: 'AP6', type: 'Overtime Approval', requester: 'Femi Ogunlade', date: '2026-07-26', amount: 'â‚¦32,000', status: 'pending' },
  { id: 'AP7', type: 'Travel Request', requester: 'Zainab Abdullah', date: '2026-07-23', amount: 'â‚¦980,000', status: 'rejected' },
  { id: 'AP8', type: 'Leave Request', requester: 'Chinedu Okonkwo', date: '2026-07-27', amount: '--', status: 'pending' },
  { id: 'AP9', type: 'Expense Report', requester: 'Yemi Lawson', date: '2026-07-22', amount: 'â‚¦120,000', status: 'approved' },
  { id: 'AP10', type: 'Purchase Request', requester: 'Adaeze Obi', date: '2026-07-21', amount: 'â‚¦250,000', status: 'pending' },
];

export function OpsApprovalsPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'requester', searchKeys: ['type', 'requester'], pageSize: 10 });
  const stats = useMemo(() => [
    { label: 'Total Requests', value: ps.filtered.length.toString(), icon: <ShieldCheck className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: ps.filtered.filter(i => i.status === 'pending').length.toString(), icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: ps.filtered.filter(i => i.status === 'approved').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: ps.filtered.filter(i => i.status === 'rejected').length.toString(), icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [ps.filtered]);
  const columns: Column<ApprovalItem>[] = [
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.type}</span> },
    { key: 'requester', label: 'Requester', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.date)}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => i.amount !== '--' ? <span className="font-semibold text-ink-900">{i.amount}</span> : <span className="text-ink-300">--</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        {i.status === 'pending' && (<><button onClick={() => { showSuccess('Request approved'); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Approve"><Check className="w-3.5 h-3.5" /></button><button onClick={() => { showSuccess('Request rejected'); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Reject"><X className="w-3.5 h-3.5" /></button></>)}
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="Approvals" description="Pending and historical approval requests across all HR workflows."
      pageKey="approvals"
      headerActions={<><button onClick={() => exportToCsv(ps.filtered, 'approvals.csv')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search approvals..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No approvals found" />
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Request deleted'); ps.closeConfirmDelete(); }} title="Delete Request" message="Are you sure you want to delete this approval request?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Approval Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
    </HrPageShell>
  );
}



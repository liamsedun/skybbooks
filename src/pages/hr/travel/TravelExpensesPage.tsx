import { useState, useEffect, useMemo } from 'react';
import { Receipt, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, Link } from 'lucide-react';
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
  id: string; employeeId: string; title: string; description: string;
  totalAmount: number; currency: string; status: string;
  travelRequestId: string | null; approvedBy: string | null;
  approvedAt: string | null; reimbursedAt: string | null; createdAt: string;
}

function fmtAmount(n: number) {
  return '₦' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function mapExpense(raw: any): ExpenseReport {
  return {
    id: raw.id,
    employeeId: raw.employeeId || '',
    title: raw.title || '',
    description: raw.description || '',
    totalAmount: raw.totalAmount ?? 0,
    currency: raw.currency || 'NGN',
    status: raw.status || 'draft',
    travelRequestId: raw.travelRequestId || null,
    approvedBy: raw.approvedBy || null,
    approvedAt: raw.approvedAt || null,
    reimbursedAt: raw.reimbursedAt || null,
    createdAt: raw.createdAt || '',
  };
}

export function TravelExpensesPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getTravelExpenses();
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setData(items.map(mapExpense));
    } catch {
      showError('Failed to load travel expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'createdAt', searchKeys: ['title', 'employeeId', 'status'], pageSize: 10 });

  const statusCounts = useMemo(() => ({
    all: data.length,
    draft: data.filter(i => i.status === 'draft').length,
    submitted: data.filter(i => i.status === 'submitted').length,
    approved: data.filter(i => i.status === 'approved').length,
    reimbursed: data.filter(i => i.status === 'reimbursed').length,
  }), [data]);

  const stats = useMemo(() => [
    { label: 'Total', value: statusCounts.all, icon: <Receipt className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Draft', value: statusCounts.draft, icon: <Receipt className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
    { label: 'Submitted', value: statusCounts.submitted, icon: <Receipt className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'submitted', onClick: () => ps.setStatusFilter('submitted') },
    { label: 'Approved', value: statusCounts.approved, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Reimbursed', value: statusCounts.reimbursed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'reimbursed', onClick: () => ps.setStatusFilter('reimbursed') },
  ], [statusCounts, ps.statusFilter]);

  const columns: Column<ExpenseReport>[] = [
    { key: 'title', label: 'Title', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.title || 'Untitled'}</span> },
    { key: 'employeeId', label: 'Employee', sortable: true, render: (i) => <span className="text-ink-600">{i.employeeId || '—'}</span> },
    { key: 'totalAmount', label: 'Total Amount', sortable: true, render: (i) => <span className="font-semibold text-ink-700 tabular-nums">{fmtAmount(i.totalAmount)}</span> },
    { key: 'status', label: 'Status', render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span>
    )},
    { key: 'travelRequestId', label: 'Travel Request', render: (i) => (
      <span className="text-ink-500 text-xs">{i.travelRequestId || '—'}</span>
    )},
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        {!i.travelRequestId && (
          <button onClick={async () => {
            const travelRequestId = prompt('Enter Travel Request ID to link:');
            if (!travelRequestId?.trim()) return;
            try {
              await hrApi.linkExpenseToTravel(i.id, travelRequestId.trim());
              showSuccess('Linked to travel request');
              await fetchData();
            } catch { showError('Failed to link'); }
          }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="Link to Travel"><Link className="w-3.5 h-3.5" /></button>
        )}
      </div>
    ), className: 'text-right' },
  ];

  const viewingExpense = ps.viewingId ? data.find(i => i.id === ps.viewingId) : null;

  if (loading) {
    return (
      <HrPageShell title="Travel Expenses" description="Manage expense reports linked to travel requests" pageKey="travel">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title="Travel Expenses" description="Manage expense reports linked to travel requests"
      pageKey="travel"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Title','Employee','Total Amount','Currency','Status','Travel Request','Created'], ps.filtered.map(i => [i.title || 'Untitled', i.employeeId || '', String(i.totalAmount), i.currency, i.status, i.travelRequestId || '', i.createdAt]), 'travel-expenses'); showSuccess('Exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Travel Expenses', ['Title','Employee','Total Amount','Currency','Status','Travel Request','Created'], ps.filtered.map(i => [i.title || 'Untitled', i.employeeId || '', fmtAmount(i.totalAmount), i.currency, i.status, i.travelRequestId || '', formatDate(i.createdAt)]), 'travel-expenses')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
        </>
      }>
      <HrStatCards items={stats} columns={5} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by title, employee, status..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Draft', value: 'draft' },
          { label: 'Submitted', value: 'submitted' },
          { label: 'Approved', value: 'approved' },
          { label: 'Reimbursed', value: 'reimbursed' },
          { label: 'Declined', value: 'declined' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel expenses found" emptyAction={null} />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Expense Report Details">
        {viewingExpense && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><Receipt className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900">{viewingExpense.title || 'Untitled'}</p><p className="text-xs text-ink-400">{viewingExpense.employeeId} · {viewingExpense.status}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Total Amount</p><p className="text-sm font-bold text-ink-900 mt-1">{fmtAmount(viewingExpense.totalAmount)}</p></div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Currency</p><p className="text-sm text-ink-700 mt-1">{viewingExpense.currency}</p></div>
            </div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingExpense.status)}`}>{viewingExpense.status}</span></div>
            {viewingExpense.travelRequestId && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Linked Travel Request</p><p className="text-sm font-medium text-primary mt-1">{viewingExpense.travelRequestId}</p></div>
            )}
            {viewingExpense.description && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Description</p><p className="text-sm text-ink-700">{viewingExpense.description}</p></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Created</p><p className="text-sm text-ink-700 mt-1">{formatDate(viewingExpense.createdAt) || '—'}</p></div>
              {viewingExpense.approvedAt && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved At</p><p className="text-sm text-ink-700 mt-1">{formatDate(viewingExpense.approvedAt)}</p></div>}
            </div>
            {viewingExpense.approvedBy && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved By</p><p className="text-sm text-ink-700 mt-1">{viewingExpense.approvedBy}</p></div>
            )}
            {viewingExpense.reimbursedAt && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Reimbursed At</p><p className="text-sm text-ink-700 mt-1">{formatDate(viewingExpense.reimbursedAt)}</p></div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}
import { useState, useEffect, useMemo } from 'react';
import { Wallet, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
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

interface SalaryReview {
  id: string; employeeId: string; previousSalary: number; newSalary: number;
  currency: string; reason: string; reviewType: string; approvedBy: string | null;
  status: string; effectiveDate: string; createdAt: string;
}

const reviewTypeOptions = [
  { label: 'Annual', value: 'annual' },
  { label: 'Promotion', value: 'promotion' },
  { label: 'Merit', value: 'merit' },
  { label: 'Adjustment', value: 'adjustment' },
];

function fmtSalary(n: number, currency: string) {
  const prefix = currency === 'NGN' ? '₦' : '$';
  return prefix + (n ?? 0).toLocaleString();
}

function mapSalaryReview(raw: any): SalaryReview {
  return {
    id: raw.id,
    employeeId: raw.employeeId || '',
    previousSalary: raw.previousSalary ?? 0,
    newSalary: raw.newSalary ?? 0,
    currency: raw.currency || 'NGN',
    reason: raw.reason || '',
    reviewType: raw.reviewType || 'annual',
    approvedBy: raw.approvedBy || null,
    status: raw.status || 'pending',
    effectiveDate: raw.effectiveDate || '',
    createdAt: raw.createdAt || '',
  };
}

const reviewTypeColors: Record<string, string> = {
  annual: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  promotion: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800',
  merit: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  adjustment: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
};

export function SalaryReviewsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SalaryReview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getSalaryReviews({ pageSize: 500 });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      setData(items.map(mapSalaryReview));
    } catch {
      toast('Failed to load salary reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data, initialSortKey: 'effectiveDate', searchKeys: ['employeeId', 'reviewType', 'status'], pageSize: 10 });

  const statusCounts = useMemo(() => ({
    all: data.length,
    pending: data.filter(i => i.status === 'pending').length,
    approved: data.filter(i => i.status === 'approved').length,
    rejected: data.filter(i => i.status === 'rejected').length,
  }), [data]);

  const stats = useMemo(() => [
    { label: 'Total', value: statusCounts.all, icon: <Wallet className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: statusCounts.pending, icon: <Wallet className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: statusCounts.approved, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: statusCounts.rejected, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [statusCounts, ps.statusFilter]);

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'all') return data;
    return data.filter(i => i.status === ps.statusFilter);
  }, [data, ps.statusFilter]);

  const columns: Column<SalaryReview>[] = [
    { key: 'employeeId', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeId || 'Employee'}</span> },
    { key: 'previousSalary', label: 'Previous Salary', sortable: true, render: (i) => <span className="text-ink-600 tabular-nums">{fmtSalary(i.previousSalary, i.currency)}</span> },
    { key: 'newSalary', label: 'New Salary', sortable: true, render: (i) => <span className="font-medium text-ink-900 tabular-nums">{fmtSalary(i.newSalary, i.currency)}</span> },
    { key: 'difference', label: 'Difference', sortable: false, render: (i) => {
      const diff = i.newSalary - i.previousSalary;
      const cls = diff >= 0 ? 'text-emerald-600' : 'text-rose-600';
      return <span className={`font-medium tabular-nums ${cls}`}>{diff >= 0 ? '+' : ''}{fmtSalary(diff, i.currency)}</span>;
    }},
    { key: 'currency', label: 'Currency', sortable: true },
    { key: 'reviewType', label: 'Type', sortable: true, render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${reviewTypeColors[i.reviewType] || reviewTypeColors.annual}`}>{i.reviewType}</span>
    )},
    { key: 'status', label: 'Status', render: (i) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span>
    )},
    { key: 'effectiveDate', label: 'Effective Date', sortable: true, render: (i) => (
      <span className="text-ink-600">{formatDate(i.effectiveDate)}</span>
    )},
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        {i.status === 'pending' && (
          <>
            <button onClick={async () => { try { await hrApi.approveSalaryReview(i.id); toast('Salary review approved', 'success'); await fetchData(); } catch { toast('Failed to approve', 'error'); } }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>
            <button onClick={async () => { try { await hrApi.rejectSalaryReview(i.id); toast('Salary review rejected', 'success'); await fetchData(); } catch { toast('Failed to reject', 'error'); } }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Reject"><XCircle className="w-3.5 h-3.5" /></button>
          </>
        )}
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const employeeId = fd.get('employeeId') as string;
    const previousSalary = Number(fd.get('previousSalary'));
    const newSalary = Number(fd.get('newSalary'));
    const currency = fd.get('currency') as string;
    const reason = fd.get('reason') as string;
    const reviewType = fd.get('reviewType') as string;
    const effectiveDate = fd.get('effectiveDate') as string;
    if (!employeeId?.trim()) { toast('Employee ID is required', 'error'); return; }
    if (!previousSalary || previousSalary < 0) { toast('Previous salary is required', 'error'); return; }
    if (!newSalary || newSalary < 0) { toast('New salary is required', 'error'); return; }
    const payload = { employeeId: employeeId.trim(), previousSalary, newSalary, currency: currency || 'NGN', reason: reason?.trim() || '', reviewType, effectiveDate: effectiveDate || null };
    try {
      await hrApi.createSalaryReview(payload);
      toast('Salary review created', 'success');
      ps.closeModal();
      await fetchData();
    } catch {
      toast('Failed to create salary review', 'error');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteSalaryReview(ps.deletingId);
      toast('Salary review deleted', 'success');
      ps.closeConfirmDelete();
      await fetchData();
    } catch {
      toast('Failed to delete salary review', 'error');
    }
  };

  const viewingReview = ps.viewingId ? data.find(i => i.id === ps.viewingId) : null;

  if (loading) {
    return (
      <HrPageShell title="Salary Reviews" description="Manage salary review requests and approvals" pageKey="compensation">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title="Salary Reviews" description="Manage salary review requests and approvals"
      pageKey="compensation"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Previous Salary','New Salary','Difference','Currency','Type','Status','Effective Date','Reason'], ps.filtered.map(i => [i.employeeId || 'Employee',String(i.previousSalary),String(i.newSalary),String(i.newSalary - i.previousSalary),i.currency,i.reviewType,i.status,i.effectiveDate,i.reason]), 'salary-reviews'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Salary Reviews', ['Employee','Previous Salary','New Salary','Difference','Currency','Type','Status','Effective Date','Reason'], ps.filtered.map(i => [i.employeeId || 'Employee',fmtSalary(i.previousSalary,i.currency),fmtSalary(i.newSalary,i.currency),fmtSalary(i.newSalary - i.previousSalary,i.currency),i.currency,i.reviewType,i.status,formatDate(i.effectiveDate),i.reason]), 'salary-reviews')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Salary Review</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee ID, type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No salary reviews" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add your first review</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title="Add Salary Review" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label><input name="employeeId" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. emp-001" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Review Type</label><select name="reviewType" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">{reviewTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Previous Salary</label><input name="previousSalary" type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 3000000" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">New Salary</label><input name="newSalary" type="number" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 3600000" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Currency</label><input name="currency" defaultValue="NGN" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="NGN" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Effective Date</label><input name="effectiveDate" type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        </div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Reason</label><textarea name="reason" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Reason for the salary review..." /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Salary Review" message="Are you sure you want to delete this salary review?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Salary Review Details">
        {viewingReview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
              <div><p className="text-sm font-semibold text-ink-900 capitalize">{viewingReview.reviewType} Review</p><p className="text-xs text-ink-400">{viewingReview.employeeId} · {viewingReview.status}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Previous Salary</p><p className="text-sm font-bold text-ink-900 mt-1">{fmtSalary(viewingReview.previousSalary, viewingReview.currency)}</p></div>
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">New Salary</p><p className="text-sm font-bold text-ink-900 mt-1">{fmtSalary(viewingReview.newSalary, viewingReview.currency)}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Difference</p><p className="text-sm font-bold text-ink-900 mt-1">{fmtSalary(viewingReview.newSalary - viewingReview.previousSalary, viewingReview.currency)}</p></div>
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Currency</p><p className="text-sm text-ink-700 mt-1">{viewingReview.currency}</p></div>
            </div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingReview.status)}`}>{viewingReview.status}</span></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employee ID</p><p className="text-sm text-ink-700 mt-1">{viewingReview.employeeId || '—'}</p></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Effective Date</p><p className="text-sm text-ink-700 mt-1">{formatDate(viewingReview.effectiveDate) || '—'}</p></div>
            {viewingReview.approvedBy && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved By</p><p className="text-sm text-ink-700 mt-1">{viewingReview.approvedBy}</p></div>
            )}
            {viewingReview.reason && (
              <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Reason</p><p className="text-sm text-ink-700">{viewingReview.reason}</p></div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, Clock, Plus, Download, Eye, Edit3, Trash2, CalendarDays } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  employeeName: string;
  leaveTypeName: string;
  leaveTypeColor?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  reason: string;
  remarks?: string;
  status: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface SimpleEmployee {
  id: string;
  firstName: string;
  lastName: string;
}

interface SimpleLeaveType {
  id: string;
  name: string;
  color?: string;
}

export function LeaveRequestsPage() {
  const { toast } = useToast();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<SimpleEmployee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<SimpleLeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [approveModalId, setApproveModalId] = useState<string | null>(null);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [submittingApprove, setSubmittingApprove] = useState(false);

  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [reqRes, empRes, ltRes] = await Promise.all([
        hrApi.getLeaveRequests(),
        hrApi.getEmployees(),
        hrApi.getLeaveTypes(),
      ]);
      setRequests(reqRes.data ?? reqRes ?? []);
      setEmployees(empRes.data ?? empRes ?? []);
      setLeaveTypes(ltRes.data ?? ltRes ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load data';
      setFetchError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const [statusFilter, setStatusFilter] = useState('all');

  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const ps = useHrPageState({
    data: statusFiltered,
    initialSortKey: 'createdAt',
    initialSortDirection: 'desc',
    searchKeys: ['employeeName', 'leaveTypeName', 'reason'],
    pageSize: 10,
  });

  const stats = useMemo(() => [
    { label: 'Total Requests', value: requests.length, icon: <CalendarDays className="w-4 h-4" />, color: 'blue' as const, active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
    { label: 'Approved', value: requests.filter(r => r.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: statusFilter === 'approved', onClick: () => setStatusFilter('approved') },
    { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: statusFilter === 'pending', onClick: () => setStatusFilter('pending') },
    { label: 'Rejected', value: requests.filter(r => r.status === 'rejected').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: statusFilter === 'rejected', onClick: () => setStatusFilter('rejected') },
  ], [requests, statusFilter]);

  const handleApprove = async () => {
    if (!approveModalId) return;
    setSubmittingApprove(true);
    try {
      await hrApi.approveLeaveRequest(approveModalId, { remarks: approveRemarks || undefined });
      toast('Leave request approved', 'success');
      setApproveModalId(null);
      setApproveRemarks('');
      await loadData();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to approve', 'error');
    } finally {
      setSubmittingApprove(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalId || !rejectReason.trim()) return;
    setSubmittingReject(true);
    try {
      await hrApi.rejectLeaveRequest(rejectModalId, { reason: rejectReason.trim() });
      toast('Leave request rejected', 'success');
      setRejectModalId(null);
      setRejectReason('');
      await loadData();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to reject', 'error');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await hrApi.cancelLeaveRequest(id);
      toast('Leave request cancelled', 'success');
      ps.closeConfirmDelete();
      await loadData();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to cancel', 'error');
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    ps.setSubmitting(true);
    ps.setFormError(null);
    try {
      const form = e.target as HTMLFormElement;
      const fd = new FormData(form);
      const employeeId = fd.get('employeeId') as string;
      const leaveTypeId = fd.get('leaveTypeId') as string;
      const startDate = fd.get('startDate') as string;
      const endDate = fd.get('endDate') as string;
      const isHalfDay = fd.get('isHalfDay') === 'on';
      const reason = fd.get('reason') as string;

      if (!employeeId || !leaveTypeId || !startDate || !endDate) {
        ps.setFormError('Please fill all required fields');
        ps.setSubmitting(false);
        return;
      }

      const payload = { employeeId, leaveTypeId, startDate, endDate, isHalfDay, reason };
      await hrApi.createLeaveRequest(payload);
      toast(ps.editingId ? 'Leave request updated' : 'Leave request submitted', 'success');
      ps.closeModal();
      await loadData();
    } catch (err: any) {
      ps.setFormError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      ps.setSubmitting(false);
    }
  };

  const selectedItem = ps.viewingId ? requests.find(r => r.id === ps.viewingId) : null;
  const editItem = ps.editingId ? requests.find(r => r.id === ps.editingId) : null;

  const statusColors: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
    cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employeeName', label: 'Employee', sortable: true,
      render: (r) => <span className="font-medium text-ink-900">{r.employeeName}</span>,
    },
    {
      key: 'leaveTypeName', label: 'Leave Type', sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.leaveTypeColor && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.leaveTypeColor }} />}
          {r.leaveTypeName}
        </span>
      ),
    },
    { key: 'startDate', label: 'From', sortable: true, render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'To', sortable: true, render: (r) => formatDate(r.endDate) },
    {
      key: 'totalDays', label: 'Days', sortable: true, className: 'text-center',
      render: (r) => <span className="tabular-nums">{r.isHalfDay ? '0.5' : r.totalDays}</span>,
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[r.status] || statusColors.pending}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {r.status === 'pending' && (
            <>
              <button onClick={() => { setApproveModalId(r.id); setApproveRemarks(''); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setRejectModalId(r.id); setRejectReason(''); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Reject">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={() => ps.openViewDrawer(r.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => ps.openEditModal(r.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => r.status === 'pending' ? ps.openConfirmDelete(r.id) : undefined}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${r.status === 'pending' ? 'text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30' : 'text-ink-200 cursor-not-allowed'}`}
            title={r.status === 'pending' ? 'Cancel' : 'Can only cancel pending requests'}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <HrPageShell title="Leave Requests" description="Manage and process employee leave requests"
      pageKey="leave-requests"
      headerActions={
        <>
          <button onClick={ps.openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Request
          </button>
          <button onClick={() => exportToCsv(
            ['Employee', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Reason'],
            ps.filtered.map(r => [r.employeeName, r.leaveTypeName, r.startDate, r.endDate, String(r.totalDays), r.status, r.reason]),
            'leave-requests',
          )}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employee, leave type or reason..."
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Approved', value: 'approved' },
          { label: 'Pending', value: 'pending' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        onClear={() => { ps.clearFilters(); setStatusFilter('all'); }}
        hasActiveFilters={ps.hasActiveFilters || statusFilter !== 'all'}
      />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={r => r.id}
        loading={loading} error={fetchError}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No leave requests found"
        emptyAction={
          <button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">
            Submit a leave request
          </button>
        }
      />

      {/* Create / Edit Modal */}
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal}
        title={ps.editingId ? 'Edit Leave Request' : 'New Leave Request'}
        onSubmit={handleCreateOrUpdate}
        error={ps.formError}
        loading={ps.submitting}
        submitLabel={ps.editingId ? 'Update' : 'Submit'}>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Employee <span className="text-rose-500">*</span></label>
          <select name="employeeId" defaultValue={editItem?.employeeId ?? ''} required
            className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900">
            <option value="">Select employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Leave Type <span className="text-rose-500">*</span></label>
          <select name="leaveTypeId" defaultValue={editItem?.leaveTypeId ?? ''} required
            className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900">
            <option value="">Select leave type</option>
            {leaveTypes.map(lt => (
              <option key={lt.id} value={lt.id}>{lt.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">From <span className="text-rose-500">*</span></label>
            <input type="date" name="startDate" defaultValue={editItem?.startDate ?? ''} required
              className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">To <span className="text-rose-500">*</span></label>
            <input type="date" name="endDate" defaultValue={editItem?.endDate ?? ''} required
              className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" name="isHalfDay" defaultChecked={editItem?.isHalfDay ?? false}
            className="rounded border-ink-300 text-primary focus:ring-primary/30" />
          Half day
        </label>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Reason</label>
          <textarea name="reason" rows={3} defaultValue={editItem?.reason ?? ''}
            className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
        </div>
      </HrFormModal>

      {/* Approve Modal */}
      {approveModalId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) { setApproveModalId(null); setApproveRemarks(''); } }}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm border border-border-custom p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-900">Approve Leave Request</h3>
                <p className="text-xs text-ink-400 mt-0.5">This will approve the selected leave request</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Remarks (optional)</label>
              <textarea value={approveRemarks} onChange={e => setApproveRemarks(e.target.value)}
                rows={3} placeholder="Add any approval remarks..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => { setApproveModalId(null); setApproveRemarks(''); }} disabled={submittingApprove}
                className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleApprove} disabled={submittingApprove}
                className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                {submittingApprove ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) { setRejectModalId(null); setRejectReason(''); } }}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm border border-border-custom p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-900">Reject Leave Request</h3>
                <p className="text-xs text-ink-400 mt-0.5">Provide a reason for rejection</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Reason <span className="text-rose-500">*</span></label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={3} placeholder="Enter rejection reason..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" />
              {rejectReason.trim() === '' && <p className="text-xs text-rose-500 mt-1">Reason is required</p>}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => { setRejectModalId(null); setRejectReason(''); }} disabled={submittingReject}
                className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleReject} disabled={submittingReject || !rejectReason.trim()}
                className="px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                {submittingReject ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation */}
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete}
        onConfirm={() => ps.deletingId && handleCancel(ps.deletingId)}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this pending leave request?"
        confirmLabel="Cancel Request"
        variant="warning" />

      {/* View Drawer */}
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Leave Request Details">
        {selectedItem && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{selectedItem.employeeName}</p>
                <p className="text-xs text-ink-400">{selectedItem.leaveTypeName}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">From</p>
                <p className="text-sm text-ink-700 mt-1">{formatDate(selectedItem.startDate)}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">To</p>
                <p className="text-sm text-ink-700 mt-1">{formatDate(selectedItem.endDate)}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Days</p>
                <p className="text-sm font-semibold text-ink-900 mt-1">{selectedItem.isHalfDay ? '0.5' : selectedItem.totalDays}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[selectedItem.status] || statusColors.pending}`}>
                {selectedItem.status}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Reason</p>
              <p className="text-sm text-ink-700 mt-1">{selectedItem.reason || '\u2014'}</p>
            </div>
            {selectedItem.remarks && (
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Remarks</p>
                <p className="text-sm text-ink-700 mt-1">{selectedItem.remarks}</p>
              </div>
            )}
            {selectedItem.rejectionReason && (
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Rejection Reason</p>
                <p className="text-sm text-ink-700 mt-1">{selectedItem.rejectionReason}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-custom">
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Created</p>
                <p className="text-xs text-ink-600 mt-0.5">{formatDate(selectedItem.createdAt)}</p>
              </div>
              {selectedItem.approvedAt && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved</p>
                  <p className="text-xs text-ink-600 mt-0.5">{formatDate(selectedItem.approvedAt)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

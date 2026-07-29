import { useState, useEffect, useMemo, useCallback } from 'react';
import { Briefcase, Clock, CheckCircle2, XCircle, Plus, Eye, Edit3, Trash2, Send, Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface Requisition {
  id: string;
  title: string;
  departmentId?: string;
  designationId?: string;
  departmentName?: string;
  designationName?: string;
  description?: string;
  reason: string;
  requirements?: string;
  location?: string;
  employmentType?: string;
  openings: number;
  salaryRange?: string;
  urgency: 'normal' | 'high' | 'critical';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  requestedBy?: string;
  requestedByName?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  title?: string;
  name?: string;
}

const initialFormData = {
  title: '',
  departmentId: '',
  designationId: '',
  description: '',
  reason: '',
  requirements: '',
  location: '',
  employmentType: '',
  openings: 1,
  salaryRange: '',
  urgency: 'normal' as const,
};

function urgencyColor(u: string): string {
  const m: Record<string, string> = {
    normal: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    critical: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
  };
  return m[u.toLowerCase()] || m.normal;
}

export function RequisitionsPage() {
  const { toast } = useToast();

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(initialFormData);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveName, setApproveName] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [reqRes, deptRes, desigRes] = await Promise.all([
        hrApi.getRequisitions(),
        hrApi.getDepartments(),
        hrApi.getDesignations(),
      ]);
      setRequisitions(Array.isArray(reqRes) ? reqRes : (reqRes.data ?? []));
      setDepartments(Array.isArray(deptRes) ? deptRes : (deptRes.data ?? []));
      setDesignations(Array.isArray(desigRes) ? desigRes : (desigRes.data ?? []));
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load data';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ps = useHrPageState({
    data: requisitions,
    initialSortKey: 'title',
    searchKeys: ['title', 'departmentName', 'designationName', 'requestedByName'] as (keyof Requisition)[],
    pageSize: 10,
  });

  const statusFiltered = useMemo(() => {
    if (ps.statusFilter === 'all') return ps.filtered;
    return ps.filtered.filter(r => r.status === ps.statusFilter);
  }, [ps.filtered, ps.statusFilter]);

  const paginatedData = useMemo(() => {
    const start = (ps.page - 1) * ps.pageSize;
    return statusFiltered.slice(start, start + ps.pageSize);
  }, [statusFiltered, ps.page, ps.pageSize]);

  const stats = useMemo(() => [
    { label: 'Total', value: requisitions.length, icon: <Briefcase className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending Approval', value: requisitions.filter(r => r.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: requisitions.filter(r => r.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: requisitions.filter(r => r.status === 'rejected').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [requisitions, ps.statusFilter]);

  const handleApprove = async () => {
    if (!approvingId) return;
    setApproveLoading(true);
    try {
      await hrApi.approveRequisition(approvingId, { approvedBy: approveName });
      toast('Requisition approved', 'success');
      setApproveModalOpen(false);
      setApprovingId(null);
      setApproveName('');
      fetchData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to approve', 'error');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    if (!rejectReason.trim()) { toast('Please provide a rejection reason', 'error'); return; }
    setRejectLoading(true);
    try {
      await hrApi.rejectRequisition(rejectingId, { rejectionReason: rejectReason });
      toast('Requisition rejected', 'success');
      setRejectModalOpen(false);
      setRejectingId(null);
      setRejectReason('');
      fetchData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to reject', 'error');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!submittingId) return;
    setSubmitLoading(true);
    try {
      await hrApi.submitRequisition(submittingId);
      toast('Requisition submitted for approval', 'success');
      setSubmitConfirmOpen(false);
      setSubmittingId(null);
      fetchData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to submit', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    setDeleteLoading(true);
    try {
      await hrApi.deleteRequisition(ps.deletingId);
      toast('Requisition deleted', 'success');
      ps.closeConfirmDelete();
      fetchData();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to delete', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { ps.setFormError('Title is required'); return; }
    if (!formData.reason.trim()) { ps.setFormError('Reason is required'); return; }
    setSaving(true);
    ps.setFormError(null);
    try {
      const payload = { ...formData, openings: Number(formData.openings) };
      if (ps.editingId) {
        await hrApi.updateRequisition(ps.editingId, payload);
        toast('Requisition updated', 'success');
      } else {
        await hrApi.createRequisition(payload);
        toast('Requisition created', 'success');
      }
      ps.closeModal();
      setFormData(initialFormData);
      fetchData();
    } catch (err: any) {
      ps.setFormError(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openApproveModal = (id: string) => {
    setApprovingId(id);
    setApproveName('');
    setApproveModalOpen(true);
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const openSubmitConfirm = (id: string) => {
    setSubmittingId(id);
    setSubmitConfirmOpen(true);
  };

  const openCreateModal = () => {
    setFormData(initialFormData);
    ps.openAddModal();
  };

  const openEditForm = (item: Requisition) => {
    setFormData({
      title: item.title,
      departmentId: item.departmentId || '',
      designationId: item.designationId || '',
      description: item.description || '',
      reason: item.reason,
      requirements: item.requirements || '',
      location: item.location || '',
      employmentType: item.employmentType || '',
      openings: item.openings,
      salaryRange: item.salaryRange || '',
      urgency: item.urgency,
    });
    ps.openEditModal(item.id);
  };

  const viewingItem = ps.viewingId ? requisitions.find(r => r.id === ps.viewingId) : null;

  const columns: Column<Requisition>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (r) => <span className="font-medium text-ink-900">{r.title}</span>,
    },
    {
      key: 'departmentName',
      label: 'Department',
      sortable: true,
      render: (r) => <span className="text-ink-600">{r.departmentName || '-'}</span>,
    },
    {
      key: 'designationName',
      label: 'Designation',
      sortable: true,
      render: (r) => <span className="text-ink-600">{r.designationName || '-'}</span>,
    },
    {
      key: 'openings',
      label: 'Openings',
      sortable: true,
      className: 'text-center',
      render: (r) => <span className="font-semibold text-ink-700">{r.openings}</span>,
    },
    {
      key: 'urgency',
      label: 'Urgency',
      sortable: true,
      render: (r) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${urgencyColor(r.urgency)}`}>
          {r.urgency === 'critical' && <AlertTriangle className="w-3 h-3" />}
          {r.urgency}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(r.status)}`}>
          {r.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
          {r.status === 'rejected' && <XCircle className="w-3 h-3" />}
          {r.status === 'pending' && <Clock className="w-3 h-3" />}
          {r.status}
        </span>
      ),
    },
    {
      key: 'requestedByName',
      label: 'Requested By',
      sortable: true,
      render: (r) => <span className="text-ink-500">{r.requestedByName || '-'}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(r.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors"
            title="View"><Eye className="w-3.5 h-3.5" /></button>
          {r.status === 'draft' && (
            <>
              <button onClick={() => openEditForm(r)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => openSubmitConfirm(r.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                title="Submit for Approval"><Send className="w-3.5 h-3.5" /></button>
              <button onClick={() => ps.openConfirmDelete(r.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
          {r.status === 'pending' && (
            <>
              <button onClick={() => openApproveModal(r.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                title="Approve"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => openRejectModal(r.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Reject"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      ),
      className: 'text-right',
    },
  ];

  const totalCount = statusFiltered.length;
  const from = totalCount === 0 ? 0 : (ps.page - 1) * ps.pageSize + 1;
  const to = Math.min(ps.page * ps.pageSize, totalCount);

  return (
    <HrPageShell title="Requisitions" description="Manage job requisitions and approval workflow"
      pageKey="requisitions"
      headerActions={
        <button onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm">
          <Plus className="w-3.5 h-3.5" /> New Requisition
        </button>
      }>

      <HrStatCards items={stats} columns={4} />

      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by title, department..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Draft', value: 'draft' },
          { label: 'Pending Approval', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />

      <HrDataTable columns={columns} data={paginatedData} keyExtractor={r => r.id}
        loading={loading} error={fetchError}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir}
        onSort={(k) => ps.handleSort(k as keyof Requisition)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={Math.ceil(totalCount / ps.pageSize)} onPageChange={ps.setPage}
        pageSize={ps.pageSize} totalItems={totalCount}
        from={from} to={to}
        emptyMessage={loading ? 'Loading requisitions...' : fetchError || 'No requisitions found'}
        emptyAction={!loading && !fetchError ? <button onClick={openCreateModal} className="text-xs font-medium text-primary">Create a requisition</button> : undefined}
      />

      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal}
        title={ps.editingId ? 'Edit Requisition' : 'New Requisition'}
        onSubmit={handleFormSubmit} error={ps.formError} loading={saving}
        submitLabel={saving ? 'Saving...' : ps.editingId ? 'Update' : 'Create'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Title *</label>
            <input value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="e.g. Senior Accountant" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Department</label>
            <select value={formData.departmentId} onChange={e => setFormData(f => ({ ...f, departmentId: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">Select department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Designation</label>
            <select value={formData.designationId} onChange={e => setFormData(f => ({ ...f, designationId: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">Select designation</option>
              {designations.map(d => <option key={d.id} value={d.id}>{d.title || d.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              placeholder="Describe the role..." />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Reason *</label>
            <textarea value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              placeholder="Why is this position needed?" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Requirements</label>
            <textarea value={formData.requirements} onChange={e => setFormData(f => ({ ...f, requirements: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              placeholder="Key qualifications and skills..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Location</label>
            <input value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="e.g. Lagos" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Employment Type</label>
            <select value={formData.employmentType} onChange={e => setFormData(f => ({ ...f, employmentType: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="">Select type</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
              <option value="Temporary">Temporary</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Openings</label>
            <input type="number" min={1} value={formData.openings}
              onChange={e => setFormData(f => ({ ...f, openings: Number(e.target.value) }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Salary Range</label>
            <input value={formData.salaryRange} onChange={e => setFormData(f => ({ ...f, salaryRange: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="e.g. ₦5M - ₦8M" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Urgency</label>
            <select value={formData.urgency} onChange={e => setFormData(f => ({ ...f, urgency: e.target.value as any }))}
              className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={submitConfirmOpen} onClose={() => { setSubmitConfirmOpen(false); setSubmittingId(null); }}
        onConfirm={handleSubmit} title="Submit Requisition"
        message="Are you sure you want to submit this requisition for approval?"
        confirmLabel="Submit" variant="info" loading={submitLoading} />

      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete}
        onConfirm={handleDelete} title="Delete Requisition"
        message="Are you sure? This action cannot be undone."
        confirmLabel="Delete" variant="danger" loading={deleteLoading} />

      <HrFormModal open={approveModalOpen} onClose={() => { setApproveModalOpen(false); setApprovingId(null); }}
        title="Approve Requisition" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}
        loading={approveLoading} submitLabel={approveLoading ? 'Approving...' : 'Approve'}>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Approved By</label>
          <input value={approveName} onChange={e => setApproveName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="Your name" required />
        </div>
      </HrFormModal>

      <HrFormModal open={rejectModalOpen} onClose={() => { setRejectModalOpen(false); setRejectingId(null); }}
        title="Reject Requisition" onSubmit={(e) => { e.preventDefault(); handleReject(); }}
        loading={rejectLoading} submitLabel={rejectLoading ? 'Rejecting...' : 'Reject'}>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Rejection Reason *</label>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            placeholder="Provide a reason for rejection..." required />
        </div>
      </HrFormModal>

      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer}
        title={viewingItem?.title || 'Requisition Details'}>
        {viewingItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{viewingItem.title}</p>
                <p className="text-xs text-ink-400">{viewingItem.departmentName || viewingItem.designationName || ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Department</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.departmentName || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Designation</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.designationName || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Openings</p>
                <p className="text-sm font-semibold text-ink-900 mt-1">{viewingItem.openings}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employment Type</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.employmentType || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Location</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.location || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Salary Range</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.salaryRange || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Urgency</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${urgencyColor(viewingItem.urgency)}`}>
                  {viewingItem.urgency === 'critical' && <AlertTriangle className="w-3 h-3" />}
                  {viewingItem.urgency}
                </span>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingItem.status)}`}>
                  {viewingItem.status}
                </span>
              </div>
            </div>

            {viewingItem.description && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Description</p>
                <p className="text-sm text-ink-700 mt-1 whitespace-pre-wrap">{viewingItem.description}</p>
              </div>
            )}

            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Reason</p>
              <p className="text-sm text-ink-700 mt-1 whitespace-pre-wrap">{viewingItem.reason}</p>
            </div>

            {viewingItem.requirements && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Requirements</p>
                <p className="text-sm text-ink-700 mt-1 whitespace-pre-wrap">{viewingItem.requirements}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Requested By</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.requestedByName || '-'}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Date</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.createdAt ? formatDate(viewingItem.createdAt) : '-'}</p>
              </div>
            </div>

            {viewingItem.approvedBy && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved By</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{viewingItem.approvedBy}</p>
              </div>
            )}

            {viewingItem.rejectionReason && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl">
                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejection Reason</p>
                <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">{viewingItem.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

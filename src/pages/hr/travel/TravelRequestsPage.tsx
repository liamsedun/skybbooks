import { useState, useEffect, useMemo } from 'react';
import { Plane, Plus, Download, FileText, Edit3, Trash2, Eye, Send, CheckCircle2, XCircle } from 'lucide-react';
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

interface TravelRequest {
  id: string;
  employeeId: string;
  destination: string;
  purpose: string;
  departureDate: string;
  returnDate: string;
  estimatedCost: number;
  currency: string;
  accommodation: string;
  transportMode: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string;
  createdAt: string;
}

const INITIAL_FORM = {
  destination: '', purpose: '', departureDate: '', returnDate: '',
  estimatedCost: 0, currency: 'NGN', accommodation: '', transportMode: 'flight', notes: '',
};

const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Declined', value: 'declined' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Completed', value: 'completed' },
];

const fmtNaira = (n: number) => `?${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function TravelRequestsPage() {
  const { toast } = useToast();
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [declineReason, setDeclineReason] = useState('');

  const ps = useHrPageState({
    data: travelRequests,
    initialSortKey: 'createdAt',
    searchKeys: ['destination', 'purpose', 'status'],
    pageSize: 10,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getTravelRequests();
      setTravelRequests(Array.isArray(res) ? res : res?.data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredByStatus = useMemo(() => {
    if (ps.statusFilter === 'all') return ps.filtered;
    return ps.filtered.filter(r => r.status === ps.statusFilter);
  }, [ps.filtered, ps.statusFilter]);

  const paginated = useMemo(() => {
    const start = (ps.page - 1) * ps.pageSize;
    return filteredByStatus.slice(start, start + ps.pageSize);
  }, [filteredByStatus, ps.page, ps.pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredByStatus.length / ps.pageSize));

  const stats = useMemo(() => [
    { label: 'Total', value: travelRequests.length, icon: <Plane className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Draft', value: travelRequests.filter(r => r.status === 'draft').length, icon: <FileText className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
    { label: 'Submitted', value: travelRequests.filter(r => r.status === 'submitted').length, icon: <Send className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'submitted', onClick: () => ps.setStatusFilter('submitted') },
    { label: 'Approved', value: travelRequests.filter(r => r.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Completed', value: travelRequests.filter(r => r.status === 'completed').length, icon: <Plane className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [travelRequests, ps.statusFilter]);

  const openCreateForm = () => {
    setForm({ ...INITIAL_FORM });
    ps.openAddModal();
  };

  const openEditForm = (id: string) => {
    const t = travelRequests.find(r => r.id === id);
    if (!t) return;
    setForm({
      destination: t.destination,
      purpose: t.purpose,
      departureDate: t.departureDate,
      returnDate: t.returnDate,
      estimatedCost: t.estimatedCost,
      currency: t.currency,
      accommodation: t.accommodation,
      transportMode: t.transportMode,
      notes: t.notes,
    });
    ps.openEditModal(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (ps.editingId) {
        await hrApi.updateTravelRequest(ps.editingId, form);
        toast('Travel request updated', 'success');
      } else {
        await hrApi.createTravelRequest(form);
        toast('Travel request created', 'success');
      }
      ps.closeModal();
      await load();
    } catch (err: any) {
      toast(err?.message || 'Failed to save', 'error');
    }
  };

  const handleStatusAction = async (id: string, action: 'submit' | 'approve' | 'decline') => {
    try {
      if (action === 'submit') {
        await hrApi.submitTravelRequest(id);
        toast('Submitted for approval', 'success');
      } else if (action === 'approve') {
        await hrApi.approveTravelRequest(id);
        toast('Travel request approved', 'success');
      } else {
        const reason = window.prompt('Reason for declining:');
        if (!reason) return;
        await hrApi.declineTravelRequest(id, reason);
        toast('Travel request declined', 'success');
      }
      await load();
    } catch (err: any) {
      toast(err?.message || `Failed to ${action}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deleteTravelRequest(ps.deletingId);
      toast('Travel request deleted', 'success');
      ps.closeConfirmDelete();
      await load();
    } catch (err: any) {
      toast(err?.message || 'Failed to delete', 'error');
    }
  };

  const exportData = (type: 'csv' | 'pdf') => {
    const headers = ['Destination', 'Purpose', 'Departure', 'Return', 'Est. Cost', 'Currency', 'Accommodation', 'Transport', 'Status'];
    const rows = filteredByStatus.map(r => [
      r.destination, r.purpose, formatDate(r.departureDate), formatDate(r.returnDate),
      fmtNaira(r.estimatedCost), r.currency, r.accommodation, r.transportMode, r.status,
    ]);
    if (type === 'csv') {
      exportToCsv(headers, rows, 'travel-requests');
      toast('CSV exported', 'success');
    } else {
      exportToPdf('Travel Requests', headers, rows, 'travel-requests');
    }
  };

  const columns: Column<TravelRequest>[] = [
    { key: 'destination', label: 'Destination', sortable: true, render: (r) => <span className="font-medium text-ink-900">{r.destination}</span> },
    {
      key: 'purpose', label: 'Purpose', sortable: true,
      render: (r) => <span className="text-ink-500 truncate max-w-[200px] inline-block">{r.purpose.length > 50 ? r.purpose.slice(0, 50) + '...' : r.purpose}</span>,
    },
    { key: 'departureDate', label: 'Departure', sortable: true, render: (r) => <span className="text-ink-500">{formatDate(r.departureDate)}</span> },
    { key: 'returnDate', label: 'Return', sortable: true, render: (r) => <span className="text-ink-500">{formatDate(r.returnDate)}</span> },
    { key: 'estimatedCost', label: 'Est. Cost', sortable: true, render: (r) => <span className="font-semibold text-ink-700">{fmtNaira(r.estimatedCost)}</span> },
    {
      key: 'status', label: 'Status',
      render: (r) => {
        const colors: Record<string, string> = {
          draft: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
          submitted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
          approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
          declined: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
          cancelled: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
          completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
        };
        return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[r.status] || colors.draft}`}>{r.status}</span>;
      },
    },
    {
      key: 'actions', label: '', className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {r.status === 'draft' && (
            <>
              <button onClick={() => handleStatusAction(r.id, 'submit')} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" title="Submit"><Send className="w-3.5 h-3.5" /></button>
              <button onClick={() => openEditForm(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => ps.openConfirmDelete(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
          {r.status === 'submitted' && (
            <>
              <button onClick={() => handleStatusAction(r.id, 'approve')} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleStatusAction(r.id, 'decline')} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Decline"><XCircle className="w-3.5 h-3.5" /></button>
            </>
          )}
          <button onClick={() => ps.openViewDrawer(r.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  const viewingRequest = ps.viewingId ? travelRequests.find(r => r.id === ps.viewingId) : null;

  return (
    <HrPageShell
      title="Travel Requests"
      description="Manage employee travel requests"
      pageKey="travel"
      headerActions={
        <>
          <button onClick={() => exportData('csv')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportData('pdf')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openCreateForm} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> New Request</button>
        </>
      }
    >
      <HrStatCards items={stats} columns={5} />
      <HrFilterBar
        search={ps.search}
        onSearchChange={ps.setSearch}
        searchPlaceholder="Search by destination, purpose, status..."
        statusFilter={ps.statusFilter}
        onStatusChange={ps.setStatusFilter}
        statusOptions={STATUS_OPTIONS}
        onClear={ps.clearFilters}
        hasActiveFilters={ps.hasActiveFilters}
      />
      <HrDataTable
        columns={columns}
        data={paginated}
        keyExtractor={r => r.id}
        sortKey={ps.sortKey as string}
        sortDir={ps.sortDir}
        onSort={k => ps.handleSort(k as keyof TravelRequest)}
        selectedIds={ps.selectedIds}
        onSelectOne={ps.handleSelectOne}
        onSelectAll={ps.handleSelectAll}
        page={ps.page}
        totalPages={totalPages}
        onPageChange={ps.setPage}
        pageSize={ps.pageSize}
        totalItems={filteredByStatus.length}
        from={(ps.page - 1) * ps.pageSize + 1}
        to={Math.min(ps.page * ps.pageSize, filteredByStatus.length)}
        emptyMessage={loading ? 'Loading...' : 'No travel requests'}
        emptyAction={!loading ? <button onClick={openCreateForm} className="text-xs font-medium text-primary">Create one</button> : undefined}
      />

      <HrFormModal
        open={ps.modalOpen}
        onClose={ps.closeModal}
        title={ps.editingId ? 'Edit Travel Request' : 'New Travel Request'}
        onSubmit={handleSubmit}
      >
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Destination</label>
          <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Lagos to Abuja" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Purpose</label>
          <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} required rows={3} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Reason for travel" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Departure Date</label>
            <input type="date" value={form.departureDate} onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Return Date</label>
            <input type="date" value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Estimated Cost</label>
            <input type="number" value={form.estimatedCost || ''} onChange={e => setForm(f => ({ ...f, estimatedCost: Number(e.target.value) }))} required min={0} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Currency</label>
            <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="NGN" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Accommodation</label>
          <input value={form.accommodation} onChange={e => setForm(f => ({ ...f, accommodation: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Hotel details" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Transport Mode</label>
          <select value={form.transportMode} onChange={e => setForm(f => ({ ...f, transportMode: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            <option value="flight">Flight</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Additional notes" />
        </div>
      </HrFormModal>

      <HrConfirmDialog
        open={ps.confirmOpen}
        onClose={ps.closeConfirmDelete}
        onConfirm={handleDelete}
        title="Delete Travel Request"
        message="Are you sure you want to delete this travel request? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      <HrViewDrawer
        open={ps.viewDrawerOpen}
        onClose={ps.closeViewDrawer}
        title="Travel Request Details"
      >
        {viewingRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><Plane className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{viewingRequest.destination}</p>
                <p className="text-xs text-ink-400">{viewingRequest.purpose}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Departure</p>
                <p className="text-sm text-ink-700 mt-1">{formatDate(viewingRequest.departureDate)}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Return</p>
                <p className="text-sm text-ink-700 mt-1">{formatDate(viewingRequest.returnDate)}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Est. Cost</p>
                <p className="text-sm font-semibold text-ink-900 mt-1">{fmtNaira(viewingRequest.estimatedCost)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Currency</p>
                <p className="text-sm text-ink-700 mt-1">{viewingRequest.currency}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Transport Mode</p>
                <p className="text-sm text-ink-700 mt-1 capitalize">{viewingRequest.transportMode}</p>
              </div>
            </div>
            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Accommodation</p>
              <p className="text-sm text-ink-700 mt-1">{viewingRequest.accommodation || 'N/A'}</p>
            </div>
            {viewingRequest.notes && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Notes</p>
                <p className="text-sm text-ink-700 mt-1">{viewingRequest.notes}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Status</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(viewingRequest.status)}`}>{viewingRequest.status}</span>
            </div>
            {viewingRequest.approvedBy && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved By</p>
                <p className="text-sm text-ink-700 mt-1">{viewingRequest.approvedBy} {viewingRequest.approvedAt ? `on ${formatDate(viewingRequest.approvedAt)}` : ''}</p>
              </div>
            )}
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}
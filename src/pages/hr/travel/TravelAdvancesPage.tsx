import { useState, useEffect, useMemo } from 'react';
import { Wallet, Plus, Download, FileText, Edit3, Trash2, Eye, CheckCircle2, DollarSign } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface TravelAdvance {
  id: string; employeeId: string; travelRequestId: string | null;
  amount: number; currency: string; requestDate: string;
  purpose: string; status: string;
  approvedBy: string | null; approvedAt: string | null;
  disbursedAt: string | null; notes: string; createdAt: string;
}

const statusColor = (s: string) => {
  const map: Record<string, string> = {
    pending: 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800',
    approved: 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800',
    disbursed: 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800',
    settled: 'text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800',
    cancelled: 'text-gray-600 border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700',
  };
  return map[s] || 'text-ink-600 border-border-custom bg-ink-50';
};

const fmtAmount = (n: number) => `₦${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export function TravelAdvancesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TravelAdvance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await hrApi.getTravelAdvances();
        if (res?.data) setData(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ps = useHrPageState({ data, initialSortKey: 'requestDate', searchKeys: ['employeeId', 'purpose', 'status'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total', value: data.length, icon: <Wallet className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: data.filter(i => i.status === 'pending').length, icon: <Wallet className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: data.filter(i => i.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Disbursed', value: data.filter(i => i.status === 'disbursed').length, icon: <DollarSign className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'disbursed', onClick: () => ps.setStatusFilter('disbursed') },
    { label: 'Cancelled', value: data.filter(i => i.status === 'cancelled').length, icon: <Wallet className="w-4 h-4" />, color: 'gray' as const, active: ps.statusFilter === 'cancelled', onClick: () => ps.setStatusFilter('cancelled') },
  ], [data, ps.statusFilter]);

  const handleApprove = async (id: string) => {
    try {
      await hrApi.approveTravelAdvance(id);
      setData(prev => prev.map(i => i.id === id ? { ...i, status: 'approved', approvedBy: 'You', approvedAt: new Date().toISOString() } : i));
      toast('Advance approved', 'success');
    } catch { toast('Failed to approve', 'error'); }
  };

  const handleDisburse = async (id: string) => {
    try {
      await hrApi.disburseTravelAdvance(id);
      setData(prev => prev.map(i => i.id === id ? { ...i, status: 'disbursed', disbursedAt: new Date().toISOString() } : i));
      toast('Advance disbursed', 'success');
    } catch { toast('Failed to disburse', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteTravelAdvance(id);
      setData(prev => prev.filter(i => i.id !== id));
      toast('Deleted', 'success');
    } catch { toast('Failed to delete', 'error'); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = {
      employeeId: (form.elements.nativeItem('employeeId') as HTMLInputElement).value,
      travelRequestId: (form.elements.nativeItem('travelRequestId') as HTMLInputElement).value || null,
      amount: Number((form.elements.nativeItem('amount') as HTMLInputElement).value),
      currency: (form.elements.nativeItem('currency') as HTMLInputElement).value,
      requestDate: (form.elements.nativeItem('requestDate') as HTMLInputElement).value,
      purpose: (form.elements.nativeItem('purpose') as HTMLTextAreaElement).value,
      notes: (form.elements.nativeItem('notes') as HTMLTextAreaElement).value,
    };
    try {
      if (ps.editingId) {
        await hrApi.updateTravelAdvance(ps.editingId, payload);
        const res = await hrApi.getTravelAdvances();
        if (res?.data) setData(res.data);
        toast('Updated', 'success');
      } else {
        await hrApi.createTravelAdvance(payload);
        const res = await hrApi.getTravelAdvances();
        if (res?.data) setData(res.data);
        toast('Created', 'success');
      }
      ps.closeModal();
    } catch { toast('Failed to save', 'error'); }
  };

  const columns: Column<TravelAdvance>[] = [
    { key: 'employeeId', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeId}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => <span className="font-semibold text-ink-700">{fmtAmount(i.amount)}</span> },
    { key: 'requestDate', label: 'Request Date', sortable: true, render: (i) => <span className="text-ink-500">{i.requestDate}</span> },
    { key: 'purpose', label: 'Purpose', sortable: true, render: (i) => <span className="text-ink-600 truncate max-w-[200px] block">{i.purpose}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        {i.status === 'pending' && (
          <>
            <button onClick={() => handleApprove(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </>
        )}
        {i.status === 'approved' && (
          <button onClick={() => handleDisburse(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Disburse"><DollarSign className="w-3.5 h-3.5" /></button>
        )}
      </div>
    ), className: 'text-right' },
  ];

  const viewingItem = ps.viewingId ? data.find(i => i.id === ps.viewingId) : null;
  const editingItem = ps.editingId ? data.find(i => i.id === ps.editingId) : null;

  return (
    <HrPageShell title="Travel Advances" description="Manage travel advance requests"
      pageKey="travel"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee','Amount','Request Date','Purpose','Status','Notes'], ps.filtered.map(i => [i.employeeId,`₦${i.amount}`,i.requestDate,i.purpose,i.status,i.notes]), 'travel-advances'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Travel Advances', ['Employee','Amount','Request Date','Purpose','Status'], ps.filtered.map(i => [i.employeeId,`₦${i.amount}`,i.requestDate,i.purpose,i.status]), 'travel-advances')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={5} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee, purpose, status..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Disbursed', value: 'disbursed' },
          { label: 'Settled', value: 'settled' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel advances" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Travel Advance' : 'New Travel Advance'} onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={editingItem?.id || ''} />
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label>
          <input name="employeeId" defaultValue={editingItem?.employeeId || ''} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. EMP-001" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Travel Request ID</label>
          <input name="travelRequestId" defaultValue={editingItem?.travelRequestId || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Amount (NGN)</label>
            <input name="amount" type="number" defaultValue={editingItem?.amount || ''} required min={1} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. 200000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Currency</label>
            <input name="currency" defaultValue={editingItem?.currency || 'NGN'} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Request Date</label>
          <input name="requestDate" type="date" defaultValue={editingItem?.requestDate || ''} required className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Purpose</label>
          <textarea name="purpose" defaultValue={editingItem?.purpose || ''} required rows={3} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Describe the purpose of this advance" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Notes</label>
          <textarea name="notes" defaultValue={editingItem?.notes || ''} rows={2} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" placeholder="Additional notes (optional)" />
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { if (ps.confirmingId) { handleDelete(ps.confirmingId); } ps.closeConfirmDelete(); }} title="Delete Travel Advance" message="Are you sure you want to delete this travel advance? This action cannot be undone." confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Travel Advance Details">
        {viewingItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{viewingItem.employeeId}</p>
                <p className="text-xs text-ink-400">{viewingItem.purpose}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Amount</p>
                <p className="text-sm font-semibold text-ink-900 mt-1">{fmtAmount(viewingItem.amount)}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Currency</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.currency}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Request Date</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.requestDate}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Travel Request</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.travelRequestId || '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingItem.status)}`}>{viewingItem.status}</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Purpose</p>
              <p className="text-sm text-ink-700 mt-1">{viewingItem.purpose}</p>
            </div>
            {viewingItem.notes && (
              <div>
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Notes</p>
                <p className="text-sm text-ink-700 mt-1">{viewingItem.notes}</p>
              </div>
            )}
            {viewingItem.approvedBy && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                  <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved By</p>
                  <p className="text-sm text-ink-700 mt-1">{viewingItem.approvedBy}</p>
                </div>
                <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                  <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved At</p>
                  <p className="text-sm text-ink-700 mt-1">{viewingItem.approvedAt ? new Date(viewingItem.approvedAt).toLocaleString() : '—'}</p>
                </div>
              </div>
            )}
            {viewingItem.disbursedAt && (
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Disbursed At</p>
                <p className="text-sm text-ink-700 mt-1">{new Date(viewingItem.disbursedAt).toLocaleString()}</p>
              </div>
            )}
            <div className="pt-2 border-t border-border-custom">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Created</p>
              <p className="text-xs text-ink-500 mt-1">{new Date(viewingItem.createdAt).toLocaleString()}</p>
            </div>
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

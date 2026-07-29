import { useState, useEffect, useMemo } from 'react';
import { Award, Plus, Download, FileText, Edit3, Trash2, Eye, ThumbsUp, ThumbsDown } from 'lucide-react';
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

interface Promotion {
  id: string;
  employeeId: string;
  currentRole: string;
  proposedRole: string;
  reason: string;
  achievements: string;
  recommendedBy: string;
  approvedBy: string;
  status: string;
}

export function PromotionsPage() {
  const { toast } = useToast();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formCurrentRole, setFormCurrentRole] = useState('');
  const [formProposedRole, setFormProposedRole] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formAchievements, setFormAchievements] = useState('');

  const loadPromotions = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await hrApi.getPromotions({ pageSize: 500 });
      const data = res.data ?? res ?? [];
      const mapped: Promotion[] = data.map((r: any) => ({
        id: r.id,
        employeeId: r.employeeId || '—',
        currentRole: r.currentRole || '—',
        proposedRole: r.proposedRole || '—',
        reason: r.reason || '',
        achievements: r.achievements || '',
        recommendedBy: r.recommendedBy || '—',
        approvedBy: r.approvedBy || '—',
        status: r.status || 'pending',
      }));
      setPromotions(mapped);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load promotions';
      setFetchError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPromotions(); }, []);

  const ps = useHrPageState({
    data: promotions,
    initialSortKey: 'employeeId',
    searchKeys: ['employeeId', 'currentRole', 'proposedRole', 'reason', 'status'],
    pageSize: 10,
  });

  const stats = useMemo(() => [
    { label: 'Total', value: promotions.length, icon: <Award className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: promotions.filter(i => i.status === 'pending').length, icon: <Award className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: promotions.filter(i => i.status === 'approved').length, icon: <ThumbsUp className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: promotions.filter(i => i.status === 'rejected').length, icon: <ThumbsDown className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [promotions, ps.statusFilter]);

  const columns: Column<Promotion>[] = [
    { key: 'employeeId', label: 'Employee ID', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeId}</span> },
    { key: 'currentRole', label: 'Current Role', sortable: true, render: (i) => <span className="text-ink-700">{i.currentRole}</span> },
    { key: 'proposedRole', label: 'Proposed Role', sortable: true, render: (i) => <span className="text-ink-700">{i.proposedRole}</span> },
    { key: 'reason', label: 'Reason', render: (i) => <span className="text-ink-500 truncate max-w-[200px] block">{i.reason ? (i.reason.length > 60 ? i.reason.slice(0, 60) + '...' : i.reason) : '—'}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        {i.status === 'pending' && (
          <>
            <button onClick={() => handleOpenEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleApprove(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve"><ThumbsUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleReject(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Reject"><ThumbsDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </>
        )}
      </div>
    ), className: 'text-right' },
  ];

  const handleOpenAddModal = () => {
    setFormEmployeeId('');
    setFormCurrentRole('');
    setFormProposedRole('');
    setFormReason('');
    setFormAchievements('');
    ps.openAddModal();
  };

  const handleOpenEditModal = (id: string) => {
    const r = promotions.find(i => i.id === id);
    if (r) {
      setFormEmployeeId(r.employeeId);
      setFormCurrentRole(r.currentRole);
      setFormProposedRole(r.proposedRole);
      setFormReason(r.reason);
      setFormAchievements(r.achievements);
    }
    ps.openEditModal(id);
  };

  const handleApprove = async (id: string) => {
    try {
      await hrApi.approvePromotion(id);
      toast('Promotion approved', 'success');
      loadPromotions();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to approve', 'error');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await hrApi.rejectPromotion(id);
      toast('Promotion rejected', 'success');
      loadPromotions();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to reject', 'error');
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        employeeId: formEmployeeId || undefined,
        currentRole: formCurrentRole || undefined,
        proposedRole: formProposedRole || undefined,
        reason: formReason || undefined,
        achievements: formAchievements || undefined,
      };
      if (ps.editingId) {
        await hrApi.updatePromotion(ps.editingId, payload);
        toast('Updated', 'success');
      } else {
        await hrApi.createPromotion(payload);
        toast('Created', 'success');
      }
      ps.closeModal();
      loadPromotions();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to save', 'error');
    }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try {
      await hrApi.deletePromotion(ps.deletingId);
      toast('Deleted', 'success');
      ps.closeConfirmDelete();
      loadPromotions();
    } catch (err: any) {
      toast(err?.response?.data?.error || err?.message || 'Failed to delete', 'error');
    }
  };

  return (
    <HrPageShell title="Promotion Recommendations" description="Manage employee promotion recommendations"
      pageKey="promotions"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Employee ID','Current Role','Proposed Role','Reason','Achievements','Status'], ps.filtered.map(i => [i.employeeId,i.currentRole,i.proposedRole,i.reason,i.achievements,i.status]), 'promotions'); toast('Exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Promotion Recommendations', ['Employee ID','Current Role','Proposed Role','Reason','Status'], ps.filtered.map(i => [i.employeeId,i.currentRole,i.proposedRole,i.reason,i.status]), 'promotions')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={handleOpenAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add New</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employee ID, roles, reasons..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[
          { label: 'All', value: 'all' },
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Cancelled', value: 'cancelled' },
        ]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400 text-sm">Loading promotions...</div>
      ) : fetchError ? (
        <div className="flex items-center justify-center py-16 text-rose-500 text-sm">{fetchError}</div>
      ) : (
        <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
          sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
          selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
          page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
          from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
          emptyMessage="No promotions" emptyAction={<button onClick={handleOpenAddModal} className="text-xs font-medium text-primary">Add</button>} />
      )}
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Promotion' : 'Add Promotion'} onSubmit={handleCreateOrUpdate}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee ID</label><input value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="Employee UUID" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Current Role</label><input value={formCurrentRole} onChange={e => setFormCurrentRole(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Junior Developer" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Proposed Role</label><input value={formProposedRole} onChange={e => setFormProposedRole(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Senior Developer" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Reason</label><textarea value={formReason} onChange={e => setFormReason(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Reason for promotion..." /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Achievements</label><textarea value={formAchievements} onChange={e => setFormAchievements(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" rows={3} placeholder="Key achievements and contributions..." /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Promotion" message="Are you sure you want to delete this promotion recommendation?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Promotion Details">
        {ps.viewingId && (() => { const r = promotions.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-border-custom"><div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center"><Award className="w-5 h-5" /></div><div><p className="text-sm font-semibold text-ink-900">{r.employeeId}</p><p className="text-xs text-ink-400">{r.currentRole} → {r.proposedRole}</p></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Current Role</p><p className="text-sm font-medium text-ink-900 mt-1">{r.currentRole}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Proposed Role</p><p className="text-sm font-medium text-ink-900 mt-1">{r.proposedRole}</p></div></div>
            <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(r.status)}`}>{r.status}</span></div>
            {r.reason && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Reason</p><p className="text-sm text-ink-700">{r.reason}</p></div>}
            {r.achievements && <div><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Achievements</p><p className="text-sm text-ink-700">{r.achievements}</p></div>}
            <div className="grid grid-cols-2 gap-3"><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Recommended By</p><p className="text-sm text-ink-700 mt-1">{r.recommendedBy}</p></div><div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl"><p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Approved By</p><p className="text-sm text-ink-700 mt-1">{r.approvedBy || '—'}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

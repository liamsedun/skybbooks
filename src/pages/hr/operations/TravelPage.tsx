import { useEffect, useMemo, useState } from 'react';
import { Plane, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Clock, CheckCircle2 } from 'lucide-react';
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

interface TravelItem { id: string; employeeName: string; destination: string; dates: string; amount: string; status: string; }
export function OpsTravelPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<TravelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'destination'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getTravelRequests({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  const stats = useMemo(() => [
    { label: 'Total Requests', value: ps.filtered.length.toString(), icon: <Plane className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: ps.filtered.filter(i => i.status === 'pending').length.toString(), icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: ps.filtered.filter(i => i.status === 'approved').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Completed', value: ps.filtered.filter(i => i.status === 'completed').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'cyan' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
  ], [ps.filtered]);
  const columns: Column<TravelItem>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'destination', label: 'Destination', sortable: true },
    { key: 'dates', label: 'Dates' },
    { key: 'amount', label: 'Amount', sortable: true, render: (i) => <span className="font-semibold text-ink-900">{i.amount}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];
  return (
    <HrPageShell title="Travel" description="Travel requests, approvals, itinerary management, and expense reimbursements."
      pageKey="travel"
      headerActions={<><button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Request</button><button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button><button onClick={() => exportToCsv(ps.filtered, 'travel.csv')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search travel requests..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Completed', value: 'completed' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No travel requests found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first request</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Request' : 'Add Request'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Destination</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Travel Dates</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="e.g. Aug 10-14" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Estimated Amount</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete Request" message="Are you sure you want to delete this travel request?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Travel Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Travel Requests" onSubmit={(e) => { e.preventDefault(); showSuccess('Requests imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with travel requests.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}



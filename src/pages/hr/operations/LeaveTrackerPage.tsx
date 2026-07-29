import { useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react';
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

interface LeaveRecord { id: string; employeeName: string; type: string; fromDate: string; toDate: string; days: number; status: string; }
export function OpsLeaveTrackerPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'type'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getLeaveRequests({}); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  const stats = useMemo(() => [
    { label: 'Total Requests', value: ps.filtered.length.toString(), icon: <Calendar className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: ps.filtered.filter(i => i.status === 'pending').length.toString(), icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: ps.filtered.filter(i => i.status === 'approved').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: ps.filtered.filter(i => i.status === 'rejected').length.toString(), icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [ps.filtered]);
  const columns: Column<LeaveRecord>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'type', label: 'Leave Type', sortable: true },
    { key: 'fromDate', label: 'From', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.fromDate)}</span> },
    { key: 'toDate', label: 'To', sortable: true, render: (i) => <span className="text-ink-500">{formatDate(i.toDate)}</span> },
    { key: 'days', label: 'Days', sortable: true, render: (i) => <span className="font-medium">{i.days}</span> },
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
    <HrPageShell title="Leave Tracker" description="Employee leave management, balances, requests, and approval workflow."
      pageKey="leave-requests"
      headerActions={<><button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Leave</button><button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button><button onClick={() => exportToCsv(ps.filtered, 'leaves.csv')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search leaves..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Approved', value: 'approved' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No leave records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first leave record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Leave' : 'Add Leave'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Leave Type</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">From Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">To Date</label><input type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete Leave" message="Are you sure you want to delete this leave record?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Leave Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Leaves" onSubmit={(e) => { e.preventDefault(); showSuccess('Leaves imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with leave records.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}



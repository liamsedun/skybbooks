import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
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

interface ShiftItem { id: string; name: string; startTime: string; endTime: string; department: string; status: string; }
export function OpsShiftPage() {
  const { success: showSuccess, error: showError } = useToast();
  const [data, setData] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'department'], pageSize: 10 });
  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);
  const loadData = async () => {
    setLoading(true);
    try { const result = await hrApi.getShifts(); setData(Array.isArray(result) ? result : []); }
    catch (e: any) { showError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  const stats = useMemo(() => [
    { label: 'Total Shifts', value: ps.filtered.length.toString(), icon: <CalendarDays className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: ps.filtered.filter(i => i.status === 'active').length.toString(), icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: ps.filtered.filter(i => i.status === 'inactive').length.toString(), icon: <XCircle className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [ps.filtered]);
  const columns: Column<ShiftItem>[] = [
    { key: 'name', label: 'Shift Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'startTime', label: 'Start Time', sortable: true },
    { key: 'endTime', label: 'End Time', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
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
    <HrPageShell title="Shift" description="Shift pattern creation, roster assignments, and shift swap management."
      pageKey="shifts"
      headerActions={<><button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Add Shift</button><button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button><button onClick={() => exportToCsv(ps.filtered, 'shifts.csv')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button></>}>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search shifts..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No shifts found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first shift</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Shift' : 'Add Shift'} onSubmit={(e) => { e.preventDefault(); showError('Read-only view'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Shift Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Start Time</label><input type="time" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">End Time</label><input type="time" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showError('Read-only view'); ps.closeConfirmDelete(); }} title="Delete Shift" message="Are you sure you want to delete this shift?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Shift Details"><div className="space-y-3 text-sm text-ink-600"><p>Details content</p></div></HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Shifts" onSubmit={(e) => { e.preventDefault(); showSuccess('Shifts imported'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with shift patterns.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}



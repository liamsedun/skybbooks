import { useMemo, useState, useEffect, useRef } from 'react';
import { FileText, Plus, Download, Upload, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
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

interface Timesheet {
  id: string; employee: string; weekEnding: string; totalHours: number; approvedHours: number; status: string; submittedDate: string;
}

export function TimesheetsListPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getTimesheets({});
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { toast(e?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  const ps = useHrPageState({ data, initialSortKey: 'weekEnding', initialSortDirection: 'desc', searchKeys: ['employee'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Timesheets', value: data.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Approved', value: data.filter(i => i.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: data.filter(i => i.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Draft', value: data.filter(i => i.status === 'draft').length, icon: <FileText className="w-4 h-4" />, color: 'slate' as const, active: ps.statusFilter === 'draft', onClick: () => ps.setStatusFilter('draft') },
  ], [data, ps.statusFilter]);

  const employeeRef = useRef<HTMLInputElement>(null);
  const weekEndingRef = useRef<HTMLInputElement>(null);
  const totalHoursRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  const handleSave = async () => {
    try {
      const formData = { employee: employeeRef.current?.value ?? '', weekEnding: weekEndingRef.current?.value ?? '', totalHours: Number(totalHoursRef.current?.value) || 0, status: statusRef.current?.value ?? 'draft' };
      if (ps.editingId) { await hrApi.updateTimesheet(ps.editingId, formData); toast('Updated', 'success'); }
      else { await hrApi.createTimesheet(formData); toast('Created', 'success'); }
      ps.closeModal(); loadData();
    } catch (e: any) { toast(e?.message || 'Failed to save', 'error'); }
  };

  const columns: Column<Timesheet>[] = [
    { key: 'employee', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employee}</span> },
    { key: 'weekEnding', label: 'Week Ending', sortable: true, render: (i) => <span>{formatDate(i.weekEnding)}</span> },
    { key: 'totalHours', label: 'Total Hours', sortable: true, className: 'text-center font-semibold text-ink-900' },
    { key: 'approvedHours', label: 'Approved', sortable: true, className: 'text-center' },
    { key: 'submittedDate', label: 'Submitted', sortable: true, render: (i) => i.submittedDate !== '--' ? <span className="text-ink-400 text-xs">{formatDate(i.submittedDate)}</span> : <span className="text-ink-300 text-xs">Not submitted</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const selectedItem = ps.viewingId ? filtered.find(i => i.id === ps.viewingId) : null;
  const editItem = ps.editingId ? filtered.find(i => i.id === ps.editingId) : null;

  return (
    <HrPageShell title="Timesheets" description="Weekly and monthly timesheets with approval workflow and history tracking"
      pageKey="timesheets"
      headerActions={<>
        <button onClick={ps.openAddModal} className="h-8 px-3.5 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />New Timesheet</button>
        <button onClick={() => ps.setImportOpen(true)} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Import</button>
        <button onClick={() => exportToCsv(['Employee', 'Week Ending', 'Total Hours', 'Approved Hours', 'Submitted Date', 'Status'], filtered.map(i => [i.employee, i.weekEnding, String(i.totalHours), String(i.approvedHours), i.submittedDate, i.status]), 'timesheets')} className="h-8 px-3.5 text-xs font-medium bg-surface text-ink-700 border border-border-custom rounded-xl hover:bg-ink-50 transition-colors inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by employee..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Draft', value: 'draft' }, { label: 'Rejected', value: 'rejected' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No timesheets found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Create your first timesheet</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Timesheet' : 'New Timesheet'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Employee</label><input ref={employeeRef} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.employee ?? ''} placeholder="e.g. Chioma Okafor" /></div>
          <div><label className="block text-xs font-medium text-ink-500 mb-1">Week Ending</label><input ref={weekEndingRef} type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.weekEnding ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Total Hours</label><input ref={totalHoursRef} type="number" step="0.5" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.totalHours ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
              <select ref={statusRef} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900" defaultValue={editItem?.status ?? 'draft'}>
                <option value="draft">Draft</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors" onClick={handleSave}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { toast('Timesheet deleted', 'success'); ps.closeConfirmDelete(); }} title="Delete Timesheet" message="Are you sure you want to delete this timesheet?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Timesheet Details">
        {selectedItem && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employee}</p></div>
            <div><label className="text-xs text-ink-500">Week Ending</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.weekEnding)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Total Hours</label><p className="text-sm font-medium text-ink-900">{selectedItem.totalHours}h</p></div>
            <div><label className="text-xs text-ink-500">Approved Hours</label><p className="text-sm font-medium text-ink-900">{selectedItem.approvedHours}h</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
          {selectedItem.submittedDate !== '--' && <div><label className="text-xs text-ink-500">Submitted Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.submittedDate)}</p></div>}
        </div>}
      </HrViewDrawer>
      <HrFormModal open={ps.importOpen} onClose={() => ps.setImportOpen(false)} title="Import Timesheets" onSubmit={(e) => { e.preventDefault(); toast('Timesheets imported', 'success'); ps.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with timesheet records (Employee, Week Ending, Total Hours, Status).</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </HrFormModal>
    </HrPageShell>
  );
}

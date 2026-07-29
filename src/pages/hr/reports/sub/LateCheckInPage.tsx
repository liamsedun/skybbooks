import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, Plus, Download, FileText, Edit3, Trash2, Eye, Clock, XCircle, TrendingUp } from 'lucide-react';
import { useHrPageState } from '../../../../hooks/useHrPageState';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor, formatDate } from '../../../../lib/hrExport';
import { useToast } from '../../../../contexts/ToastContext';
import { hrApi } from '../../../../lib/api';

interface LateCheckIn {
  id: string;
  employeeName: string;
  date: string;
  scheduledTime: string;
  actualTime: string;
  minutesLate: number;
  status: 'on_time' | 'late';
}

export function LateCheckInPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data: [], initialSortKey: 'employeeName', searchKeys: ['employeeName', 'status'], pageSize: 10 });
  const { filtered, paginated } = ps;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getReportAttendance({});
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { toast(e?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total Records', value: data.length, icon: <AlertTriangle className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Late Arrivals', value: data.filter((i: any) => i.status === 'late').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'late', onClick: () => ps.setStatusFilter('late') },
    { label: 'On Time', value: data.filter((i: any) => i.status === 'on_time').length, icon: <Clock className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'on_time', onClick: () => ps.setStatusFilter('on_time') },
    { label: 'Avg Late (min)', value: Math.round(data.filter((i: any) => i.status === 'late').reduce((s: number, i: any) => s + i.minutesLate, 0) / Math.max(1, data.filter((i: any) => i.status === 'late').length)), icon: <TrendingUp className="w-4 h-4" />, color: 'amber' as const },
  ], [data, ps.statusFilter]);

  const handleDelete = (id: string) => {
    toast('This is a read-only report view', 'error');
    ps.closeConfirmDelete();
  };

  const columns: Column<LateCheckIn>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (i) => formatDate(i.date) },
    { key: 'scheduledTime', label: 'Scheduled', sortable: true, className: 'text-center' },
    { key: 'actualTime', label: 'Actual', sortable: true, className: 'text-center' },
    { key: 'minutesLate', label: 'Late (min)', sortable: true, render: (i) => <span className="font-semibold text-rose-600">{i.minutesLate} min</span>, className: 'text-center' },
    { key: 'status', label: 'Status', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status.replace('_', ' ')}</span> },
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

  const csvHeaders = ['Employee', 'Date', 'Scheduled Time', 'Actual Time', 'Minutes Late', 'Status'];
  const csvRows = filtered.map(i => [i.employeeName, i.date, i.scheduledTime, i.actualTime, String(i.minutesLate), i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Late Check In" description="Late check-in incidents, repeat offenders, and department-wise lateness trends"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'late-checkin'); toast('CSV exported', 'success'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Late Check In', pdfHeaders, pdfRows, 'late-checkin')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Record</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'late', 'on_time']}
        onExportPdf={() => exportToPdf('Late Check In', pdfHeaders, pdfRows, 'late-checkin')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No late check-in records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Late Check-In' : 'New Late Check-In'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.date ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Minutes Late</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.minutesLate ?? ''} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Scheduled Time</label><input type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.scheduledTime ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Actual Time</label><input type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.actualTime ?? ''} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { toast('This is a read-only report view', 'error'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Record" message="Are you sure you want to delete this late check-in record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Late Check-In Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Date</label><p className="text-sm text-ink-700">{formatDate(selectedItem.date)}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Scheduled</label><p className="text-sm text-ink-700">{selectedItem.scheduledTime}</p></div>
            <div><label className="text-xs text-ink-500">Actual</label><p className="text-sm text-ink-700">{selectedItem.actualTime}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Minutes Late</label><p className="text-sm font-semibold text-rose-600">{selectedItem.minutesLate} min</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status.replace('_', ' ')}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



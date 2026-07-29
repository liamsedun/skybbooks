import { useState, useMemo, useEffect } from 'react';
import { Hourglass, Plus, Download, FileText, Edit3, Trash2, Eye, Clock, Sun, Moon, TrendingUp } from 'lucide-react';
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

interface PresenceRecord {
  id: string;
  employeeName: string;
  month: string;
  expectedHours: number;
  workedHours: number;
  overtime: number;
  status: 'completed' | 'partial' | 'below';
}

export function PresenceHoursPage() {
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data: [], initialSortKey: 'employeeName', searchKeys: ['employeeName', 'month'], pageSize: 10 });
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

  useEffect(() => { ps.setData(data); }, [data]);

  const stats = useMemo(() => [
    { label: 'Total Records', value: data.length, icon: <Hourglass className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Total Hours', value: data.reduce((s: number, i: any) => s + i.workedHours, 0), icon: <Clock className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Overtime (hrs)', value: data.reduce((s: number, i: any) => s + i.overtime, 0), icon: <TrendingUp className="w-4 h-4" />, color: 'amber' as const },
    { label: 'Avg Worked/Expected', value: `${Math.round(data.reduce((s: number, i: any) => s + i.workedHours, 0) / Math.max(1, data.reduce((s: number, i: any) => s + i.expectedHours, 0)) * 100)}%`, icon: <Sun className="w-4 h-4" />, color: 'purple' as const },
  ], [data]);

  const handleDelete = (id: string) => {
    toast('This is a read-only report view', 'error');
    ps.closeConfirmDelete();
  };

  const columns: Column<PresenceRecord>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'month', label: 'Month', sortable: true, render: (i) => {
      const [y, m] = i.month.split('-');
      const d = new Date(+y, +m - 1);
      return <span className="text-sm text-ink-600">{d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>;
    } },
    { key: 'expectedHours', label: 'Expected', sortable: true, className: 'text-center' },
    { key: 'workedHours', label: 'Worked', sortable: true, render: (i) => {
      const pct = i.expectedHours > 0 ? Math.round((i.workedHours / i.expectedHours) * 100) : 0;
      const barColor = pct >= 95 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-rose-500';
      return (
        <div className="flex items-center gap-2 min-w-[100px]">
          <div className="flex-1 h-1.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="text-xs font-medium text-ink-700 w-10 text-right">{i.workedHours}h</span>
        </div>
      );
    } },
    { key: 'overtime', label: 'Overtime', sortable: true, render: (i) => <span className="font-medium text-amber-600">{i.overtime}h</span>, className: 'text-center' },
    { key: 'status', label: 'Status', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
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

  const csvHeaders = ['Employee', 'Month', 'Expected Hours', 'Worked Hours', 'Overtime', 'Status'];
  const csvRows = filtered.map(i => [i.employeeName, i.month, String(i.expectedHours), String(i.workedHours), String(i.overtime), i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Presence Hours" description="Total presence hours per employee, department averages, and monthly trends"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'presence-hours'); toast('CSV exported', 'success'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Presence Hours', pdfHeaders, pdfRows, 'presence-hours')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Record</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'completed', 'partial', 'below']}
        onExportPdf={() => exportToPdf('Presence Hours', pdfHeaders, pdfRows, 'presence-hours')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No presence hour records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Presence Record' : 'New Presence Record'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Month</label><input type="month" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.month ?? ''} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Expected Hours</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.expectedHours ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Worked Hours</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.workedHours ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Overtime</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.overtime ?? ''} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { toast('This is a read-only report view', 'error'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Record" message="Are you sure you want to delete this presence hour record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Presence Hours Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Month</label><p className="text-sm text-ink-700">{selectedItem.month}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">Expected</label><p className="text-sm font-medium text-ink-900">{selectedItem.expectedHours}h</p></div>
            <div><label className="text-xs text-ink-500">Worked</label><p className="text-sm font-medium text-ink-900">{selectedItem.workedHours}h</p></div>
            <div><label className="text-xs text-ink-500">Overtime</label><p className="text-sm font-medium text-amber-600">{selectedItem.overtime}h</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



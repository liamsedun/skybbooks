import { useState, useMemo } from 'react';
import { Calendar, Plus, Download, FileText, Edit3, Trash2, Eye, Clock, Play, Pause, XCircle, CheckCircle2 } from 'lucide-react';
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

interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string;
  lastSent: string;
  nextRun: string;
  status: 'active' | 'paused' | 'failed';
}

const MOCK: ScheduledReport[] = [
  { id: 'SCH-001', name: 'Daily Attendance Summary', frequency: 'daily', recipients: 'hr@company.com', lastSent: '2026-07-27', nextRun: '2026-07-28', status: 'active' },
  { id: 'SCH-002', name: 'Weekly Headcount Update', frequency: 'weekly', recipients: 'managers@company.com', lastSent: '2026-07-25', nextRun: '2026-08-01', status: 'active' },
  { id: 'SCH-003', name: 'Monthly Leave Report', frequency: 'monthly', recipients: 'hr@company.com, finance@company.com', lastSent: '2026-07-01', nextRun: '2026-08-01', status: 'active' },
  { id: 'SCH-004', name: 'Payroll Summary', frequency: 'monthly', recipients: 'finance@company.com', lastSent: '2026-06-30', nextRun: '2026-07-31', status: 'active' },
  { id: 'SCH-005', name: 'Turnover Analysis', frequency: 'monthly', recipients: 'exec@company.com', lastSent: '2026-06-01', nextRun: '2026-07-01', status: 'paused' },
  { id: 'SCH-006', name: 'Training Completion', frequency: 'weekly', recipients: 'training@company.com', lastSent: '2026-07-20', nextRun: '2026-07-27', status: 'paused' },
  { id: 'SCH-007', name: 'Overtime Report', frequency: 'weekly', recipients: 'ops@company.com', lastSent: '2026-07-18', nextRun: '2026-07-25', status: 'failed' },
  { id: 'SCH-008', name: 'Benefits Enrollment', frequency: 'monthly', recipients: 'hr@company.com', lastSent: '2026-06-01', nextRun: '2026-07-01', status: 'failed' },
];

export function ReportsSchedulesPage() {
  const { success } = useToast();
  const [localData, setLocalData] = useState<ScheduledReport[]>(MOCK);
  const ps = useHrPageState({ data: localData, initialSortKey: 'name', searchKeys: ['name', 'recipients', 'frequency'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Schedules', value: localData.length, icon: <Calendar className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: localData.filter(i => i.status === 'active').length, icon: <Play className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Paused', value: localData.filter(i => i.status === 'paused').length, icon: <Pause className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'paused', onClick: () => ps.setStatusFilter('paused') },
    { label: 'Failed', value: localData.filter(i => i.status === 'failed').length, icon: <XCircle className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'failed', onClick: () => ps.setStatusFilter('failed') },
  ], [localData, ps.statusFilter]);

  const handleDelete = (id: string) => {
    setLocalData(prev => prev.filter(i => i.id !== id));
    ps.closeConfirmDelete();
    success('Schedule deleted');
  };

  const columns: Column<ScheduledReport>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'frequency', label: 'Frequency', sortable: true, render: (i) => {
      const colors: Record<string, string> = { daily: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400', weekly: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400', monthly: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400' };
      return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[i.frequency]}`}>{i.frequency}</span>;
    } },
    { key: 'recipients', label: 'Recipients', sortable: true, hideOnMobile: true, render: (i) => <span className="text-xs text-ink-500">{i.recipients}</span> },
    { key: 'lastSent', label: 'Last Sent', sortable: true, render: (i) => formatDate(i.lastSent) },
    { key: 'nextRun', label: 'Next Run', sortable: true, render: (i) => formatDate(i.nextRun) },
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

  const csvHeaders = ['Name', 'Frequency', 'Recipients', 'Last Sent', 'Next Run', 'Status'];
  const csvRows = filtered.map(i => [i.name, i.frequency, i.recipients, formatDate(i.lastSent), formatDate(i.nextRun), i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Schedules" description="Work schedule reports, shift coverage, and scheduling compliance metrics"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'report-schedules'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Report Schedules', pdfHeaders, pdfRows, 'report-schedules')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Schedule</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search schedules..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'paused', 'failed']}
        onExportPdf={() => exportToPdf('Report Schedules', pdfHeaders, pdfRows, 'report-schedules')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No schedules found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add schedule</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Schedule' : 'New Schedule'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Report Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.name ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Frequency</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.frequency ?? 'weekly'}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'active'}>
                <option value="active">Active</option><option value="paused">Paused</option><option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Recipients (comma separated)</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.recipients ?? ''} /></div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editingId ? 'Schedule updated' : 'Schedule created'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Schedule" message="Are you sure you want to delete this schedule? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Schedule Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          <div><label className="text-xs text-ink-500">Frequency</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.frequency}</p></div>
          <div><label className="text-xs text-ink-500">Recipients</label><p className="text-sm text-ink-700">{selectedItem.recipients}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Last Sent</label><p className="text-sm text-ink-700">{formatDate(selectedItem.lastSent)}</p></div>
            <div><label className="text-xs text-ink-500">Next Run</label><p className="text-sm text-ink-700">{formatDate(selectedItem.nextRun)}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



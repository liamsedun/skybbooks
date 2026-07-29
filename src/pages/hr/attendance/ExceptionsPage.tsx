import { useState, useMemo, useEffect } from 'react';
import { Plus, Edit3, Trash2, Eye, CheckCircle2, XCircle, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

export function AttendanceExceptionsPage() {
  const { toast } = useToast();
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await hrApi.getAttendanceExceptions({ pageSize: 500 });
      setExceptions(res?.data ?? []);
    } catch (e) {
      toast('Failed to load exceptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data: exceptions, initialSortKey: 'date', searchKeys: ['type', 'reason', 'employeeId'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Exceptions', value: exceptions.length, icon: <AlertTriangle className="w-4 h-4" />, color: 'blue' as const, active: true, onClick: () => ps.setStatusFilter('all') },
    { label: 'Pending', value: exceptions.filter(i => i.status === 'pending').length, icon: <AlertTriangle className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Approved', value: exceptions.filter(i => i.status === 'approved').length, icon: <ThumbsUp className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Rejected', value: exceptions.filter(i => i.status === 'rejected').length, icon: <ThumbsDown className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [exceptions, ps.statusFilter]);

  const columns: Column<any>[] = [
    { key: 'date', label: 'Date', sortable: true, render: (i) => formatDate(i.date) },
    { key: 'type', label: 'Type', sortable: true, render: (i) => <span className="font-medium text-ink-900 capitalize">{i.type?.replace(/_/g, ' ')}</span> },
    { key: 'reason', label: 'Reason', sortable: true, className: 'max-w-xs truncate' },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-rose-100 text-rose-700' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status] || 'bg-ink-100 text-ink-600'}`}>{i.status}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {i.status === 'pending' && <><button onClick={async () => { try { await hrApi.approveAttendanceException(i.id); toast('Exception approved', 'success'); await fetchData(); } catch { toast('Failed to approve', 'error'); } }} className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors" title="Approve"><ThumbsUp className="w-3.5 h-3.5" /></button>
          <button onClick={async () => { try { await hrApi.rejectAttendanceException(i.id); toast('Exception rejected', 'success'); await fetchData(); } catch { toast('Failed to reject', 'error'); } }} className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors" title="Reject"><ThumbsDown className="w-3.5 h-3.5" /></button></>}
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? filtered.find(i => i.id === ps.viewDrawerId) : null;

  return (
    <HrPageShell title="Attendance Exceptions" description="Manage attendance exceptions and irregularities"
      pageKey="attendance-exceptions"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Exception</button>
        <button onClick={() => exportToCsv(filtered, columns, 'attendance-exceptions')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search type, reason..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'pending', 'approved', 'rejected']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Attendance Exceptions')}
      />
      <HrDataTable columns={columns} data={loading ? [] : paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage={loading ? 'Loading...' : 'No exceptions found'} emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Create exception</button>} />
      <HrFormModal open={ps.addModalOpen} onClose={ps.closeModals} title="New Attendance Exception">
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee ID</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" placeholder="Enter employee ID" /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Type</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900">
              <option value="late">Late Arrival</option><option value="early_departure">Early Departure</option>
              <option value="missed_clock_in">Missed Clock In</option><option value="missed_clock_out">Missed Clock Out</option>
              <option value="forgot_break">Forgot Break</option><option value="other">Other</option>
            </select>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Reason</label><textarea rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" placeholder="Explain the exception reason" /></div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={async () => {
            try { await hrApi.createAttendanceException({}); toast('Exception created', 'success'); ps.closeModals(); await fetchData(); } catch { toast('Failed to create', 'error'); }
          }}>Submit</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={async () => {
        try { await hrApi.deleteAttendanceException(ps.confirmDeleteId!); ps.confirmDelete(); toast('Exception deleted', 'success'); await fetchData(); } catch { toast('Failed to delete', 'error'); }
      }} title="Delete Exception" message="Are you sure you want to delete this exception?" />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Exception Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.date)}</p></div>
          <div><label className="text-xs text-ink-500">Type</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.type?.replace(/_/g, ' ')}</p></div>
          <div><label className="text-xs text-ink-500">Reason</label><p className="text-sm font-medium text-ink-900">{selectedItem.reason}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}

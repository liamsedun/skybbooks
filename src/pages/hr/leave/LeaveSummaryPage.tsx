import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, CheckCircle2, Clock, XCircle, Plus, Download, Eye, Edit3, Trash2 } from 'lucide-react';
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

export function LeaveSummaryPage() {
  const { success, error } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const ps = useHrPageState({ data, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'leaveTypeName'], pageSize: 10 });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { ps.setData(data); }, [data]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requests, emps, ltypes] = await Promise.all([
        hrApi.getLeaveRequests(),
        hrApi.getEmployees(),
        hrApi.getLeaveTypes(),
      ]);
      setData(Array.isArray(requests) ? requests : []);
      setEmployees(Array.isArray(emps) ? emps : []);
      setLeaveTypes(Array.isArray(ltypes) ? ltypes : []);
    } catch (e: any) { error(e?.message || 'Failed to load leave data'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => [
    { label: 'Total Requests', value: data.length, icon: <CalendarDays className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Approved', value: data.filter(i => i.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: data.filter(i => i.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Rejected', value: data.filter(i => i.status === 'rejected').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [data, ps.statusFilter]);

  const openCreate = () => { setEditingId(null); setFormData({}); setFormOpen(true); };
  const openEdit = (id: string) => {
    const item = data.find(i => i.id === id);
    if (item) {
      setEditingId(id);
      setFormData({
        employeeId: item.employeeId,
        leaveTypeId: item.leaveTypeId,
        startDate: item.startDate,
        endDate: item.endDate,
        totalDays: item.totalDays,
        isHalfDay: item.isHalfDay || false,
        reason: item.reason || '',
      });
      setFormOpen(true);
    }
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await hrApi.createLeaveRequest(formData);
        success('Leave request updated');
      } else {
        await hrApi.createLeaveRequest(formData);
        success('Leave request created');
      }
      setFormOpen(false);
      loadData();
    } catch (e: any) { error(e?.message || 'Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    try { await hrApi.cancelLeaveRequest(id); success('Leave request cancelled'); loadData(); ps.closeModals(); }
    catch (e: any) { error(e?.message || 'Failed to cancel'); }
  };

  const columns: Column<any>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'leaveTypeName', label: 'Leave Type', sortable: true },
    { key: 'startDate', label: 'From', sortable: true, render: (i) => formatDate(i.startDate) },
    { key: 'endDate', label: 'To', sortable: true, render: (i) => formatDate(i.endDate) },
    { key: 'totalDays', label: 'Days', sortable: true, className: 'text-center', render: (i) => i.isHalfDay ? '0.5' : i.totalDays },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400', cancelled: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status] || 'bg-ink-100 text-ink-600'}`}>{i.status}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => openEdit(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? data.find(i => i.id === ps.viewDrawerId) : null;
  const { filtered, paginated } = ps;

  return (
    <HrPageShell title="Leave Summary" description="Overview of all leave requests across the organisation"
      pageKey="leave-requests"
      headerActions={<>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Request</button>
        <button onClick={() => exportToCsv(filtered, columns, 'leave-summary')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees or leave type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'approved', 'pending', 'rejected', 'cancelled']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Leave Summary')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id} loading={loading}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No leave requests found" emptyAction={<button onClick={openCreate} className="text-xs font-medium text-primary hover:text-primary-hover">Submit a leave request</button>} />
      <HrFormModal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit Leave Request' : 'New Leave Request'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee *</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.employeeId || ''} onChange={e => setFormData({...formData, employeeId: e.target.value})}>
              <option value="">Select employee...</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Leave Type *</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.leaveTypeId || ''} onChange={e => setFormData({...formData, leaveTypeId: e.target.value, totalDays: formData.totalDays})}>
              <option value="">Select leave type...</option>
              {leaveTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.daysPerYear} days/yr)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Start Date *</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.startDate || ''} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">End Date *</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm"><input type="checkbox" className="rounded mr-2" checked={!!formData.isHalfDay} onChange={e => setFormData({...formData, isHalfDay: e.target.checked, totalDays: e.target.checked ? 0.5 : (formData.totalDays || 1)})} /> Half Day</label>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Total Days</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" value={formData.totalDays || 1} onChange={e => setFormData({...formData, totalDays: parseFloat(e.target.value) || 1})} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Reason</label><textarea className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" rows={3} value={formData.reason || ''} onChange={e => setFormData({...formData, reason: e.target.value})} /></div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={handleSave}>{editingId ? 'Update' : 'Submit'} Request</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => handleDelete(ps.confirmDeleteId!)} title="Cancel Leave Request" message="Are you sure you want to cancel this leave request?" />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Leave Request Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Leave Type</label><p className="text-sm font-medium text-ink-900">{selectedItem.leaveTypeName}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">From</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.startDate)}</p></div>
            <div><label className="text-xs text-ink-500">To</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.endDate)}</p></div>
            <div><label className="text-xs text-ink-500">Days</label><p className="text-sm font-medium text-ink-900">{selectedItem.isHalfDay ? '0.5' : selectedItem.totalDays}</p></div>
          </div>
          {selectedItem.isHalfDay && <div><label className="text-xs text-ink-500">Half Day</label><p className="text-sm font-medium text-ink-900 text-emerald-600">Yes</p></div>}
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
          {selectedItem.approvedBy && <div><label className="text-xs text-ink-500">Approved By</label><p className="text-sm font-medium text-ink-900">{selectedItem.approvedBy}</p></div>}
          {selectedItem.approvedAt && <div><label className="text-xs text-ink-500">Approved At</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.approvedAt)}</p></div>}
          {selectedItem.rejectionReason && <div><label className="text-xs text-ink-500">Rejection Reason</label><p className="text-sm text-rose-600">{selectedItem.rejectionReason}</p></div>}
          {selectedItem.remarks && <div><label className="text-xs text-ink-500">Remarks</label><p className="text-sm text-ink-700">{selectedItem.remarks}</p></div>}
          {selectedItem.recalledAt && <div><label className="text-xs text-ink-500">Recalled At</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.recalledAt)}</p></div>}
          <div><label className="text-xs text-ink-500">Reason</label><p className="text-sm text-ink-700">{selectedItem.reason}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}

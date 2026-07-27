import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, Clock } from 'lucide-react';
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

interface LeaveRequest {
  id: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: 'approved' | 'pending' | 'rejected';
  reason: string;
}

const MOCK: LeaveRequest[] = [
  { id: 'LR001', employeeName: 'Amara Okafor', leaveType: 'Annual', fromDate: '2026-08-01', toDate: '2026-08-12', days: 10, status: 'approved', reason: 'Family vacation' },
  { id: 'LR002', employeeName: 'Chidi Nwosu', leaveType: 'Sick', fromDate: '2026-07-20', toDate: '2026-07-21', days: 2, status: 'approved', reason: 'Malaria' },
  { id: 'LR003', employeeName: 'Fatima Usman', leaveType: 'Maternity', fromDate: '2026-06-01', toDate: '2026-08-31', days: 90, status: 'approved', reason: 'Maternity leave' },
  { id: 'LR004', employeeName: 'Emeka Eze', leaveType: 'Annual', fromDate: '2026-09-05', toDate: '2026-09-09', days: 5, status: 'pending', reason: 'Personal trip' },
  { id: 'LR005', employeeName: 'Yetunde Bello', leaveType: 'Sick', fromDate: '2026-07-28', toDate: '2026-07-28', days: 1, status: 'rejected', reason: 'Doctor appointment' },
  { id: 'LR006', employeeName: 'Segun Adeyemi', leaveType: 'Paternity', fromDate: '2026-08-10', toDate: '2026-08-17', days: 7, status: 'pending', reason: 'New baby' },
  { id: 'LR007', employeeName: 'Ngozi Obi', leaveType: 'Annual', fromDate: '2026-10-01', toDate: '2026-10-08', days: 6, status: 'pending', reason: 'Travel abroad' },
  { id: 'LR008', employeeName: 'Ibrahim Danjuma', leaveType: 'Compassionate', fromDate: '2026-07-15', toDate: '2026-07-16', days: 2, status: 'approved', reason: 'Family event' },
];

export function LeaveRequestsPage() {
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'leaveType'], pageSize: 10 });
  const { filtered, paginated } = ps;
  const [localData, setLocalData] = useState<LeaveRequest[]>(MOCK);

  const stats = useMemo(() => [
    { label: 'Total Requests', value: localData.length, icon: <Clock className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Approved', value: localData.filter(i => i.status === 'approved').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'approved', onClick: () => ps.setStatusFilter('approved') },
    { label: 'Pending', value: localData.filter(i => i.status === 'pending').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'pending', onClick: () => ps.setStatusFilter('pending') },
    { label: 'Rejected', value: localData.filter(i => i.status === 'rejected').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'rejected', onClick: () => ps.setStatusFilter('rejected') },
  ], [localData, ps.statusFilter]);

  const handleApprove = (id: string) => {
    setLocalData(prev => prev.map(i => i.id === id ? { ...i, status: 'approved' as const } : i));
    success('Leave request approved');
  };

  const handleReject = (id: string) => {
    setLocalData(prev => prev.map(i => i.id === id ? { ...i, status: 'rejected' as const } : i));
    success('Leave request rejected');
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span>,
    },
    { key: 'leaveType', label: 'Leave Type', sortable: true },
    { key: 'fromDate', label: 'From', sortable: true, render: (i) => formatDate(i.fromDate) },
    { key: 'toDate', label: 'To', sortable: true, render: (i) => formatDate(i.toDate) },
    { key: 'days', label: 'Days', sortable: true, className: 'text-center' },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status]}`}>{i.status}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {i.status === 'pending' && <>
            <button onClick={() => handleApprove(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleReject(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Reject"><XCircle className="w-3.5 h-3.5" /></button>
          </>}
          <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ), className: 'text-right',
    },
  ];

  const selectedItem = ps.viewDrawerId ? filtered.find(i => i.id === ps.viewDrawerId) : null;
  const editItem = ps.editModalId ? filtered.find(i => i.id === ps.editModalId) : null;

  return (
    <HrPageShell title="Leave Requests" description="Manage and process employee leave requests"
      pageKey="leave-requests"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Request</button>
        <button onClick={() => exportToCsv(filtered, columns, 'leave-requests')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees or leave type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'approved', 'pending', 'rejected']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Leave Requests')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No leave requests found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Submit a leave request</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Leave Request' : 'New Leave Request'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Leave Type</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.leaveType ?? ''}>
              <option>Annual</option><option>Sick</option><option>Maternity</option><option>Paternity</option><option>Compassionate</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">From</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.fromDate ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">To</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.toDate ?? ''} /></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Reason</label><textarea className="w-full px-3 py-2 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" rows={3} defaultValue={editItem?.reason ?? ''} /></div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editModalId ? 'Leave request updated' : 'Leave request submitted'); ps.closeModals(); }}>{ps.editModalId ? 'Update' : 'Submit'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => { ps.confirmDelete(); success('Leave request deleted'); }} title="Delete Leave Request" message="Are you sure you want to delete this leave request? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Leave Request Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Leave Type</label><p className="text-sm font-medium text-ink-900">{selectedItem.leaveType}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">From</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.fromDate)}</p></div>
            <div><label className="text-xs text-ink-500">To</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.toDate)}</p></div>
            <div><label className="text-xs text-ink-500">Days</label><p className="text-sm font-medium text-ink-900">{selectedItem.days}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
          <div><label className="text-xs text-ink-500">Reason</label><p className="text-sm text-ink-700">{selectedItem.reason}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



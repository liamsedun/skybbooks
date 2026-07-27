import { useState, useMemo } from 'react';
import { CalendarCheck, Plus, Download, FileText, Edit3, Trash2, Eye, Umbrella, Briefcase, Heart, Stethoscope } from 'lucide-react';
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

interface LeaveBalance {
  id: string;
  employeeName: string;
  leaveType: string;
  total: number;
  used: number;
  remaining: number;
  status: 'active' | 'low' | 'exhausted';
}

const MOCK: LeaveBalance[] = [
  { id: 'LB-001', employeeName: 'Amara Okafor', leaveType: 'Annual', total: 20, used: 5, remaining: 15, status: 'active' },
  { id: 'LB-002', employeeName: 'Chidi Nwosu', leaveType: 'Annual', total: 20, used: 18, remaining: 2, status: 'low' },
  { id: 'LB-003', employeeName: 'Fatima Usman', leaveType: 'Maternity', total: 90, used: 60, remaining: 30, status: 'active' },
  { id: 'LB-004', employeeName: 'Emeka Eze', leaveType: 'Annual', total: 20, used: 2, remaining: 18, status: 'active' },
  { id: 'LB-005', employeeName: 'Yetunde Bello', leaveType: 'Sick', total: 10, used: 10, remaining: 0, status: 'exhausted' },
  { id: 'LB-006', employeeName: 'Segun Adeyemi', leaveType: 'Annual', total: 20, used: 15, remaining: 5, status: 'low' },
  { id: 'LB-007', employeeName: 'Ngozi Obi', leaveType: 'Annual', total: 20, used: 8, remaining: 12, status: 'active' },
  { id: 'LB-008', employeeName: 'Ibrahim Danjuma', leaveType: 'Sick', total: 10, used: 3, remaining: 7, status: 'active' },
  { id: 'LB-009', employeeName: 'Chioma Adeleke', leaveType: 'Annual', total: 20, used: 20, remaining: 0, status: 'exhausted' },
  { id: 'LB-010', employeeName: 'Tunde Bakare', leaveType: 'Paternity', total: 7, used: 0, remaining: 7, status: 'active' },
];

const leaveTypeIcon: Record<string, React.ReactNode> = {
  Annual: <Umbrella className="w-4 h-4" />,
  Sick: <Stethoscope className="w-4 h-4" />,
  Maternity: <Heart className="w-4 h-4" />,
  Paternity: <Briefcase className="w-4 h-4" />,
};

export function LeaveBalancePage() {
  const { success } = useToast();
  const [localData, setLocalData] = useState<LeaveBalance[]>(MOCK);
  const ps = useHrPageState({ data: localData, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'leaveType'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Records', value: localData.length, icon: <CalendarCheck className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active Balance', value: localData.filter(i => i.status === 'active').length, icon: <Umbrella className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Low Balance', value: localData.filter(i => i.status === 'low').length, icon: <CalendarCheck className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'low', onClick: () => ps.setStatusFilter('low') },
    { label: 'Exhausted', value: localData.filter(i => i.status === 'exhausted').length, icon: <CalendarCheck className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'exhausted', onClick: () => ps.setStatusFilter('exhausted') },
  ], [localData, ps.statusFilter]);

  const handleDelete = (id: string) => {
    setLocalData(prev => prev.filter(i => i.id !== id));
    ps.closeConfirmDelete();
    success('Leave balance record deleted');
  };

  const columns: Column<LeaveBalance>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'leaveType', label: 'Leave Type', sortable: true, render: (i) => (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600">
        {leaveTypeIcon[i.leaveType]} {i.leaveType}
      </span>
    ) },
    { key: 'total', label: 'Total', sortable: true, className: 'text-center' },
    { key: 'used', label: 'Used', sortable: true, className: 'text-center' },
    { key: 'remaining', label: 'Remaining', sortable: true, render: (i) => {
      const pct = i.total > 0 ? Math.round((i.remaining / i.total) * 100) : 0;
      const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-rose-500';
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-medium text-ink-700 w-6 text-right">{i.remaining}</span>
        </div>
      );
    } },
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

  const csvHeaders = ['Employee', 'Leave Type', 'Total', 'Used', 'Remaining', 'Status'];
  const csvRows = filtered.map(i => [i.employeeName, i.leaveType, String(i.total), String(i.used), String(i.remaining), i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Leave Balance" description="Employee leave balances, accrued days, utilised leave, and remaining entitlements"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'leave-balance'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Leave Balance', pdfHeaders, pdfRows, 'leave-balance')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Record</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees or leave type..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'low', 'exhausted']}
        onExportPdf={() => exportToPdf('Leave Balance', pdfHeaders, pdfRows, 'leave-balance')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No leave balance records found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Leave Balance' : 'New Leave Balance'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Leave Type</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.leaveType ?? 'Annual'}>
                <option>Annual</option><option>Sick</option><option>Maternity</option><option>Paternity</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Total Days</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.total ?? ''} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Used</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.used ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Remaining</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.remaining ?? ''} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editingId ? 'Record updated' : 'Record created'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Leave Balance" message="Are you sure you want to delete this leave balance record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Leave Balance Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Leave Type</label><p className="text-sm text-ink-700">{selectedItem.leaveType}</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-ink-500">Total</label><p className="text-sm font-medium text-ink-900">{selectedItem.total}</p></div>
            <div><label className="text-xs text-ink-500">Used</label><p className="text-sm font-medium text-ink-900">{selectedItem.used}</p></div>
            <div><label className="text-xs text-ink-500">Remaining</label><p className="text-sm font-medium text-ink-900">{selectedItem.remaining}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



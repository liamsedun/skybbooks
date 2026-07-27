import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, CalendarRange } from 'lucide-react';
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

interface ShiftAssignment {
  id: string;
  employeeName: string;
  shiftName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'cancelled';
}

const MOCK: ShiftAssignment[] = [
  { id: 'SA001', employeeName: 'Amara Okafor', shiftName: 'Morning Shift', startDate: '2026-07-01', endDate: '2026-07-31', status: 'active' },
  { id: 'SA002', employeeName: 'Chidi Nwosu', shiftName: 'Afternoon Shift', startDate: '2026-07-01', endDate: '2026-07-31', status: 'active' },
  { id: 'SA003', employeeName: 'Fatima Usman', shiftName: 'Morning Shift', startDate: '2026-06-01', endDate: '2026-06-30', status: 'completed' },
  { id: 'SA004', employeeName: 'Emeka Eze', shiftName: 'Night Shift', startDate: '2026-07-15', endDate: '2026-08-15', status: 'active' },
  { id: 'SA005', employeeName: 'Yetunde Bello', shiftName: 'Weekend Shift', startDate: '2026-07-01', endDate: '2026-07-31', status: 'active' },
  { id: 'SA006', employeeName: 'Segun Adeyemi', shiftName: 'Morning Shift', startDate: '2026-07-01', endDate: '2026-07-15', status: 'completed' },
  { id: 'SA007', employeeName: 'Ngozi Obi', shiftName: 'Afternoon Shift', startDate: '2026-07-20', endDate: '2026-08-20', status: 'active' },
  { id: 'SA008', employeeName: 'Ibrahim Danjuma', shiftName: 'Night Shift', startDate: '2026-06-01', endDate: '2026-06-30', status: 'cancelled' },
];

export function ShiftsPage() {
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'shiftName'], pageSize: 10 });
  const { filtered, paginated } = ps;
  const [localData, setLocalData] = useState<ShiftAssignment[]>(MOCK);

  const stats = useMemo(() => [
    { label: 'Total Assignments', value: localData.length, icon: <CalendarRange className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: localData.filter(i => i.status === 'active').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Completed', value: localData.filter(i => i.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Cancelled', value: localData.filter(i => i.status === 'cancelled').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'cancelled', onClick: () => ps.setStatusFilter('cancelled') },
  ], [localData, ps.statusFilter]);

  const columns: Column<ShiftAssignment>[] = [
    {
      key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span>,
    },
    { key: 'shiftName', label: 'Shift', sortable: true },
    { key: 'startDate', label: 'Start Date', sortable: true, render: (i) => formatDate(i.startDate) },
    { key: 'endDate', label: 'End Date', sortable: true, render: (i) => formatDate(i.endDate) },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400', cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status]}`}>{i.status}</span>;
      },
    },
    {
      key: 'actions', label: '', render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
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
    <HrPageShell title="Shift Assignments" description="Manage employee shift assignments"
      pageKey="shifts"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Assignment</button>
        <button onClick={() => exportToCsv(filtered, columns, 'shift-assignments')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees or shifts..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'completed', 'cancelled']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Shift Assignments')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No shift assignments found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Assign a shift</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Shift Assignment' : 'New Shift Assignment'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Shift</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.shiftName ?? 'Morning Shift'}>
              <option>Morning Shift</option><option>Afternoon Shift</option><option>Night Shift</option><option>Weekend Shift</option><option>Standard Shift</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Start Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.startDate ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">End Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.endDate ?? ''} /></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'active'}>
              <option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editModalId ? 'Assignment updated' : 'Assignment created'); ps.closeModals(); }}>{ps.editModalId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => { ps.confirmDelete(); success('Shift assignment deleted'); }} title="Delete Shift Assignment" message="Are you sure you want to delete this shift assignment? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Shift Assignment Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Employee</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Shift</label><p className="text-sm font-medium text-ink-900">{selectedItem.shiftName}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Start Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.startDate)}</p></div>
            <div><label className="text-xs text-ink-500">End Date</label><p className="text-sm font-medium text-ink-900">{formatDate(selectedItem.endDate)}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



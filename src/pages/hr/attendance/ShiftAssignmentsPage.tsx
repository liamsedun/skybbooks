import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Edit3, Trash2, Eye, CalendarRange, CheckCircle2, XCircle, Users } from 'lucide-react';
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

interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  employee: { firstName: string; lastName: string };
  shiftId: string;
  shift: { name: string };
  startDate: string;
  endDate: string;
  status: string;
}

export function ShiftAssignmentsPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await hrApi.getShiftAssignments({ pageSize: 500 });
      const items = (res?.data ?? []).map((a: any) => ({
        ...a,
        employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : a.employeeId,
        shiftName: a.shift?.name ?? 'Unknown',
      }));
      setAssignments(items);
    } catch (e) {
      toast('Failed to load shift assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const ps = useHrPageState({ data: assignments, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'shiftName'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Assignments', value: assignments.length, icon: <CalendarRange className="w-4 h-4" />, color: 'blue' as const, active: true, onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: assignments.filter(i => i.status === 'active').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Completed', value: assignments.filter(i => i.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'completed', onClick: () => ps.setStatusFilter('completed') },
    { label: 'Cancelled', value: assignments.filter(i => i.status === 'cancelled').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'cancelled', onClick: () => ps.setStatusFilter('cancelled') },
  ], [assignments, ps.statusFilter]);

  const columns: Column<ShiftAssignment>[] = [
    {
      key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span>,
    },
    { key: 'shiftName', label: 'Shift', sortable: true },
    { key: 'startDate', label: 'Start Date', sortable: true, render: (i) => formatDate(i.startDate) },
    { key: 'endDate', label: 'End Date', sortable: true, render: (i) => formatDate(i.endDate) },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-rose-100 text-rose-700' };
        return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[i.status] || 'bg-ink-100 text-ink-600'}`}>{i.status}</span>;
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
      pageKey="shift-assignments"
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
      <HrDataTable columns={columns} data={loading ? [] : paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage={loading ? 'Loading...' : 'No shift assignments found'} emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Assign a shift</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Shift Assignment' : 'New Shift Assignment'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee ID</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeId ?? ''} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Shift ID</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.shiftId ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Start Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.startDate ?? ''} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">End Date</label><input type="date" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.endDate ?? ''} /></div>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={async () => {
            try { await (editItem ? hrApi.updateShiftAssignment(editItem.id, {}) : hrApi.assignShift({})); toast(editItem ? 'Assignment updated' : 'Assignment created', 'success'); ps.closeModals(); await fetchData(); } catch { toast('Failed to save', 'error'); }
          }}>{ps.editModalId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={async () => {
        try { await hrApi.deleteShiftAssignment(ps.confirmDeleteId!); ps.confirmDelete(); toast('Shift assignment deleted', 'success'); await fetchData(); } catch { toast('Failed to delete', 'error'); }
      }} title="Delete Shift Assignment" message="Are you sure you want to delete this shift assignment? This action cannot be undone." />
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

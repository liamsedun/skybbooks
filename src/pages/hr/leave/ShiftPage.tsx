import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
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

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string;
  status: 'active' | 'inactive';
}

export function LeaveShiftPage() {
  const { success, error } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await hrApi.getShifts();
      setData(Array.isArray(result) ? result : []);
    } catch (e: any) { error(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const ps = useHrPageState({ data, initialSortKey: 'name', searchKeys: ['name', 'days'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Shifts', value: data.length, icon: <Clock className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: data.filter(i => i.status === 'active').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: data.filter(i => i.status === 'inactive').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [data, ps.statusFilter]);

  const nameRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  const handleSave = async () => {
    try {
      const formData = { name: nameRef.current?.value ?? '', startTime: startTimeRef.current?.value ?? '', endTime: endTimeRef.current?.value ?? '', days: daysRef.current?.value ?? '', status: statusRef.current?.value ?? '' };
      if (ps.editingId) { await hrApi.updateShift(ps.editingId, formData); success('Updated'); }
      else { await hrApi.createShift(formData); success('Created'); }
      ps.closeModal(); loadData();
    } catch (e: any) { error(e?.message || 'Failed to save'); }
  };

  const handleDelete = async () => {
    if (!ps.deletingId) return;
    try { await hrApi.deleteShift(ps.deletingId); success('Deleted'); loadData(); ps.closeConfirmDelete(); }
    catch (e: any) { error(e?.message || 'Failed to delete'); }
  };

  const columns: Column<Shift>[] = [
    {
      key: 'name', label: 'Shift Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span>,
    },
    { key: 'startTime', label: 'Start', sortable: true, className: 'text-center' },
    { key: 'endTime', label: 'End', sortable: true, className: 'text-center' },
    { key: 'days', label: 'Days', sortable: true, className: 'text-center' },
    {
      key: 'status', label: 'Status', sortable: true, render: (i) => {
        const colors: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', inactive: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400' };
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

  const selectedItem = ps.viewingId ? filtered.find(i => i.id === ps.viewingId) : null;
  const editItem = ps.editingId ? filtered.find(i => i.id === ps.editingId) : null;

  return (
    <HrPageShell title="Leave Shifts" description="Manage leave shift schedules"
      pageKey="shifts"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Shift</button>
        <button onClick={() => exportToCsv(filtered, columns, 'leave-shifts')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search shift name or days..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'inactive']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Leave Shifts')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No shifts found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add a shift</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Shift' : 'New Shift'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Shift Name</label><input ref={nameRef} className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.name ?? ''} placeholder="e.g. Morning Shift" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Start Time</label><input ref={startTimeRef} type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.startTime ?? '08:00'} /></div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">End Time</label><input ref={endTimeRef} type="time" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.endTime ?? '17:00'} /></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Working Days</label><input ref={daysRef} className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.days ?? 'Monâ€“Fri'} placeholder="e.g. Monâ€“Fri" /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <select ref={statusRef} className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'active'}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={handleSave}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={handleDelete} title="Delete Shift" message="Are you sure you want to delete this shift? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Shift Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Shift Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Start Time</label><p className="text-sm font-medium text-ink-900">{selectedItem.startTime}</p></div>
            <div><label className="text-xs text-ink-500">End Time</label><p className="text-sm font-medium text-ink-900">{selectedItem.endTime}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Days</label><p className="text-sm font-medium text-ink-900">{selectedItem.days}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}

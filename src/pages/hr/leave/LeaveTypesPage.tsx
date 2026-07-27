import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, FileText, Search, Edit3, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
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

interface LeaveType {
  id: string;
  name: string;
  daysAllowed: number;
  carryForward: 'Yes' | 'No';
  status: 'active' | 'inactive';
}

const MOCK: LeaveType[] = [
  { id: 'LT001', name: 'Annual Leave', daysAllowed: 20, carryForward: 'Yes', status: 'active' },
  { id: 'LT002', name: 'Sick Leave', daysAllowed: 10, carryForward: 'No', status: 'active' },
  { id: 'LT003', name: 'Maternity Leave', daysAllowed: 90, carryForward: 'No', status: 'active' },
  { id: 'LT004', name: 'Paternity Leave', daysAllowed: 7, carryForward: 'No', status: 'active' },
  { id: 'LT005', name: 'Compassionate Leave', daysAllowed: 3, carryForward: 'No', status: 'active' },
  { id: 'LT006', name: 'Study Leave', daysAllowed: 30, carryForward: 'Yes', status: 'inactive' },
];

export function LeaveTypesPage() {
  const { success } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'name', searchKeys: ['name'], pageSize: 10 });
  const { filtered, paginated } = ps;
  const [localData, setLocalData] = useState<LeaveType[]>(MOCK);

  const stats = useMemo(() => [
    { label: 'Total Types', value: localData.length, icon: <FileText className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: localData.filter(i => i.status === 'active').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'green' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: localData.filter(i => i.status === 'inactive').length, icon: <XCircle className="w-4 h-4" />, color: 'red' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [localData, ps.statusFilter]);

  const columns: Column<LeaveType>[] = [
    {
      key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span>,
    },
    { key: 'daysAllowed', label: 'Days Allowed', sortable: true, className: 'text-center' },
    { key: 'carryForward', label: 'Carry Forward', sortable: true, className: 'text-center' },
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

  const selectedItem = ps.viewDrawerId ? filtered.find(i => i.id === ps.viewDrawerId) : null;
  const editItem = ps.editModalId ? filtered.find(i => i.id === ps.editModalId) : null;

  return (
    <HrPageShell title="Leave Types" description="Configure leave types and policies"
      pageKey="leave-requests"
      headerActions={<>
        <button onClick={() => ps.openAddModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> New Type</button>
        <button onClick={() => exportToCsv(filtered, columns, 'leave-types')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search leave types..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'inactive']}
        onExportPdf={() => exportToPdf(filtered, columns, 'Leave Types')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No leave types found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add a leave type</button>} />
      <HrFormModal open={ps.addModalOpen || ps.editModalOpen} onClose={ps.closeModals} title={ps.editModalOpen ? 'Edit Leave Type' : 'New Leave Type'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.name ?? ''} placeholder="e.g. Annual Leave" /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Days Allowed</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.daysAllowed ?? 0} /></div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Carry Forward</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.carryForward ?? 'No'}>
              <option>Yes</option><option>No</option>
            </select>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.status ?? 'active'}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editModalId ? 'Leave type updated' : 'Leave type created'); ps.closeModals(); }}>{ps.editModalId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmDeleteId !== null} onClose={ps.closeModals} onConfirm={() => { ps.confirmDelete(); success('Leave type deleted'); }} title="Delete Leave Type" message="Are you sure you want to delete this leave type? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerId !== null} onClose={ps.closeModals} title="Leave Type Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.name}</p></div>
          <div><label className="text-xs text-ink-500">Days Allowed</label><p className="text-sm font-medium text-ink-900">{selectedItem.daysAllowed}</p></div>
          <div><label className="text-xs text-ink-500">Carry Forward</label><p className="text-sm font-medium text-ink-900">{selectedItem.carryForward}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



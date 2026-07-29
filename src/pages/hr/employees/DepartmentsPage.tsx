import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Users } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { exportToCsv, exportToPdf, statusColor } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';

interface Department {
  id: string; name: string; head: string; employeeCount: number; status: string;
}

const MOCK_DEPARTMENTS: Department[] = [
  { id: '1', name: 'Engineering', head: 'Alice Johnson', employeeCount: 3, status: 'active' },
  { id: '2', name: 'Marketing', head: 'Bob Smith', employeeCount: 2, status: 'active' },
  { id: '3', name: 'Finance', head: 'Carol Williams', employeeCount: 1, status: 'active' },
  { id: '4', name: 'Human Resources', head: 'Eve Davis', employeeCount: 1, status: 'active' },
  { id: '5', name: 'Sales', head: 'Frank Miller', employeeCount: 1, status: 'active' },
  { id: '6', name: 'Operations', head: 'Unassigned', employeeCount: 0, status: 'inactive' },
];

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const pageState = useHrPageState({ data: MOCK_DEPARTMENTS, initialSortKey: 'name', searchKeys: ['name', 'head'], pageSize: 10 });
  const { filtered, paginated, ...rest } = pageState;

  const stats = useMemo(() => [
    { label: 'Total Departments', value: MOCK_DEPARTMENTS.length, icon: <Building className="w-4 h-4" />, color: 'blue' as const, active: pageState.statusFilter === 'all', onClick: () => pageState.setStatusFilter('all') },
    { label: 'Active', value: MOCK_DEPARTMENTS.filter(d => d.status === 'active').length, icon: <Building className="w-4 h-4" />, color: 'emerald' as const, active: pageState.statusFilter === 'active', onClick: () => pageState.setStatusFilter('active') },
    { label: 'Inactive', value: MOCK_DEPARTMENTS.filter(d => d.status === 'inactive').length, icon: <Building className="w-4 h-4" />, color: 'rose' as const, active: pageState.statusFilter === 'inactive', onClick: () => pageState.setStatusFilter('inactive') },
    { label: 'Total Employees', value: MOCK_DEPARTMENTS.reduce((s, d) => s + d.employeeCount, 0), icon: <Users className="w-4 h-4" />, color: 'purple' as const },
  ], [pageState.statusFilter]);

  const statusFiltered = useMemo(() => {
    if (pageState.statusFilter === 'all') return filtered;
    return filtered.filter(d => d.status === pageState.statusFilter);
  }, [filtered, pageState.statusFilter]);

  const statFilteredPaginated = useMemo(() => {
    const start = (pageState.page - 1) * pageState.pageSize;
    return statusFiltered.slice(start, start + pageState.pageSize);
  }, [statusFiltered, pageState.page, pageState.pageSize]);

  const columns: Column<Department>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (item) => <span className="font-medium text-ink-900">{item.name}</span> },
    { key: 'head', label: 'Head', sortable: true, render: (item) => <span className="text-ink-600">{item.head}</span> },
    { key: 'employeeCount', label: 'Employees', sortable: true, render: (item) => <span className="text-ink-600">{item.employeeCount}</span> },
    { key: 'status', label: 'Status', render: (item) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span> },
    { key: 'actions', label: '', render: (item) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => { pageState.openViewDrawer(item.id); pageState.setViewingId(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => pageState.openEditModal(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => pageState.openConfirmDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const viewingDept = pageState.viewingId ? MOCK_DEPARTMENTS.find(d => d.id === pageState.viewingId) : null;
  const editingDept = pageState.editingId ? MOCK_DEPARTMENTS.find(d => d.id === pageState.editingId) : null;

  const handleExportCsv = () => {
    exportToCsv(['Name', 'Head', 'Employees', 'Status'], statusFiltered.map(d => [d.name, d.head, String(d.employeeCount), d.status]), 'departments');
    toast('Exported successfully', 'success');
  };

  return (
    <HrPageShell title="Departments" description="Manage organisational departments"
      pageKey="departments"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Departments', ['Name','Head','Employees','Status'], statusFiltered.map(d => [d.name, d.head, String(d.employeeCount), d.status]), 'departments')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={pageState.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Department</button>
        </>
      }>

      <HrStatCards items={stats} columns={4} />

      <HrFilterBar search={pageState.search} onSearchChange={pageState.setSearch} searchPlaceholder="Search departments..."
        statusFilter={pageState.statusFilter} onStatusChange={pageState.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={pageState.clearFilters} hasActiveFilters={pageState.hasActiveFilters} />

      {pageState.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{pageState.selectedIds.length} selected</span>
          <button className="text-xs font-medium text-rose-600 hover:text-rose-700 transition-colors">Delete Selected</button>
        </div>
      )}

      <HrDataTable columns={columns} data={statFilteredPaginated} keyExtractor={i => i.id}
        sortKey={pageState.sortKey as string} sortDir={pageState.sortDir} onSort={(k) => pageState.handleSort(k as keyof Department)}
        selectedIds={pageState.selectedIds} onSelectOne={pageState.handleSelectOne} onSelectAll={pageState.handleSelectAll}
        page={pageState.page} totalPages={pageState.totalPages} onPageChange={pageState.setPage} pageSize={pageState.pageSize} totalItems={statusFiltered.length}
        from={(pageState.page - 1) * pageState.pageSize + 1} to={Math.min(pageState.page * pageState.pageSize, statusFiltered.length)}
        emptyMessage="No departments found" emptyAction={<button onClick={pageState.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first department</button>} />

      <HrFormModal open={pageState.modalOpen} onClose={pageState.closeModal} title={pageState.editingId ? 'Edit Department' : 'Add Department'} onSubmit={(e) => { e.preventDefault(); toast(pageState.editingId ? 'Department updated' : 'Department created', 'success'); pageState.closeModal(); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Department Name</label>
            <input defaultValue={editingDept?.name || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="e.g. Engineering" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Department Head</label>
            <input defaultValue={editingDept?.head || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
            <select defaultValue={editingDept?.status || 'active'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={pageState.confirmOpen} onClose={pageState.closeConfirmDelete} onConfirm={() => { toast('Department deleted', 'success'); pageState.closeConfirmDelete(); }} title="Delete Department" message="Are you sure? This action cannot be undone." confirmLabel="Delete" variant="danger" />

      <HrViewDrawer open={pageState.viewDrawerOpen} onClose={pageState.closeViewDrawer} title={viewingDept?.name || 'Department Details'}>
        {viewingDept && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Building className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold text-ink-900">{viewingDept.name}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingDept.status)}`}>{viewingDept.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Department Head</p>
                <p className="text-sm text-ink-700 mt-1">{viewingDept.head}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Employees</p>
                <p className="text-sm text-ink-700 mt-1">{viewingDept.employeeCount}</p>
              </div>
            </div>
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}



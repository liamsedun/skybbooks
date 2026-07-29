import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Download, Upload, FileText, Edit3, Trash2, Eye, Layers } from 'lucide-react';
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

interface Designation {
  id: string; name: string; department: string; level: number; status: string;
}

const MOCK_DESIGNATIONS: Designation[] = [
  { id: '1', name: 'Junior Developer', department: 'Engineering', level: 1, status: 'active' },
  { id: '2', name: 'Senior Developer', department: 'Engineering', level: 3, status: 'active' },
  { id: '3', name: 'DevOps Engineer', department: 'Engineering', level: 3, status: 'active' },
  { id: '4', name: 'Marketing Lead', department: 'Marketing', level: 3, status: 'active' },
  { id: '5', name: 'Content Writer', department: 'Marketing', level: 1, status: 'inactive' },
  { id: '6', name: 'Accountant', department: 'Finance', level: 2, status: 'active' },
  { id: '7', name: 'HR Manager', department: 'Human Resources', level: 4, status: 'active' },
  { id: '8', name: 'Sales Rep', department: 'Sales', level: 1, status: 'active' },
];

export function DesignationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const pageState = useHrPageState({ data: MOCK_DESIGNATIONS, initialSortKey: 'name', searchKeys: ['name', 'department'], pageSize: 10 });
  const { filtered, paginated, ...rest } = pageState;

  const stats = useMemo(() => [
    { label: 'Total Designations', value: MOCK_DESIGNATIONS.length, icon: <Briefcase className="w-4 h-4" />, color: 'blue' as const, active: pageState.statusFilter === 'all', onClick: () => pageState.setStatusFilter('all') },
    { label: 'Active', value: MOCK_DESIGNATIONS.filter(d => d.status === 'active').length, icon: <Briefcase className="w-4 h-4" />, color: 'emerald' as const, active: pageState.statusFilter === 'active', onClick: () => pageState.setStatusFilter('active') },
    { label: 'Inactive', value: MOCK_DESIGNATIONS.filter(d => d.status === 'inactive').length, icon: <Briefcase className="w-4 h-4" />, color: 'rose' as const, active: pageState.statusFilter === 'inactive', onClick: () => pageState.setStatusFilter('inactive') },
    { label: 'Levels', value: new Set(MOCK_DESIGNATIONS.map(d => d.level)).size, icon: <Layers className="w-4 h-4" />, color: 'purple' as const },
  ], [pageState.statusFilter]);

  const statusFiltered = useMemo(() => {
    if (pageState.statusFilter === 'all') return filtered;
    return filtered.filter(d => d.status === pageState.statusFilter);
  }, [filtered, pageState.statusFilter]);

  const statFilteredPaginated = useMemo(() => {
    const start = (pageState.page - 1) * pageState.pageSize;
    return statusFiltered.slice(start, start + pageState.pageSize);
  }, [statusFiltered, pageState.page, pageState.pageSize]);

  const columns: Column<Designation>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (item) => <span className="font-medium text-ink-900">{item.name}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (item) => <span className="text-ink-600">{item.department}</span> },
    { key: 'level', label: 'Level', sortable: true, render: (item) => (
      <div className="flex items-center gap-1.5">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold ${
          item.level >= 4 ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400' :
          item.level >= 3 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' :
          item.level >= 2 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
          'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400'
        }`}>{item.level}</div>
        <span className="text-[11px] text-ink-400">
          {item.level === 1 ? 'Entry' : item.level === 2 ? 'Mid' : item.level === 3 ? 'Senior' : item.level === 4 ? 'Lead' : 'Exec'}
        </span>
      </div>
    ) },
    { key: 'status', label: 'Status', render: (item) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span> },
    { key: 'actions', label: '', render: (item) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => { pageState.openViewDrawer(item.id); pageState.setViewingId(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => pageState.openEditModal(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => pageState.openConfirmDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const viewingDesig = pageState.viewingId ? MOCK_DESIGNATIONS.find(d => d.id === pageState.viewingId) : null;
  const editingDesig = pageState.editingId ? MOCK_DESIGNATIONS.find(d => d.id === pageState.editingId) : null;

  const handleExportCsv = () => {
    exportToCsv(['Name', 'Department', 'Level', 'Status'], statusFiltered.map(d => [d.name, d.department, String(d.level), d.status]), 'designations');
    toast('Exported successfully', 'success');
  };

  return (
    <HrPageShell title="Designations" description="Manage job titles and grade levels"
      pageKey="departments"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Designations', ['Name','Department','Level','Status'], statusFiltered.map(d => [d.name, d.department, String(d.level), d.status]), 'designations')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={pageState.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Designation</button>
        </>
      }>

      <HrStatCards items={stats} columns={4} />

      <HrFilterBar search={pageState.search} onSearchChange={pageState.setSearch} searchPlaceholder="Search designations..."
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
        sortKey={pageState.sortKey as string} sortDir={pageState.sortDir} onSort={(k) => pageState.handleSort(k as keyof Designation)}
        selectedIds={pageState.selectedIds} onSelectOne={pageState.handleSelectOne} onSelectAll={pageState.handleSelectAll}
        page={pageState.page} totalPages={pageState.totalPages} onPageChange={pageState.setPage} pageSize={pageState.pageSize} totalItems={statusFiltered.length}
        from={(pageState.page - 1) * pageState.pageSize + 1} to={Math.min(pageState.page * pageState.pageSize, statusFiltered.length)}
        emptyMessage="No designations found" emptyAction={<button onClick={pageState.openAddModal} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first designation</button>} />

      <HrFormModal open={pageState.modalOpen} onClose={pageState.closeModal} title={pageState.editingId ? 'Edit Designation' : 'Add Designation'} onSubmit={(e) => { e.preventDefault(); toast(pageState.editingId ? 'Designation updated' : 'Designation created', 'success'); pageState.closeModal(); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Designation Name</label>
            <input defaultValue={editingDesig?.name || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="e.g. Senior Developer" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Department</label>
            <select defaultValue={editingDesig?.department || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Select department</option>
              <option value="Engineering">Engineering</option>
              <option value="Marketing">Marketing</option>
              <option value="Finance">Finance</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Level</label>
            <select defaultValue={editingDesig?.level || 1} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value={1}>1 - Entry</option>
              <option value={2}>2 - Mid</option>
              <option value={3}>3 - Senior</option>
              <option value={4}>4 - Lead</option>
              <option value={5}>5 - Executive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
            <select defaultValue={editingDesig?.status || 'active'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={pageState.confirmOpen} onClose={pageState.closeConfirmDelete} onConfirm={() => { toast('Designation deleted', 'success'); pageState.closeConfirmDelete(); }} title="Delete Designation" message="Are you sure? This action cannot be undone." confirmLabel="Delete" variant="danger" />

      <HrViewDrawer open={pageState.viewDrawerOpen} onClose={pageState.closeViewDrawer} title={viewingDesig?.name || 'Designation Details'}>
        {viewingDesig && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Briefcase className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold text-ink-900">{viewingDesig.name}</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingDesig.status)}`}>{viewingDesig.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Department</p>
                <p className="text-sm text-ink-700 mt-1">{viewingDesig.department}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Level</p>
                <p className="text-sm text-ink-700 mt-1">{viewingDesig.level}</p>
              </div>
            </div>
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}



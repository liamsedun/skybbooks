import { useMemo } from 'react';
import { Users, UserCheck, UserX, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface EmployeeProfile {
  id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  status: string;
}

const MOCK: EmployeeProfile[] = [
  { id: '1', name: 'Alice Johnson', department: 'Engineering', designation: 'Senior Developer', email: 'alice@company.com', phone: '+234 801 234 5678', status: 'active' },
  { id: '2', name: 'Bob Smith', department: 'Marketing', designation: 'Marketing Lead', email: 'bob@company.com', phone: '+234 802 345 6789', status: 'active' },
  { id: '3', name: 'Carol White', department: 'Human Resources', designation: 'HR Manager', email: 'carol@company.com', phone: '+234 803 456 7890', status: 'active' },
  { id: '4', name: 'David Brown', department: 'Finance', designation: 'Accountant', email: 'david@company.com', phone: '+234 804 567 8901', status: 'active' },
  { id: '5', name: 'Eve Davis', department: 'Engineering', designation: 'Frontend Developer', email: 'eve@company.com', phone: '+234 805 678 9012', status: 'inactive' },
  { id: '6', name: 'Frank Miller', department: 'Operations', designation: 'Operations Manager', email: 'frank@company.com', phone: '+234 806 789 0123', status: 'active' },
  { id: '7', name: 'Grace Wilson', department: 'Sales', designation: 'Sales Executive', email: 'grace@company.com', phone: '+234 807 890 1234', status: 'active' },
  { id: '8', name: 'Hank Moore', department: 'Engineering', designation: 'Backend Developer', email: 'hank@company.com', phone: '+234 808 901 2345', status: 'inactive' },
  { id: '9', name: 'Ivy Taylor', department: 'Human Resources', designation: 'Recruiter', email: 'ivy@company.com', phone: '+234 809 012 3456', status: 'active' },
  { id: '10', name: 'Jack Anderson', department: 'Finance', designation: 'CFO', email: 'jack@company.com', phone: '+234 810 123 4567', status: 'inactive' },
];

export function EmployeeProfilesPage() {
  const { success: showSuccess } = useToast();
  const ps = useHrPageState({ data: MOCK, initialSortKey: 'name', searchKeys: ['name', 'email', 'department', 'designation'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Employees', value: MOCK.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: MOCK.filter(i => i.status === 'active').length, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: MOCK.filter(i => i.status === 'inactive').length, icon: <UserX className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [ps.statusFilter]);

  const columns: Column<EmployeeProfile>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (i) => <span className="text-ink-600">{i.department}</span> },
    { key: 'designation', label: 'Designation', render: (i) => <span className="text-ink-500">{i.designation}</span> },
    { key: 'email', label: 'Email', render: (i) => <span className="text-ink-500">{i.email}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openEditModal(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Employee Profiles" description="View and manage employee profiles"
      pageKey="manage"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Department', 'Designation', 'Email', 'Phone', 'Status'], MOCK.map(p => [p.name, p.department, p.designation, p.email, p.phone, p.status]), 'employee-profiles'); showSuccess('Profiles exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Employee Profiles', ['Name', 'Department', 'Designation', 'Status'], MOCK.map(p => [p.name, p.department, p.designation, p.status]), 'employee-profiles')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Employee</button>
        </>
      }>
      <HrStatCards items={stats} columns={3} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name, email, department..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={ps.clearFilters} hasActiveFilters={ps.hasActiveFilters} />
      {ps.selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
          <span className="text-sm text-ink-600">{ps.selectedIds.length} selected</span>
          <button onClick={() => { showSuccess('Profiles deleted'); ps.setSelectedIds([]); }} className="text-xs font-medium text-rose-600 hover:text-rose-700">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage="No profiles found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add your first employee</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Employee' : 'Add Employee'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'Employee updated' : 'Employee created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Email</label><input type="email" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Designation</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Phone</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => { showSuccess('Profile deleted'); ps.closeConfirmDelete(); }} title="Delete Profile" message="Are you sure you want to delete this employee profile?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Employee Details">
        {ps.viewingId && (() => { const e = MOCK.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="flex items-center gap-3 pb-3 border-b border-border-custom"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{e.name.charAt(0)}</div><div><p className="font-semibold text-ink-900">{e.name}</p><p className="text-ink-400 text-xs">{e.email}</p></div></div>
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Department</p><p className="font-medium text-ink-900">{e.department}</p></div><div><p className="text-ink-400 text-xs">Designation</p><p className="font-medium text-ink-900">{e.designation}</p></div><div><p className="text-ink-400 text-xs">Phone</p><p className="font-medium text-ink-900">{e.phone}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{e.status}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



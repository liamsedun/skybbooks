import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, UserPlus, Plus, Download, Upload, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface Employee {
  id: string; name: string; email: string; department: string; designation: string; status: string; joinDate: string; phone: string;
}

const MOCK_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', designation: 'Senior Developer', status: 'active', joinDate: '2023-01-15', phone: '+234 801 234 5678' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', designation: 'Marketing Lead', status: 'active', joinDate: '2022-06-01', phone: '+234 802 345 6789' },
  { id: '3', name: 'Carol Williams', email: 'carol@example.com', department: 'Finance', designation: 'Accountant', status: 'active', joinDate: '2024-03-10', phone: '+234 803 456 7890' },
  { id: '4', name: 'David Brown', email: 'david@example.com', department: 'Engineering', designation: 'Junior Developer', status: 'inactive', joinDate: '2023-09-20', phone: '+234 804 567 8901' },
  { id: '5', name: 'Eve Davis', email: 'eve@example.com', department: 'HR', designation: 'HR Manager', status: 'active', joinDate: '2021-11-01', phone: '+234 805 678 9012' },
  { id: '6', name: 'Frank Miller', email: 'frank@example.com', department: 'Sales', designation: 'Sales Rep', status: 'active', joinDate: '2024-07-15', phone: '+234 806 789 0123' },
  { id: '7', name: 'Grace Wilson', email: 'grace@example.com', department: 'Marketing', designation: 'Content Writer', status: 'inactive', joinDate: '2023-04-05', phone: '+234 807 890 1234' },
  { id: '8', name: 'Henry Taylor', email: 'henry@example.com', department: 'Engineering', designation: 'DevOps Engineer', status: 'active', joinDate: '2025-01-10', phone: '+234 808 901 2345' },
];

export function EmployeeList() {
  const navigate = useNavigate();
  const { success: showSuccess } = useToast();
  const pageState = useHrPageState({ data: MOCK_EMPLOYEES, initialSortKey: 'name', searchKeys: ['name', 'email', 'department'], pageSize: 10 });
  const { filtered, paginated, ...rest } = pageState;

  const newThisMonth = useMemo(() => MOCK_EMPLOYEES.filter(e => {
    const d = new Date(e.joinDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length, []);

  const stats = useMemo(() => [
    { label: 'Total Employees', value: MOCK_EMPLOYEES.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: pageState.statusFilter === 'all', onClick: () => pageState.setStatusFilter('all') },
    { label: 'Active', value: MOCK_EMPLOYEES.filter(e => e.status === 'active').length, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const, active: pageState.statusFilter === 'active', onClick: () => pageState.setStatusFilter('active') },
    { label: 'Inactive', value: MOCK_EMPLOYEES.filter(e => e.status === 'inactive').length, icon: <UserX className="w-4 h-4" />, color: 'rose' as const, active: pageState.statusFilter === 'inactive', onClick: () => pageState.setStatusFilter('inactive') },
    { label: 'New this Month', value: newThisMonth, icon: <UserPlus className="w-4 h-4" />, color: 'purple' as const },
  ], [pageState.statusFilter, newThisMonth]);

  const statusFiltered = useMemo(() => {
    if (pageState.statusFilter === 'all') return filtered;
    return filtered.filter(e => e.status === pageState.statusFilter);
  }, [filtered, pageState.statusFilter]);

  const statFilteredPaginated = useMemo(() => {
    const start = (pageState.page - 1) * pageState.pageSize;
    return statusFiltered.slice(start, start + pageState.pageSize);
  }, [statusFiltered, pageState.page, pageState.pageSize]);

  const columns: Column<Employee>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (item) => <span className="font-medium text-ink-900">{item.name}</span> },
    { key: 'email', label: 'Email', sortable: true, render: (item) => <span className="text-ink-500">{item.email}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (item) => <span>{item.department}</span> },
    { key: 'designation', label: 'Designation', sortable: true, render: (item) => <span>{item.designation}</span> },
    { key: 'status', label: 'Status', render: (item) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span> },
    { key: 'joinDate', label: 'Joined', sortable: true, render: (item) => <span className="text-ink-400 text-xs">{formatDate(item.joinDate)}</span>, hideOnMobile: true },
    { key: 'actions', label: '', render: (item) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => { pageState.openViewDrawer(item.id); pageState.setViewingId(item.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => navigate(`/app/hr/employees/edit/${item.id}`)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => pageState.openConfirmDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const viewingEmployee = pageState.viewingId ? MOCK_EMPLOYEES.find(e => e.id === pageState.viewingId) : null;
  const editingEmployee = pageState.editingId ? MOCK_EMPLOYEES.find(e => e.id === pageState.editingId) : null;

  const handleExportCsv = () => {
    exportToCsv(['Name', 'Email', 'Department', 'Designation', 'Status', 'Join Date', 'Phone'], statusFiltered.map(i => [i.name, i.email, i.department, i.designation, i.status, i.joinDate, i.phone]), 'employees');
    showSuccess('Exported successfully');
  };

  return (
    <HrPageShell title="Employees" description="Manage your workforce"
      pageKey="employees"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Employees', ['Name','Email','Department','Designation','Status','Join Date','Phone'], statusFiltered.map(i => [i.name, i.email, i.department, i.designation, i.status, i.joinDate, i.phone]), 'employees')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => pageState.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={() => navigate('/app/hr/employees/add')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Employee</button>
        </>
      }>

      <HrStatCards items={stats} columns={4} />

      <HrFilterBar search={pageState.search} onSearchChange={pageState.setSearch} searchPlaceholder="Search by name, email or department..."
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
        sortKey={pageState.sortKey as string} sortDir={pageState.sortDir} onSort={(k) => pageState.handleSort(k as keyof Employee)}
        selectedIds={pageState.selectedIds} onSelectOne={pageState.handleSelectOne} onSelectAll={pageState.handleSelectAll}
        page={pageState.page} totalPages={pageState.totalPages} onPageChange={pageState.setPage} pageSize={pageState.pageSize} totalItems={statusFiltered.length}
        from={(pageState.page - 1) * pageState.pageSize + 1} to={Math.min(pageState.page * pageState.pageSize, statusFiltered.length)}
        emptyMessage="No employees found" emptyAction={<button onClick={() => navigate('/app/hr/employees/add')} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first employee</button>}
        onRowClick={(item) => navigate(`/app/hr/employees/${item.id}`)} />

      <HrFormModal open={pageState.modalOpen} onClose={pageState.closeModal} title={pageState.editingId ? 'Edit Employee' : 'Add Employee'} onSubmit={(e) => { e.preventDefault(); showSuccess(pageState.editingId ? 'Employee updated' : 'Employee created'); pageState.closeModal(); }}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Full Name</label>
            <input defaultValue={editingEmployee?.name || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="John Doe" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Email</label>
            <input defaultValue={editingEmployee?.email || ''} type="email" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="john@example.com" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Department</label>
            <select defaultValue={editingEmployee?.department || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Select department</option>
              <option value="Engineering">Engineering</option>
              <option value="Marketing">Marketing</option>
              <option value="Finance">Finance</option>
              <option value="HR">HR</option>
              <option value="Sales">Sales</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Designation</label>
            <input defaultValue={editingEmployee?.designation || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Senior Developer" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Phone</label>
            <input defaultValue={editingEmployee?.phone || ''} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="+234 800 000 0000" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-ink-500 mb-1">Join Date</label>
            <input defaultValue={editingEmployee?.joinDate || ''} type="date" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Status</label>
            <select defaultValue={editingEmployee?.status || 'active'} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={pageState.confirmOpen} onClose={pageState.closeConfirmDelete} onConfirm={() => { showSuccess('Employee deleted'); pageState.closeConfirmDelete(); }} title="Delete Employee" message="Are you sure? This action cannot be undone." confirmLabel="Delete" variant="danger" />

      <HrViewDrawer open={pageState.viewDrawerOpen} onClose={pageState.closeViewDrawer} title={viewingEmployee?.name || 'Employee Details'}>
        {viewingEmployee && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-ink-50 dark:bg-ink-800/50 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">{viewingEmployee.name.charAt(0)}</div>
              <div>
                <p className="font-semibold text-ink-900">{viewingEmployee.name}</p>
                <p className="text-xs text-ink-400">{viewingEmployee.designation}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Email</p>
                <p className="text-sm text-ink-700 mt-1">{viewingEmployee.email}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm text-ink-700 mt-1">{viewingEmployee.phone}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Department</p>
                <p className="text-sm text-ink-700 mt-1">{viewingEmployee.department}</p>
              </div>
              <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
                <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Joined</p>
                <p className="text-sm text-ink-700 mt-1">{formatDate(viewingEmployee.joinDate)}</p>
              </div>
            </div>
            <div className="p-3 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Status</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${statusColor(viewingEmployee.status)}`}>{viewingEmployee.status}</span>
            </div>
          </div>
        )}
      </HrViewDrawer>

      <HrFormModal open={pageState.importOpen} onClose={() => pageState.setImportOpen(false)} title="Import Employees" onSubmit={(e) => { e.preventDefault(); showSuccess('Import completed'); pageState.setImportOpen(false); }} submitLabel="Import">
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with columns: Name, Email, Department, Designation, Phone, Join Date.</p>
        <input type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}



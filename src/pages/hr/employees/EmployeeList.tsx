import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, UserPlus, Plus, Download, Upload, FileText, Edit3, Trash2, Eye } from 'lucide-react';
import { useHrPageState } from '../../../hooks/useHrPageState';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { exportToCsv, exportToPdf, handleFileUpload, statusColor, formatDate } from '../../../lib/hrExport';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  joinDate: string;
  phone: string;
}

export function EmployeeList() {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const pageState = useHrPageState({
    data: employees,
    initialSortKey: 'name',
    searchKeys: ['name', 'email', 'department'] as (keyof Employee)[],
    pageSize: 10,
  });

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await hrApi.getEmployees();
      const list = Array.isArray(res) ? res : (res.data ?? []);
      setEmployees(list);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load employees';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const statusFiltered = useMemo(() => {
    if (pageState.statusFilter === 'all') return pageState.filtered;
    return pageState.filtered.filter(e => e.status === pageState.statusFilter);
  }, [pageState.filtered, pageState.statusFilter]);

  const paginatedData = useMemo(() => {
    const start = (pageState.page - 1) * pageState.pageSize;
    return statusFiltered.slice(start, start + pageState.pageSize);
  }, [statusFiltered, pageState.page, pageState.pageSize]);

  const stats = useMemo(() => [
    { label: 'Total Employees', value: employees.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: pageState.statusFilter === 'all', onClick: () => pageState.setStatusFilter('all') },
    { label: 'Active', value: employees.filter(e => e.status === 'active').length, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const, active: pageState.statusFilter === 'active', onClick: () => pageState.setStatusFilter('active') },
    { label: 'Inactive', value: employees.filter(e => e.status === 'inactive').length, icon: <UserX className="w-4 h-4" />, color: 'rose' as const, active: pageState.statusFilter === 'inactive', onClick: () => pageState.setStatusFilter('inactive') },
    { label: 'New this Month', value: employees.filter(e => { const d = new Date(e.joinDate); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length, icon: <UserPlus className="w-4 h-4" />, color: 'purple' as const },
  ], [employees, pageState.statusFilter]);

  const columns: Column<Employee>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (item) => <span className="font-medium text-ink-900">{item.name}</span> },
    { key: 'email', label: 'Email', sortable: true, render: (item) => <span className="text-ink-500">{item.email}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (item) => <span>{item.department}</span> },
    { key: 'designation', label: 'Designation', sortable: true, render: (item) => <span>{item.designation}</span> },
    { key: 'status', label: 'Status', render: (item) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(item.status)}`}>{item.status}</span> },
    { key: 'joinDate', label: 'Joined', sortable: true, render: (item) => <span className="text-ink-400 text-xs">{formatDate(item.joinDate)}</span>, hideOnMobile: true },
    { key: 'actions', label: '', render: (item) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => navigate(`/app/hr/employees/${item.id}`)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => navigate(`/app/hr/employees/${item.id}/edit`)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => pageState.openConfirmDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  const viewingEmployee = pageState.viewingId ? employees.find(e => e.id === pageState.viewingId) : null;

  const handleExportCsv = () => {
    const rows = statusFiltered.map(i => [i.name, i.email, i.department, i.designation, i.status, i.joinDate, i.phone || '']);
    exportToCsv(['Name', 'Email', 'Department', 'Designation', 'Status', 'Join Date', 'Phone'], rows, 'employees');
    showSuccess('CSV exported successfully');
  };

  const handleDelete = async () => {
    if (!pageState.deletingId) return;
    setDeleteLoading(true);
    try {
      await hrApi.softDeleteEmployee(pageState.deletingId);
      showSuccess('Employee deleted');
      pageState.closeConfirmDelete();
      fetchEmployees();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Failed to delete employee');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.length) {
      showError('Please select a CSV file');
      return;
    }
    setImportLoading(true);
    try {
      const text = await handleFileUpload({ target: { files: fileInputRef.current.files } } as any);
      await hrApi.bulkImportEmployees({ csvData: text });
      showSuccess('Import completed');
      pageState.setImportOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchEmployees();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const totalCount = statusFiltered.length;
  const from = totalCount === 0 ? 0 : (pageState.page - 1) * pageState.pageSize + 1;
  const to = Math.min(pageState.page * pageState.pageSize, totalCount);

  return (
    <HrPageShell title="Employees" description="Manage your workforce"
      pageKey="employees"
      headerActions={
        <>
          <button onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => {
            const rows = statusFiltered.map(i => [i.name, i.email, i.department, i.designation, i.status, i.joinDate, i.phone || '']);
            exportToPdf('Employees', ['Name','Email','Department','Designation','Status','Join Date','Phone'], rows, 'employees');
            showSuccess('PDF exported successfully');
          }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={() => pageState.setImportOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={() => navigate('/app/hr/employees/new')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Employee</button>
        </>
      }>

      <HrStatCards items={stats} columns={4} />

      <HrFilterBar search={pageState.search} onSearchChange={pageState.setSearch} searchPlaceholder="Search by name, email or department..."
        statusFilter={pageState.statusFilter} onStatusChange={pageState.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]}
        onClear={pageState.clearFilters} hasActiveFilters={pageState.hasActiveFilters} />

      <HrDataTable columns={columns} data={paginatedData} keyExtractor={i => i.id}
        loading={loading} error={fetchError}
        sortKey={pageState.sortKey as string} sortDir={pageState.sortDir} onSort={(k) => pageState.handleSort(k as keyof Employee)}
        selectedIds={pageState.selectedIds} onSelectOne={pageState.handleSelectOne} onSelectAll={pageState.handleSelectAll}
        page={pageState.page} totalPages={Math.ceil(totalCount / pageState.pageSize)} onPageChange={pageState.setPage}
        pageSize={pageState.pageSize} totalItems={totalCount}
        from={from} to={to}
        emptyMessage={loading ? 'Loading employees...' : fetchError || 'No employees found'}
        emptyAction={!loading && !fetchError ? <button onClick={() => navigate('/app/hr/employees/new')} className="text-xs font-medium text-primary hover:text-primary-hover">Add your first employee</button> : undefined}
        onRowClick={(item) => navigate(`/app/hr/employees/${item.id}`)} />

      <HrConfirmDialog open={pageState.confirmOpen} onClose={pageState.closeConfirmDelete}
        onConfirm={handleDelete} title="Delete Employee"
        message="Are you sure? This action cannot be undone."
        confirmLabel="Delete" variant="danger" loading={deleteLoading} />

      <HrViewDrawer open={pageState.viewDrawerOpen} onClose={pageState.closeViewDrawer}
        title={viewingEmployee?.name || 'Employee Details'}>
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

      <HrFormModal open={pageState.importOpen} onClose={() => { pageState.setImportOpen(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
        title="Import Employees" onSubmit={handleImport} submitLabel={importLoading ? 'Importing...' : 'Import'} loading={importLoading}>
        <p className="text-sm text-ink-400 mb-3">Upload a CSV file with columns: Name, Email, Department, Designation, Phone, Join Date, Status.</p>
        <input ref={fileInputRef} type="file" accept=".csv" className="block w-full text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-colors" />
      </HrFormModal>
    </HrPageShell>
  );
}

import { useState, useMemo } from 'react';
import { Info, Plus, Download, FileText, Edit3, Trash2, Eye, Users, GraduationCap, Calendar, Building2 } from 'lucide-react';
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

interface EmployeeSnapshot {
  id: string;
  employeeName: string;
  department: string;
  age: number;
  tenure: string;
  education: string;
  status: 'active' | 'inactive' | 'on_leave';
}

const MOCK: EmployeeSnapshot[] = [
  { id: 'ES-001', employeeName: 'Amara Okafor', department: 'Engineering', age: 32, tenure: '4 yrs 2 mo', education: 'B.Sc Computer Science', status: 'active' },
  { id: 'ES-002', employeeName: 'Chidi Nwosu', department: 'Finance', age: 41, tenure: '7 yrs 1 mo', education: 'MBA Finance', status: 'active' },
  { id: 'ES-003', employeeName: 'Fatima Usman', department: 'Marketing', age: 28, tenure: '2 yrs 6 mo', education: 'B.Sc Mass Comm', status: 'active' },
  { id: 'ES-004', employeeName: 'Emeka Eze', department: 'Engineering', age: 35, tenure: '5 yrs 0 mo', education: 'M.Sc Software Eng', status: 'active' },
  { id: 'ES-005', employeeName: 'Yetunde Bello', department: 'HR', age: 45, tenure: '10 yrs 3 mo', education: 'CIPM Certified', status: 'active' },
  { id: 'ES-006', employeeName: 'Segun Adeyemi', department: 'Operations', age: 30, tenure: '3 yr 8 mo', education: 'B.Sc Logistics', status: 'on_leave' },
  { id: 'ES-007', employeeName: 'Ngozi Obi', department: 'Legal', age: 38, tenure: '6 yr 0 mo', education: 'LLB, BL', status: 'active' },
  { id: 'ES-008', employeeName: 'Ibrahim Danjuma', department: 'Finance', age: 50, tenure: '12 yr 5 mo', education: 'ACA, ACCA', status: 'active' },
  { id: 'ES-009', employeeName: 'Chioma Adeleke', department: 'Marketing', age: 26, tenure: '1 yr 2 mo', education: 'B.Sc Marketing', status: 'inactive' },
  { id: 'ES-010', employeeName: 'Tunde Bakare', department: 'Engineering', age: 29, tenure: '2 yr 0 mo', education: 'B.Eng Electrical', status: 'active' },
];

export function ReportsEmployeeInformationPage() {
  const { success } = useToast();
  const [localData, setLocalData] = useState<EmployeeSnapshot[]>(MOCK);
  const ps = useHrPageState({ data: localData, initialSortKey: 'employeeName', searchKeys: ['employeeName', 'department', 'education'], pageSize: 10 });
  const { filtered, paginated } = ps;

  const stats = useMemo(() => [
    { label: 'Total Employees', value: localData.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: localData.filter(i => i.status === 'active').length, icon: <Info className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'On Leave', value: localData.filter(i => i.status === 'on_leave').length, icon: <Calendar className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'on_leave', onClick: () => ps.setStatusFilter('on_leave') },
    { label: 'Departments', value: [...new Set(localData.map(i => i.department))].length, icon: <Building2 className="w-4 h-4" />, color: 'purple' as const },
  ], [localData, ps.statusFilter]);

  const handleDelete = (id: string) => {
    setLocalData(prev => prev.filter(i => i.id !== id));
    ps.closeConfirmDelete();
    success('Employee record deleted');
  };

  const columns: Column<EmployeeSnapshot>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.employeeName}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (i) => <span className="text-xs font-medium text-ink-500 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{i.department}</span> },
    { key: 'age', label: 'Age', sortable: true, className: 'text-center' },
    { key: 'tenure', label: 'Tenure', sortable: true },
    { key: 'education', label: 'Education', sortable: true, hideOnMobile: true },
    { key: 'status', label: 'Status', sortable: true, render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status.replace('_', ' ')}</span> },
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

  const csvHeaders = ['Employee', 'Department', 'Age', 'Tenure', 'Education', 'Status'];
  const csvRows = filtered.map(i => [i.employeeName, i.department, String(i.age), i.tenure, i.education, i.status]);
  const pdfHeaders = csvHeaders;
  const pdfRows = csvRows;

  return (
    <HrPageShell title="Employee Information" description="Comprehensive employee data reports including demographics and job details"
      pageKey="reports"
      headerActions={<>
        <button onClick={() => { exportToCsv(csvHeaders, csvRows, 'employee-information'); success('CSV exported'); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> CSV</button>
        <button onClick={() => exportToPdf('Employee Information', pdfHeaders, pdfRows, 'employee-information')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> PDF</button>
        <button onClick={ps.openAddModal} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add Record</button>
      </>}>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar
        searchValue={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search employees..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter} statusOptions={['all', 'active', 'inactive', 'on_leave']}
        onExportPdf={() => exportToPdf('Employee Information', pdfHeaders, pdfRows, 'employee-information')}
      />
      <HrDataTable columns={columns} data={paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, filtered.length)}
        emptyMessage="No employee data found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add employee record</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Employee Record' : 'New Employee Record'}>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Employee Name</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.employeeName ?? ''} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Department</label>
              <select className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.department ?? ''}>
                <option>Engineering</option><option>Finance</option><option>Marketing</option><option>HR</option><option>Operations</option><option>Legal</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-ink-600 mb-1">Age</label><input type="number" className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.age ?? ''} /></div>
          </div>
          <div><label className="block text-xs font-medium text-ink-600 mb-1">Education</label><input className="w-full h-9 px-3 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-900" defaultValue={editItem?.education ?? ''} /></div>
          <button className="w-full h-9 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors" onClick={() => { success(ps.editingId ? 'Record updated' : 'Record created'); ps.closeModal(); }}>{ps.editingId ? 'Update' : 'Create'}</button>
        </div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Employee Record" message="Are you sure you want to delete this employee record? This action cannot be undone." />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Employee Details">
        {selectedItem && <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Name</label><p className="text-sm font-medium text-ink-900">{selectedItem.employeeName}</p></div>
          <div><label className="text-xs text-ink-500">Department</label><p className="text-sm text-ink-700">{selectedItem.department}</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-ink-500">Age</label><p className="text-sm font-medium text-ink-900">{selectedItem.age}</p></div>
            <div><label className="text-xs text-ink-500">Tenure</label><p className="text-sm font-medium text-ink-900">{selectedItem.tenure}</p></div>
          </div>
          <div><label className="text-xs text-ink-500">Education</label><p className="text-sm text-ink-700">{selectedItem.education}</p></div>
          <div><label className="text-xs text-ink-500">Status</label><p className="text-sm font-medium text-ink-900 capitalize">{selectedItem.status.replace('_', ' ')}</p></div>
        </div>}
      </HrViewDrawer>
    </HrPageShell>
  );
}



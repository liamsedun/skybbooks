import { useMemo, useState, useEffect } from 'react';
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
import { hrApi } from '../../../lib/api';

interface EmployeeProfile {
  id: string;
  name: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  status: string;
}

export function EmployeeProfilesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const ps = useHrPageState({ data: profiles, initialSortKey: 'name', searchKeys: ['name', 'email', 'department', 'designation'], pageSize: 10 });
  const [formData, setFormData] = useState({ name: '', email: '', department: '', designation: '', phone: '', departmentId: '', designationId: '' });
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const data = await hrApi.getEmployees();
      const list: EmployeeProfile[] = (Array.isArray(data) ? data : []).map((e: any) => ({
        id: e.id,
        name: [e.firstName, e.lastName].filter(Boolean).join(' ') || '',
        department: e.departmentName || '',
        designation: e.designationTitle || '',
        email: e.email || '',
        phone: e.phone || '',
        status: e.isActive ? 'active' : 'inactive',
      }));
      setProfiles(list);
    } catch (err) {
      toast('Failed to load employee profiles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentsDesignations = async () => {
    try {
      const [depts, desigs] = await Promise.all([hrApi.getDepartments(), hrApi.getDesignations()]);
      setDepartments(Array.isArray(depts) ? depts : []);
      setDesignations(Array.isArray(desigs) ? desigs : []);
    } catch (_) {}
  };

  useEffect(() => { fetchProfiles(); fetchDepartmentsDesignations(); }, []);

  const stats = useMemo(() => [
    { label: 'Total Employees', value: profiles.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: profiles.filter(i => i.status === 'active').length, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Inactive', value: profiles.filter(i => i.status === 'inactive').length, icon: <UserX className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [profiles, ps.statusFilter]);

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteEmployee(id);
      setProfiles(prev => prev.filter(p => p.id !== id));
      ps.closeConfirmDelete();
      toast('Profile deleted', 'success');
    } catch (err) {
      toast('Failed to delete profile', 'error');
    }
  };

  const handleBatchDelete = async () => {
    try {
      for (const id of ps.selectedIds) {
        await hrApi.deleteEmployee(id);
      }
      setProfiles(prev => prev.filter(p => !ps.selectedIds.includes(p.id)));
      ps.setSelectedIds([]);
      toast('Profiles deleted', 'success');
    } catch (err) {
      toast('Failed to delete some profiles', 'error');
    }
  };

  const openAddForm = () => {
    setFormData({ name: '', email: '', department: '', designation: '', phone: '', departmentId: '', designationId: '' });
    ps.openAddModal();
  };

  const openEditForm = (id: string) => {
    const e = profiles.find(p => p.id === id);
    if (e) {
      const dept = departments.find(d => d.name === e.department || d.departmentName === e.department);
      const desig = designations.find(d => d.title === e.designation || d.name === e.designation);
      setFormData({ name: e.name, email: e.email, department: e.department, designation: e.designation, phone: e.phone, departmentId: dept?.id || '', designationId: desig?.id || '' });
    }
    ps.openEditModal(id);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nameParts = formData.name.split(' ').filter(Boolean);
      const payload: Record<string, any> = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: formData.email,
        phone: formData.phone,
      };
      if (formData.departmentId) payload.departmentId = formData.departmentId;
      if (formData.designationId) payload.designationId = formData.designationId;
      if (ps.editingId) {
        await hrApi.updateEmployee(ps.editingId, payload);
        toast('Employee updated', 'success');
      } else {
        await hrApi.createEmployee(payload);
        toast('Employee created', 'success');
      }
      ps.closeModal();
      await fetchProfiles();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to save employee', 'error');
    }
  };

  const columns: Column<EmployeeProfile>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'department', label: 'Department', sortable: true, render: (i) => <span className="text-ink-600">{i.department}</span> },
    { key: 'designation', label: 'Designation', render: (i) => <span className="text-ink-500">{i.designation}</span> },
    { key: 'email', label: 'Email', render: (i) => <span className="text-ink-500">{i.email}</span> },
    { key: 'status', label: 'Status', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor(i.status)}`}>{i.status}</span> },
    { key: 'actions', label: '', render: (i) => (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => ps.openViewDrawer(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-primary hover:bg-primary/10 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
        <button onClick={() => openEditForm(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={() => ps.openConfirmDelete(i.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    ), className: 'text-right' },
  ];

  return (
    <HrPageShell title="Employee Profiles" description="View and manage employee profiles"
      pageKey="manage"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Department', 'Designation', 'Email', 'Phone', 'Status'], profiles.map(p => [p.name, p.department, p.designation, p.email, p.phone, p.status]), 'employee-profiles');         toast('Profiles exported', 'success'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Employee Profiles', ['Name', 'Department', 'Designation', 'Status'], profiles.map(p => [p.name, p.department, p.designation, p.status]), 'employee-profiles')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={openAddForm} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add Employee</button>
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
          <button onClick={handleBatchDelete} className="text-xs font-medium text-rose-600 hover:text-rose-700">Delete Selected</button>
        </div>
      )}
      <HrDataTable columns={columns} data={ps.paginated} keyExtractor={i => i.id}
        sortKey={ps.sortKey as string} sortDir={ps.sortDir} onSort={(k) => ps.handleSort(k as any)}
        selectedIds={ps.selectedIds} onSelectOne={ps.handleSelectOne} onSelectAll={ps.handleSelectAll}
        page={ps.page} totalPages={ps.totalPages} onPageChange={ps.setPage} pageSize={ps.pageSize} totalItems={ps.filtered.length}
        from={(ps.page - 1) * ps.pageSize + 1} to={Math.min(ps.page * ps.pageSize, ps.filtered.length)}
        emptyMessage={loading ? 'Loading...' : 'No profiles found'} emptyAction={!loading ? <button onClick={openAddForm} className="text-xs font-medium text-primary">Add your first employee</button> : undefined} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit Employee' : 'Add Employee'} onSubmit={handleFormSubmit}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name</label><input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Email</label><input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" required /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Department</label>
          <select value={formData.departmentId} onChange={e => { const d = departments.find(d => d.id === e.target.value); setFormData(f => ({ ...f, departmentId: e.target.value, department: d ? (d.name || d.departmentName) : '' })); }} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            <option value="">Select Department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name || d.departmentName}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Designation</label>
          <select value={formData.designationId} onChange={e => { const d = designations.find(d => d.id === e.target.value); setFormData(f => ({ ...f, designationId: e.target.value, designation: d ? (d.title || d.name) : '' })); }} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            <option value="">Select Designation</option>
            {designations.map(d => <option key={d.id} value={d.id}>{d.title || d.name}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Phone</label><input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete Profile" message="Are you sure you want to delete this employee profile?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="Employee Details">
        {ps.viewingId && (() => { const e = profiles.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="flex items-center gap-3 pb-3 border-b border-border-custom"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{e.name.charAt(0)}</div><div><p className="font-semibold text-ink-900">{e.name}</p><p className="text-ink-400 text-xs">{e.email}</p></div></div>
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Department</p><p className="font-medium text-ink-900">{e.department}</p></div><div><p className="text-ink-400 text-xs">Designation</p><p className="font-medium text-ink-900">{e.designation}</p></div><div><p className="text-ink-400 text-xs">Phone</p><p className="font-medium text-ink-900">{e.phone}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{e.status}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}

import { useMemo, useState } from 'react';
import { Users, UserCheck, UserX, Clock, Plus, Download, FileText, Edit3, Trash2, Eye } from 'lucide-react';
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

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: string;
  status: string;
}

const INITIAL_USERS: UserItem[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@company.com', role: 'admin', lastLogin: '2026-07-25', status: 'active' },
  { id: '2', name: 'Bob Smith', email: 'bob@company.com', role: 'manager', lastLogin: '2026-07-24', status: 'active' },
  { id: '3', name: 'Carol White', email: 'carol@company.com', role: 'hr', lastLogin: '2026-07-23', status: 'active' },
  { id: '4', name: 'David Brown', email: 'david@company.com', role: 'user', lastLogin: '2026-07-20', status: 'active' },
  { id: '5', name: 'Eve Davis', email: 'eve@company.com', role: 'user', lastLogin: '2026-07-10', status: 'invited' },
  { id: '6', name: 'Frank Miller', email: 'frank@company.com', role: 'user', lastLogin: '2026-06-15', status: 'active' },
  { id: '7', name: 'Grace Wilson', email: 'grace@company.com', role: 'manager', lastLogin: '2026-07-01', status: 'inactive' },
  { id: '8', name: 'Hank Moore', email: 'hank@company.com', role: 'user', lastLogin: '2026-05-20', status: 'inactive' },
  { id: '9', name: 'Ivy Taylor', email: 'ivy@company.com', role: 'hr', lastLogin: '2026-07-26', status: 'active' },
  { id: '10', name: 'Jack Anderson', email: 'jack@company.com', role: 'user', lastLogin: '', status: 'invited' },
];

export function UsersPage() {
  const { success: showSuccess } = useToast();
  const [users, setUsers] = useState<UserItem[]>(INITIAL_USERS);
  const ps = useHrPageState({ data: users, initialSortKey: 'name', searchKeys: ['name', 'email'], pageSize: 10 });

  const stats = useMemo(() => [
    { label: 'Total Users', value: users.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const, active: ps.statusFilter === 'all', onClick: () => ps.setStatusFilter('all') },
    { label: 'Active', value: users.filter(i => i.status === 'active').length, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const, active: ps.statusFilter === 'active', onClick: () => ps.setStatusFilter('active') },
    { label: 'Invited', value: users.filter(i => i.status === 'invited').length, icon: <Clock className="w-4 h-4" />, color: 'amber' as const, active: ps.statusFilter === 'invited', onClick: () => ps.setStatusFilter('invited') },
    { label: 'Disabled', value: users.filter(i => i.status === 'inactive').length, icon: <UserX className="w-4 h-4" />, color: 'rose' as const, active: ps.statusFilter === 'inactive', onClick: () => ps.setStatusFilter('inactive') },
  ], [users, ps.statusFilter]);

  const handleDelete = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    ps.closeConfirmDelete();
    showSuccess('User deleted');
  };

  const handleBatchDelete = () => {
    setUsers(prev => prev.filter(u => !ps.selectedIds.includes(u.id)));
    ps.setSelectedIds([]);
    showSuccess('Users deleted');
  };

  const columns: Column<UserItem>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (i) => <span className="font-medium text-ink-900">{i.name}</span> },
    { key: 'email', label: 'Email', sortable: true, render: (i) => <span className="text-ink-500">{i.email}</span> },
    { key: 'role', label: 'Role', render: (i) => <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${i.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400' : i.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400' : i.role === 'hr' ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>{i.role}</span> },
    { key: 'lastLogin', label: 'Last Login', sortable: true, render: (i) => <span className="text-ink-500">{i.lastLogin ? formatDate(i.lastLogin) : 'Ã¢â‚¬â€'}</span> },
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
    <HrPageShell title="Users" description="Manage system users and their access levels"
      pageKey="manage"
      headerActions={
        <>
          <button onClick={() => { exportToCsv(['Name', 'Email', 'Role', 'Last Login', 'Status'], users.map(u => [u.name, u.email, u.role, u.lastLogin || 'N/A', u.status]), 'users'); showSuccess('Users exported'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
          <button onClick={() => exportToPdf('Users', ['Name', 'Email', 'Role', 'Status'], users.map(u => [u.name, u.email, u.role, u.status]), 'users')} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all"><FileText className="w-3.5 h-3.5" /> PDF</button>
          <button onClick={ps.openAddModal} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /> Add User</button>
        </>
      }>
      <HrStatCards items={stats} columns={4} />
      <HrFilterBar search={ps.search} onSearchChange={ps.setSearch} searchPlaceholder="Search by name or email..."
        statusFilter={ps.statusFilter} onStatusChange={ps.setStatusFilter}
        statusOptions={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Invited', value: 'invited' }, { label: 'Disabled', value: 'inactive' }]}
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
        emptyMessage="No users found" emptyAction={<button onClick={ps.openAddModal} className="text-xs font-medium text-primary">Add your first user</button>} />
      <HrFormModal open={ps.modalOpen} onClose={ps.closeModal} title={ps.editingId ? 'Edit User' : 'Add User'} onSubmit={(e) => { e.preventDefault(); showSuccess(ps.editingId ? 'User updated' : 'User created'); ps.closeModal(); }}>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Name</label><input className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Email</label><input type="email" className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" /></div>
        <div><label className="block text-xs font-medium text-ink-500 mb-1">Role</label><select className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"><option>admin</option><option>manager</option><option>hr</option><option>user</option></select></div>
      </HrFormModal>
      <HrConfirmDialog open={ps.confirmOpen} onClose={ps.closeConfirmDelete} onConfirm={() => handleDelete(ps.deletingId!)} title="Delete User" message="Are you sure you want to delete this user?" confirmLabel="Delete" variant="danger" />
      <HrViewDrawer open={ps.viewDrawerOpen} onClose={ps.closeViewDrawer} title="User Details">
        {ps.viewingId && (() => { const u = users.find(i => i.id === ps.viewingId)!; return (
          <div className="space-y-3 text-sm text-ink-600">
            <div className="flex items-center gap-3 pb-3 border-b border-border-custom"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{u.name.charAt(0)}</div><div><p className="font-semibold text-ink-900">{u.name}</p><p className="text-ink-400 text-xs">{u.email}</p></div></div>
            <div className="grid grid-cols-2 gap-4"><div><p className="text-ink-400 text-xs">Role</p><p className="font-medium text-ink-900 capitalize">{u.role}</p></div><div><p className="text-ink-400 text-xs">Status</p><p className="font-medium text-ink-900 capitalize">{u.status}</p></div><div className="col-span-2"><p className="text-ink-400 text-xs">Last Login</p><p className="font-medium text-ink-900">{u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</p></div></div>
          </div>
        );})()}
      </HrViewDrawer>
    </HrPageShell>
  );
}



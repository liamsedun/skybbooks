import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformUsersApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import {
  Users, UserPlus, Search, Shield, Loader2, Mail, User, Calendar,
  MoreHorizontal, CheckCircle2, XCircle, Lock, Edit2, Trash2, X, RefreshCw,
} from 'lucide-react';

const PLATFORM_ROLES = [
  'super_admin', 'admin', 'billing_manager', 'support_manager', 'analyst',
  'developer', 'security_auditor', 'marketing_manager', 'onboarding_specialist',
  'compliance_officer', 'viewer',
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Full system access',
  admin: 'Administrative access',
  billing_manager: 'Billing management',
  support_manager: 'Support & tickets',
  analyst: 'Read-only analytics',
  developer: 'API & integration',
  security_auditor: 'Audit & compliance',
  marketing_manager: 'Marketing & campaigns',
  onboarding_specialist: 'Org onboarding',
  compliance_officer: 'Regulatory compliance',
  viewer: 'Read-only overview',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface PlatformUser {
  id: string; email: string; fullName: string | null; role: string;
  isActive: boolean; lastLogin: string | null; createdAt: string;
}

export function PlatformUsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [resettingPass, setResettingPass] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', page, search, roleFilter],
    queryFn: async () => {
      const res = await platformUsersApi.list({ page, pageSize: 20, search: search || undefined, role: roleFilter || undefined });
      return res.data as { data: PlatformUser[]; total: number; page: number; pageSize: number };
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => platformUsersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-users'] }); toast.toast('User deleted', 'success'); },
    onError: (err: any) => toast.toast(err.response?.data?.error || 'Failed to delete user', 'error'),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Users</h1>
          <p className="text-sm text-gray-500 mt-1">Manage platform administrator accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => qc.invalidateQueries({ queryKey: ['platform-users'] })} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border rounded-lg bg-white">
          <option value="">All roles</option>
          {PLATFORM_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3 font-medium text-gray-600">Name</th>
              <th className="text-left p-3 font-medium text-gray-600">Email</th>
              <th className="text-left p-3 font-medium text-gray-600">Role</th>
              <th className="text-left p-3 font-medium text-gray-600">Status</th>
              <th className="text-left p-3 font-medium text-gray-600">Last Login</th>
              <th className="text-left p-3 font-medium text-gray-600">Created</th>
              <th className="text-right p-3 font-medium text-gray-600 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : !data?.data?.length ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">No platform users found</td></tr>
            ) : (
              data.data.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium flex items-center gap-2"><User className="w-4 h-4 text-gray-400" />{u.fullName || '—'}</td>
                  <td className="p-3 text-gray-600">{u.email}</td>
                  <td className="p-3"><span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{u.role}</span></td>
                  <td className="p-3">{u.isActive ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span> : <span className="text-xs text-red-600 flex items-center gap-1"><XCircle className="w-3 h-3" /> Inactive</span>}</td>
                  <td className="p-3 text-gray-500 text-xs">{u.lastLogin ? fmtDate(u.lastLogin) : 'Never'}</td>
                  <td className="p-3 text-gray-500 text-xs">{fmtDate(u.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditingUser(u)} className="p-1.5 hover:bg-gray-100 rounded" title="Edit"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => setResettingPass(u.id)} className="p-1.5 hover:bg-gray-100 rounded" title="Reset password"><Lock className="w-4 h-4 text-gray-500" /></button>
                      {u.role !== 'super_admin' && (
                        <button onClick={() => { if (confirm('Delete this platform user?')) deleteMut.mutate(u.id); }} className="p-1.5 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.total > 20 && (
          <div className="px-3 py-3 border-t flex items-center justify-between">
            <p className="text-xs text-gray-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />}
      {resettingPass && <ResetPasswordModal userId={resettingPass} onClose={() => setResettingPass(null)} />}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'viewer', isActive: true });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await platformUsersApi.create(form);
      toast.toast('User created successfully', 'success');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      onClose();
    } catch (err: any) {
      toast.toast(err.response?.data?.error || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create Platform User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
          <input type="text" required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Jane Doe" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="jane@example.com" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
          <input type="password" required minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Min 6 characters" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-white">
            {PLATFORM_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')} — {ROLE_DESCRIPTIONS[r]}</option>)}
          </select></div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
          <label htmlFor="active" className="text-sm text-gray-600">Active on creation</label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: user.fullName || '', role: user.role, isActive: user.isActive });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await platformUsersApi.update(user.id, form);
      toast.toast('User updated', 'success');
      qc.invalidateQueries({ queryKey: ['platform-users'] });
      onClose();
    } catch (err: any) {
      toast.toast(err.response?.data?.error || 'Failed to update user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Edit: ${user.fullName || user.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
          <input type="text" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-white">
            {PLATFORM_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select></div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="edit-active" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
          <label htmlFor="edit-active" className="text-sm text-gray-600">Active</label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.toast('Password must be at least 6 characters', 'error'); return; }
    setSubmitting(true);
    try {
      await platformUsersApi.updatePassword(userId, password);
      toast.toast('Password updated successfully', 'success');
      onClose();
    } catch (err: any) {
      toast.toast(err.response?.data?.error || 'Failed to update password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Reset Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
          <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Min 6 characters" /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

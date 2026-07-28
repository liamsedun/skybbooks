import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, UserCheck, UserPlus, Shield, ShieldCheck, Save, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

const TABS = [
  { label: 'General Role', key: 'general', icon: Users },
  { label: 'Specific Role', key: 'specific', icon: UserCheck },
  { label: 'Specific Role Assignment', key: 'assignments', icon: UserPlus },
  { label: 'Function Based Permissions', key: 'permissions', icon: Shield },
  { label: 'Administrator', key: 'administrator', icon: ShieldCheck },
];

const ROLES = ['Admin', 'Manager', 'HR', 'User'];
const PERMISSIONS = ['Read', 'Create', 'Edit', 'Delete', 'Export'];

function GeneralRoleContent() {
  const { success } = useToast();
  const [toggles, setToggles] = useState<Record<string, boolean>>({ Admin: true, Manager: true, HR: true, User: true });
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">General Role Settings</h2><button onClick={() => success('General role settings saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">{ROLES.map(role => (
        <div key={role} className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">{role}</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={toggles[role]} onChange={e => setToggles(prev => ({ ...prev, [role]: e.target.checked }))} className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
      ))}</div>
    </div>
  );
}

function SpecificRoleContent() {
  const { success } = useToast();
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {};
    ROLES.forEach(r => { init[r] = {}; PERMISSIONS.forEach(p => { init[r][p] = r === 'Admin'; }); });
    return init;
  });
  const toggleCheck = (role: string, perm: string) => setChecks(prev => ({ ...prev, [role]: { ...prev[role], [perm]: !prev[role][perm] } }));
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Specific Role Permissions</h2><button onClick={() => success('Role permissions saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Role</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center">{p}</th>)}</tr></thead><tbody className="divide-y divide-border-custom">{ROLES.map(role => (
        <tr key={role} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{role}</td>{PERMISSIONS.map(p => <td key={p} className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!checks[role]?.[p]} onChange={() => toggleCheck(role, p)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /></td>)}</tr>
      ))}</tbody></table></div>
    </div>
  );
}

function AssignmentsContent() {
  const { success } = useToast();
  const [assignments, setAssignments] = useState([{ user: 'Alice Johnson', role: 'Admin' }, { user: 'Bob Smith', role: 'Manager' }, { user: 'Carol White', role: 'HR' }]);
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState('User');
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Role Assignments</h2></div>
      <div className="flex gap-2"><input value={newUser} onChange={e => setNewUser(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="User name" /><select value={newRole} onChange={e => setNewRole(e.target.value)} className="px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900"><option>Admin</option><option>Manager</option><option>HR</option><option>User</option></select><button onClick={() => { if (!newUser.trim()) return; setAssignments(prev => [...prev, { user: newUser.trim(), role: newRole }]); setNewUser(''); success('Assignment added'); }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><UserPlus className="w-3.5 h-3.5" /> Assign</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{assignments.map((a, i) => (
        <tr key={i} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{a.user}</td><td className="px-3 py-2.5 text-sm text-ink-600">{a.role}</td><td className="px-3 py-2.5 text-right"><button onClick={() => { setAssignments(prev => prev.filter((_, idx) => idx !== i)); success('Assignment removed'); }} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

function PermissionsContent() {
  const { success } = useToast();
  const modules = ['Users', 'Employees', 'Leave', 'Attendance', 'Payroll', 'Settings'];
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {};
    modules.forEach(m => { init[m] = {}; PERMISSIONS.forEach(p => { init[m][p] = false; }); });
    return init;
  });
  const toggleCheck = (mod: string, perm: string) => setChecks(prev => ({ ...prev, [mod]: { ...prev[mod], [perm]: !prev[mod][perm] } }));
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Function Based Permissions</h2><button onClick={() => success('Permissions saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Module</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center">{p}</th>)}</tr></thead><tbody className="divide-y divide-border-custom">{modules.map(m => (
        <tr key={m} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{m}</td>{PERMISSIONS.map(p => <td key={p} className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!checks[m]?.[p]} onChange={() => toggleCheck(m, p)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /></td>)}</tr>
      ))}</tbody></table></div>
    </div>
  );
}

function AdminContent() {
  const { success } = useToast();
  const [superAdmin, setSuperAdmin] = useState(true);
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Administrator Access</h2><button onClick={() => success('Admin settings saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4"><p className="text-sm text-ink-500">Administrators have unrestricted access to all modules and settings. Assign the admin role with caution.</p>
        <div className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">Super Admin Access</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={superAdmin} onChange={e => setSuperAdmin(e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
      </div>
    </div>
  );
}

export function UserAccessSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setSearchParams({ tab: tab.key })}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                isActive ? 'bg-primary/10 text-primary' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="lg:col-span-3 space-y-6">
        {activeTab === 'general' && <GeneralRoleContent />}
        {activeTab === 'specific' && <SpecificRoleContent />}
        {activeTab === 'assignments' && <AssignmentsContent />}
        {activeTab === 'permissions' && <PermissionsContent />}
        {activeTab === 'administrator' && <AdminContent />}
      </div>
    </div>
  );
}

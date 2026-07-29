import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, UserCheck, UserPlus, Shield, ShieldCheck, Save, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { orgApi } from '../../../lib/api';

const TABS = [
  { label: 'General Role', key: 'general', icon: Users },
  { label: 'Specific Role', key: 'specific', icon: UserCheck },
  { label: 'Specific Role Assignment', key: 'assignments', icon: UserPlus },
  { label: 'Function Based Permissions', key: 'permissions', icon: Shield },
  { label: 'Administrator', key: 'administrator', icon: ShieldCheck },
];

const ROLES = ['Admin', 'Manager', 'HR', 'User'];
const PERMISSIONS = ['Read', 'Create', 'Edit', 'Delete', 'Export'];

function GeneralRoleContent({ toggles, onToggle, onSave }: { toggles: Record<string, boolean>; onToggle: (role: string, val: boolean) => void; onSave: () => void }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">General Role Settings</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">{ROLES.map(role => (
        <div key={role} className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">{role}</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={toggles[role] ?? true} onChange={e => onToggle(role, e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
      ))}</div>
    </div>
  );
}

function SpecificRoleContent({ checks, onToggle, onSave }: { checks: Record<string, Record<string, boolean>>; onToggle: (role: string, perm: string) => void; onSave: () => void }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Specific Role Permissions</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Role</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center">{p}</th>)}</tr></thead><tbody className="divide-y divide-border-custom">{ROLES.map(role => (
        <tr key={role} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{role}</td>{PERMISSIONS.map(p => <td key={p} className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!checks[role]?.[p]} onChange={() => onToggle(role, p)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /></td>)}</tr>
      ))}</tbody></table></div>
    </div>
  );
}

function AssignmentsContent({ assignments, onAdd, onRemove }: { assignments: { user: string; role: string }[]; onAdd: (user: string, role: string) => void; onRemove: (idx: number) => void }) {
  const { toast } = useToast();
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState('User');
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Role Assignments</h2></div>
      <div className="flex gap-2"><input value={newUser} onChange={e => setNewUser(e.target.value)} className="flex-1 px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" placeholder="User name" /><select value={newRole} onChange={e => setNewRole(e.target.value)} className="px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900"><option>Admin</option><option>Manager</option><option>HR</option><option>User</option></select><button onClick={() => { if (!newUser.trim()) return; onAdd(newUser.trim(), newRole); setNewUser(''); toast('Assignment added', 'success'); }} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><UserPlus className="w-3.5 h-3.5" /> Assign</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border-custom">{assignments.map((a, i) => (
        <tr key={i} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{a.user}</td><td className="px-3 py-2.5 text-sm text-ink-600">{a.role}</td><td className="px-3 py-2.5 text-right"><button onClick={() => onRemove(i)} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

function PermissionsContent({ checks, onToggle, onSave }: { checks: Record<string, Record<string, boolean>>; onToggle: (mod: string, perm: string) => void; onSave: () => void }) {
  const modules = ['Users', 'Employees', 'Leave', 'Attendance', 'Payroll', 'Settings'];
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Function Based Permissions</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Module</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center">{p}</th>)}</tr></thead><tbody className="divide-y divide-border-custom">{modules.map(m => (
        <tr key={m} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{m}</td>{PERMISSIONS.map(p => <td key={p} className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!checks[m]?.[p]} onChange={() => onToggle(m, p)} className="rounded border-ink-300 text-primary focus:ring-primary/30" /></td>)}</tr>
      ))}</tbody></table></div>
    </div>
  );
}

function AdminContent({ superAdmin, onToggle, onSave }: { superAdmin: boolean; onToggle: (val: boolean) => void; onSave: () => void }) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Administrator Access</h2><button onClick={onSave} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4"><p className="text-sm text-ink-500">Administrators have unrestricted access to all modules and settings. Assign the admin role with caution.</p>
        <div className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">Super Admin Access</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={superAdmin} onChange={e => onToggle(e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
      </div>
    </div>
  );
}

export function UserAccessSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';
  const { toast } = useToast();

  const [toggles, setToggles] = useState<Record<string, boolean>>({ Admin: true, Manager: true, HR: true, User: true });
  const [specificChecks, setSpecificChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [assignments, setAssignments] = useState<{ user: string; role: string }[]>([]);
  const [permChecks, setPermChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [superAdmin, setSuperAdmin] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    orgApi.getSettings().then(settings => {
      const ac = (settings as any)?.accessControl || {};
      if (ac.toggles) setToggles(ac.toggles);
      if (ac.specificChecks) setSpecificChecks(ac.specificChecks);
      if (ac.assignments) setAssignments(ac.assignments);
      if (ac.permChecks) setPermChecks(ac.permChecks);
      if (ac.superAdmin !== undefined) setSuperAdmin(ac.superAdmin);
      setLoaded(true);
    }).catch(() => {
      const init: Record<string, Record<string, boolean>> = {};
      ROLES.forEach(r => { init[r] = {}; PERMISSIONS.forEach(p => { init[r][p] = r === 'Admin'; }); });
      setSpecificChecks(init);
      setAssignments([{ user: 'Alice Johnson', role: 'Admin' }, { user: 'Bob Smith', role: 'Manager' }, { user: 'Carol White', role: 'HR' }]);
      const pInit: Record<string, Record<string, boolean>> = {};
      ['Users', 'Employees', 'Leave', 'Attendance', 'Payroll', 'Settings'].forEach(m => { pInit[m] = {}; PERMISSIONS.forEach(p => { pInit[m][p] = false; }); });
      setPermChecks(pInit);
      setLoaded(true);
    });
  }, []);

  const saveAll = async () => {
    try {
      await orgApi.updateSettings({ accessControl: { toggles, specificChecks, assignments, permChecks, superAdmin } });
      toast('Access control settings saved', 'success');
    } catch { toast('Failed to save settings', 'error'); }
  };

  if (!loaded) return <div className="p-6 text-sm text-ink-400">Loading...</div>;

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
        {activeTab === 'general' && <GeneralRoleContent toggles={toggles} onToggle={(r, v) => setToggles(p => ({ ...p, [r]: v }))} onSave={saveAll} />}
        {activeTab === 'specific' && <SpecificRoleContent checks={specificChecks} onToggle={(r, p) => setSpecificChecks(prev => ({ ...prev, [r]: { ...prev[r], [p]: !prev[r]?.[p] } }))} onSave={saveAll} />}
        {activeTab === 'assignments' && <AssignmentsContent assignments={assignments} onAdd={(u, r) => setAssignments(p => [...p, { user: u, role: r }])} onRemove={(i) => setAssignments(p => p.filter((_, idx) => idx !== i))} />}
        {activeTab === 'permissions' && <PermissionsContent checks={permChecks} onToggle={(m, p) => setPermChecks(prev => ({ ...prev, [m]: { ...prev[m], [p]: !prev[m]?.[p] } }))} onSave={saveAll} />}
        {activeTab === 'administrator' && <AdminContent superAdmin={superAdmin} onToggle={setSuperAdmin} onSave={saveAll} />}
      </div>
    </div>
  );
}

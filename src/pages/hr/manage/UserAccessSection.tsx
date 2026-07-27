import { useSearchParams } from 'react-router-dom';
import { Users, UserCheck, UserPlus, Shield, ShieldCheck, Save } from 'lucide-react';
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
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">General Role Settings</h2><button onClick={() => success('General role settings saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4">{ROLES.map(role => (
        <div key={role} className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">{role}</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" defaultChecked className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
      ))}</div>
    </div>
  );
}

function SpecificRoleContent() {
  const { success } = useToast();
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Specific Role Permissions</h2><button onClick={() => success('Role permissions saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Role</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center">{p}</th>)}</tr></thead><tbody className="divide-y divide-border-custom">{ROLES.map(role => (
        <tr key={role} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{role}</td>{PERMISSIONS.map(p => <td key={p} className="px-3 py-2.5 text-center"><input type="checkbox" defaultChecked={role === 'Admin'} className="rounded border-ink-300 text-primary focus:ring-primary/30" /></td>)}</tr>
      ))}</tbody></table></div>
    </div>
  );
}

function AssignmentsContent() {
  const { success } = useToast();
  const assignments = [
    { user: 'Alice Johnson', role: 'Admin' },
    { user: 'Bob Smith', role: 'Manager' },
    { user: 'Carol White', role: 'HR' },
  ];
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Role Assignments</h2><button onClick={() => success('Assignment added')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><UserPlus className="w-3.5 h-3.5" /> Assign</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Role</th></tr></thead><tbody className="divide-y divide-border-custom">{assignments.map(a => (
        <tr key={a.user} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{a.user}</td><td className="px-3 py-2.5 text-sm text-ink-600">{a.role}</td></tr>
      ))}</tbody></table></div>
    </div>
  );
}

function PermissionsContent() {
  const { success } = useToast();
  const modules = ['Users', 'Employees', 'Leave', 'Attendance', 'Payroll', 'Settings'];
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Function Based Permissions</h2><button onClick={() => success('Permissions saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider border-b border-border-custom"><th className="px-3 py-2 text-left">Module</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center">{p}</th>)}</tr></thead><tbody className="divide-y divide-border-custom">{modules.map(m => (
        <tr key={m} className="hover:bg-ink-50 transition-colors"><td className="px-3 py-2.5 text-sm font-medium text-ink-900">{m}</td>{PERMISSIONS.map(p => <td key={p} className="px-3 py-2.5 text-center"><input type="checkbox" className="rounded border-ink-300 text-primary focus:ring-primary/30" /></td>)}</tr>
      ))}</tbody></table></div>
    </div>
  );
}

function AdminContent() {
  const { success } = useToast();
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">Administrator Access</h2><button onClick={() => success('Admin settings saved')} className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm"><Save className="w-3.5 h-3.5" /> Save</button></div>
      <div className="space-y-4"><p className="text-sm text-ink-500">Administrators have unrestricted access to all modules and settings. Assign the admin role with caution.</p>
        <div className="flex items-center justify-between p-3 border border-border-custom rounded-xl"><span className="text-sm font-medium text-ink-900">Super Admin Access</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" defaultChecked className="sr-only peer" /><div className="w-9 h-5 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div></label></div>
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

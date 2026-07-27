import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Users, UserCheck, Building, Shield, CheckCircle, LayoutGrid } from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface TabItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_TABS: TabItem[] = [
  { label: 'Users', path: '/app/hr/manage/users', icon: Users, permission: 'hr:admin' },
  { label: 'Employee Profiles', path: '/app/hr/manage/employees', icon: UserCheck, permission: 'hr:admin' },
  { label: 'Organisation Setup', path: '/app/hr/manage/organisation/policy', icon: Building, permission: 'hr:admin' },
  { label: 'User Access Control', path: '/app/hr/manage/access/general', icon: Shield, permission: 'hr:admin' },
  { label: 'Approvals', path: '/app/hr/manage/approvals/details', icon: CheckCircle, permission: 'hr:admin' },
  { label: 'Services', path: '/app/hr/manage/services/onboarding', icon: LayoutGrid, permission: 'hr:admin' },
];

export function ManageLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { filterByPermission } = useHrPermissions();
  const TABS = filterByPermission(ALL_TABS);

  const activeIdx = TABS.findIndex(t => location.pathname.startsWith(t.path));
  const active = activeIdx >= 0 ? activeIdx : 0;

  if (TABS.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Manage SkyHRM</h1>
          <p className="text-sm text-ink-400 mt-0.5">Configure HR settings, users, organisation structure, access control, approvals, and services.</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 text-center text-ink-400">
          <Shield className="w-12 h-12 mx-auto mb-3 text-ink-300" />
          <p>You do not have access to this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Manage SkyHRM</h1>
        <p className="text-sm text-ink-400 mt-0.5">Configure HR settings, users, organisation structure, access control, approvals, and services.</p>
      </div>
      <div className="flex gap-1 bg-surface rounded-xl border border-border-custom shadow-sm p-1 overflow-x-auto">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                i === active ? 'bg-primary text-white shadow-sm' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}

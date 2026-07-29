import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, UserCheck } from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface TabItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_TABS: TabItem[] = [
  { label: 'Overview', path: '/app/hr/home/overview', icon: LayoutDashboard },
  { label: 'Dashboard', path: '/app/hr/home/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', path: '/app/hr/home/calendar', icon: Calendar },
  { label: 'Delegation', path: '/app/hr/home/delegation', icon: UserCheck, permission: 'hr:admin' },
];

export function HomeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { filterByPermission } = useHrPermissions();
  const TABS = filterByPermission(ALL_TABS);

  const activeIdx = TABS.findIndex(t => location.pathname === t.path);
  const active = activeIdx >= 0 ? activeIdx : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400 mt-0.5">HR overview, dashboard metrics, calendar, and delegation management.</p>
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

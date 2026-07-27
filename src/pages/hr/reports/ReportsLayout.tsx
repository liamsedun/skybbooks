import { NavLink, Outlet } from 'react-router-dom';
import {
  FileBarChart, Info, History, CalendarCheck, Clock, LogIn, AlertTriangle,
  LogOut, Hourglass, Users, Building2, BarChart3, Calendar,
} from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface GroupItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_GROUPS: GroupItem[] = [
  { label: 'My Reports', path: '/app/hr/reports/my-reports', icon: FileBarChart },
  { label: 'Employee Information', path: '/app/hr/reports/employee-info', icon: Info },
  { label: 'Career History', path: '/app/hr/reports/career-history', icon: History },
  { label: 'Leave Balance', path: '/app/hr/reports/leave-balance', icon: CalendarCheck },
  { label: 'Attendance', path: '/app/hr/reports/attendance', icon: Clock },
  { label: 'Early Check In', path: '/app/hr/reports/early-check-in', icon: LogIn },
  { label: 'Late Check In', path: '/app/hr/reports/late-check-in', icon: AlertTriangle },
  { label: 'Early Check Out', path: '/app/hr/reports/early-check-out', icon: LogOut },
  { label: 'Late Check Out', path: '/app/hr/reports/late-check-out', icon: AlertTriangle },
  { label: 'Presence Hours', path: '/app/hr/reports/presence-hours', icon: Hourglass },
  { label: 'Team Reports', path: '/app/hr/reports/team-reports', icon: Users },
  { label: 'Organization Reports', path: '/app/hr/reports/org-reports', icon: Building2 },
  { label: 'Analytics', path: '/app/hr/reports/analytics', icon: BarChart3 },
  { label: 'Schedules', path: '/app/hr/reports/schedules', icon: Calendar },
];

export function ReportsLayout() {
  const { filterByPermission } = useHrPermissions();
  const GROUPS = filterByPermission(ALL_GROUPS);

  if (GROUPS.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-ink-900">HR Reports</h1>
          <p className="text-sm text-ink-400 mt-0.5">HR analytics, reports, and data insights.</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 text-center text-ink-400">
          <FileBarChart className="w-12 h-12 mx-auto mb-3 text-ink-300" />
          <p>You do not have access to this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">HR Reports</h1>
        <p className="text-sm text-ink-400 mt-0.5">HR analytics, reports, and data insights.</p>
      </div>
      <div className="flex gap-6">
        <nav className="w-56 shrink-0 flex flex-col gap-0.5">
          {GROUPS.map(g => {
            const Icon = g.icon;
            return (
              <NavLink
                key={g.path}
                to={g.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 text-ink-400" />
                {g.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

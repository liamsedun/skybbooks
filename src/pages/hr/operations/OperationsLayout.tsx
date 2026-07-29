import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutGrid, UserPlus, Info, Calendar, Clock, CalendarDays, Timer,
  Award, FolderOpen, Heart, FileText, Plane, CheckSquare, Sliders,
  DoorOpen, Target, ShieldCheck, Database,
} from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface GroupItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_GROUPS: GroupItem[] = [
  { label: 'Services', path: '/app/hr/operations/services', icon: LayoutGrid },
  { label: 'Onboarding', path: '/app/hr/operations/onboarding', icon: UserPlus, permission: 'hr:create' },
  { label: 'Employee Information', path: '/app/hr/operations/employee-info', icon: Info },
  { label: 'Leave Tracker', path: '/app/hr/operations/leave', icon: Calendar },
  { label: 'Attendance', path: '/app/hr/operations/attendance', icon: Clock },
  { label: 'Shift', path: '/app/hr/operations/shift', icon: CalendarDays },
  { label: 'Time Tracker', path: '/app/hr/operations/time-tracker', icon: Timer },
  { label: 'Performance', path: '/app/hr/operations/performance', icon: Award },
  { label: 'Files', path: '/app/hr/operations/files', icon: FolderOpen },
  { label: 'Employee Engagement', path: '/app/hr/operations/engagement', icon: Heart },
  { label: 'HR Letters', path: '/app/hr/operations/hr-letters', icon: FileText, permission: 'hr:create' },
  { label: 'Travel', path: '/app/hr/operations/travel', icon: Plane },
  { label: 'Tasks', path: '/app/hr/operations/tasks', icon: CheckSquare },
  { label: 'General', path: '/app/hr/operations/system', icon: Sliders, permission: 'hr:admin' },
  { label: 'Offboarding', path: '/app/hr/operations/offboarding', icon: DoorOpen, permission: 'hr:delete' },
  { label: 'OKR', path: '/app/hr/operations/okr', icon: Target },
  { label: 'Approvals', path: '/app/hr/operations/approvals', icon: ShieldCheck, permission: 'hr:approve' },
  { label: 'Data Administration', path: '/app/hr/operations/data-admin', icon: Database, permission: 'hr:admin' },
];

export function OperationsLayout() {
  const { filterByPermission } = useHrPermissions();
  const GROUPS = filterByPermission(ALL_GROUPS);

  if (GROUPS.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-ink-400 mt-0.5">Operational HR tasks and processes.</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 text-center text-ink-400">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-ink-300" />
          <p>You do not have access to this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400 mt-0.5">Operational HR tasks and processes.</p>
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
                    isActive ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
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

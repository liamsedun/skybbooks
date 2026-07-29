import { NavLink, Outlet } from 'react-router-dom';
import { Settings, Award, FolderOpen, Heart, FileText, Plane, CheckSquare, DollarSign, Sliders, LayoutGrid } from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface GroupItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_GROUPS: GroupItem[] = [
  { label: 'Preferences', path: '/app/hr/services/preferences', icon: Settings },
  { label: 'Performance', path: '/app/hr/services/performance', icon: Award },
  { label: 'Files', path: '/app/hr/services/files', icon: FolderOpen },
  { label: 'Employee Engagement', path: '/app/hr/services/engagement', icon: Heart },
  { label: 'HR Letters', path: '/app/hr/services/hr-letters', icon: FileText, permission: 'hr:create' },
  { label: 'Travel', path: '/app/hr/services/travel', icon: Plane },
  { label: 'Tasks', path: '/app/hr/services/tasks', icon: CheckSquare },
  { label: 'Compensation', path: '/app/hr/services/compensation', icon: DollarSign },
  { label: 'General', path: '/app/hr/services/system', icon: Sliders, permission: 'hr:admin' },
];

export function ServicesLayout() {
  const { filterByPermission } = useHrPermissions();
  const GROUPS = filterByPermission(ALL_GROUPS);

  if (GROUPS.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-ink-400 mt-0.5">Additional HR tools and services.</p>
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
        <p className="text-sm text-ink-400 mt-0.5">Additional HR tools and services.</p>
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
                    isActive ? 'bg-primary/10 text-primary shadow-sm' : 'text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'
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

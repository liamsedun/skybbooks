import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Calendar, Clock, Users, AlertTriangle, Timer, FileText } from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface TabItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_TABS: TabItem[] = [
  { label: 'Summary', path: '/app/hr/attendance/summary', icon: BarChart3 },
  { label: 'Daily Log', path: '/app/hr/attendance/daily', icon: Clock },
  { label: 'Shifts', path: '/app/hr/attendance/shift', icon: Calendar },
  { label: 'Shift Assignments', path: '/app/hr/attendance/shift-assignments', icon: Users },
  { label: 'Exceptions', path: '/app/hr/attendance/exceptions', icon: AlertTriangle, permission: 'hr:manage' },
  { label: 'Overtime', path: '/app/hr/attendance/overtime', icon: Timer, permission: 'hr:manage' },
  { label: 'Reports', path: '/app/hr/attendance/reports', icon: FileText, permission: 'hr:reports' },
];

export function AttendanceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { filterByPermission } = useHrPermissions();
  const TABS = filterByPermission(ALL_TABS);

  const activeIdx = TABS.findIndex(t => location.pathname === t.path);
  const active = activeIdx >= 0 ? activeIdx : 0;

  if (TABS.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-ink-400 mt-0.5">Track employee attendance and manage shifts.</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-8 text-center text-ink-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-ink-300" />
          <p>You do not have access to this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400 mt-0.5">Track employee attendance, manage shifts, and handle exceptions.</p>
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

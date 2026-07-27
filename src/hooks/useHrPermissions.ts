import { usePermissions } from './usePermissions';

type HrAction = 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';

interface HrPagePermission {
  path: string;
  permission: HrAction;
  label: string;
}

const HR_PAGE_PERMISSIONS: HrPagePermission[] = [
  // Home
  { path: '/app/hr/home', permission: 'hr:read', label: 'Home' },
  { path: '/app/hr/home/overview', permission: 'hr:read', label: 'Overview' },
  { path: '/app/hr/home/dashboard', permission: 'hr:read', label: 'Dashboard' },
  { path: '/app/hr/home/calendar', permission: 'hr:read', label: 'Calendar' },
  { path: '/app/hr/home/delegation', permission: 'hr:admin', label: 'Delegation' },

  // Manage
  { path: '/app/hr/manage', permission: 'hr:admin', label: 'Manage SkyHRM' },
  { path: '/app/hr/manage/users', permission: 'hr:admin', label: 'Users' },
  { path: '/app/hr/manage/employees', permission: 'hr:admin', label: 'Employee Profiles' },
  { path: '/app/hr/manage/organisation', permission: 'hr:admin', label: 'Organisation Setup' },
  { path: '/app/hr/manage/access', permission: 'hr:admin', label: 'User Access Control' },
  { path: '/app/hr/manage/approvals', permission: 'hr:admin', label: 'Approvals' },
  { path: '/app/hr/manage/services', permission: 'hr:admin', label: 'Services' },

  // Onboarding
  { path: '/app/hr/onboarding', permission: 'hr:create', label: 'Onboarding' },
  { path: '/app/hr/onboarding/add-candidate', permission: 'hr:create', label: 'Add Candidate' },

  // Leave
  { path: '/app/hr/leave', permission: 'hr:read', label: 'Leave Tracker' },
  { path: '/app/hr/leave/summary', permission: 'hr:read', label: 'Leave Summary' },
  { path: '/app/hr/leave/requests', permission: 'hr:read', label: 'Leave Requests' },
  { path: '/app/hr/leave/shift', permission: 'hr:read', label: 'Shift' },

  // Attendance
  { path: '/app/hr/attendance', permission: 'hr:read', label: 'Attendance' },
  { path: '/app/hr/attendance/summary', permission: 'hr:read', label: 'Attendance Summary' },
  { path: '/app/hr/attendance/shift', permission: 'hr:read', label: 'Shift' },

  // Timesheets
  { path: '/app/hr/timesheets', permission: 'hr:read', label: 'Time Tracker' },
  { path: '/app/hr/timesheets/logs', permission: 'hr:read', label: 'Time Logs' },
  { path: '/app/hr/timesheets/sheets', permission: 'hr:read', label: 'Timesheets' },

  // Services
  { path: '/app/hr/services', permission: 'hr:read', label: 'More Services' },
  { path: '/app/hr/services/preferences', permission: 'hr:read', label: 'Preferences' },
  { path: '/app/hr/services/performance', permission: 'hr:read', label: 'Performance' },
  { path: '/app/hr/services/files', permission: 'hr:read', label: 'Files' },
  { path: '/app/hr/services/engagement', permission: 'hr:read', label: 'Employee Engagement' },
  { path: '/app/hr/services/hr-letters', permission: 'hr:create', label: 'HR Letters' },
  { path: '/app/hr/services/travel', permission: 'hr:read', label: 'Travel' },
  { path: '/app/hr/services/tasks', permission: 'hr:read', label: 'Tasks' },
  { path: '/app/hr/services/compensation', permission: 'hr:read', label: 'Compensation' },
  { path: '/app/hr/services/system', permission: 'hr:admin', label: 'General' },

  // Operations
  { path: '/app/hr/operations', permission: 'hr:read', label: 'Operations' },
  { path: '/app/hr/operations/services', permission: 'hr:read', label: 'Services' },
  { path: '/app/hr/operations/onboarding', permission: 'hr:create', label: 'Onboarding' },
  { path: '/app/hr/operations/employee-info', permission: 'hr:read', label: 'Employee Information' },
  { path: '/app/hr/operations/leave', permission: 'hr:read', label: 'Leave Tracker' },
  { path: '/app/hr/operations/attendance', permission: 'hr:read', label: 'Attendance' },
  { path: '/app/hr/operations/shift', permission: 'hr:read', label: 'Shift' },
  { path: '/app/hr/operations/time-tracker', permission: 'hr:read', label: 'Time Tracker' },
  { path: '/app/hr/operations/performance', permission: 'hr:read', label: 'Performance' },
  { path: '/app/hr/operations/files', permission: 'hr:read', label: 'Files' },
  { path: '/app/hr/operations/engagement', permission: 'hr:read', label: 'Employee Engagement' },
  { path: '/app/hr/operations/hr-letters', permission: 'hr:create', label: 'HR Letters' },
  { path: '/app/hr/operations/travel', permission: 'hr:read', label: 'Travel' },
  { path: '/app/hr/operations/tasks', permission: 'hr:read', label: 'Tasks' },
  { path: '/app/hr/operations/system', permission: 'hr:admin', label: 'General' },
  { path: '/app/hr/operations/offboarding', permission: 'hr:delete', label: 'Offboarding' },
  { path: '/app/hr/operations/okr', permission: 'hr:read', label: 'OKR' },
  { path: '/app/hr/operations/approvals', permission: 'hr:approve', label: 'Approvals' },
  { path: '/app/hr/operations/data-admin', permission: 'hr:admin', label: 'Data Administration' },

  // Reports
  { path: '/app/hr/reports', permission: 'hr:reports', label: 'HR Reports' },
  { path: '/app/hr/reports/my-reports', permission: 'hr:reports', label: 'My Reports' },
  { path: '/app/hr/reports/employee-info', permission: 'hr:reports', label: 'Employee Information' },
  { path: '/app/hr/reports/career-history', permission: 'hr:reports', label: 'Career History' },
  { path: '/app/hr/reports/leave-balance', permission: 'hr:reports', label: 'Leave Balance' },
  { path: '/app/hr/reports/attendance', permission: 'hr:reports', label: 'Attendance' },
  { path: '/app/hr/reports/early-check-in', permission: 'hr:reports', label: 'Early Check In' },
  { path: '/app/hr/reports/late-check-in', permission: 'hr:reports', label: 'Late Check In' },
  { path: '/app/hr/reports/early-check-out', permission: 'hr:reports', label: 'Early Check Out' },
  { path: '/app/hr/reports/late-check-out', permission: 'hr:reports', label: 'Late Check Out' },
  { path: '/app/hr/reports/presence-hours', permission: 'hr:reports', label: 'Presence Hours' },
  { path: '/app/hr/reports/team-reports', permission: 'hr:reports', label: 'Team Reports' },
  { path: '/app/hr/reports/org-reports', permission: 'hr:reports', label: 'Organization Reports' },
  { path: '/app/hr/reports/analytics', permission: 'hr:reports', label: 'Analytics' },
  { path: '/app/hr/reports/schedules', permission: 'hr:reports', label: 'Schedules' },

  // Standalone pages
  { path: '/app/hr/jobs', permission: 'hr:read', label: 'Jobs' },
  { path: '/app/hr/projects', permission: 'hr:read', label: 'Projects' },
  { path: '/app/hr/job-schedule', permission: 'hr:read', label: 'Job Schedule' },
];

export function useHrPermissions() {
  const { hasModuleAccess, hasActionPermission, isOwner, isAdmin } = usePermissions();

  const canAccessHr = hasModuleAccess('hrm');

  const can = (permission: HrAction): boolean => {
    if (!canAccessHr) return false;
    if (isOwner || isAdmin) return true;
    return hasActionPermission(permission);
  };

  const getPagePermission = (path: string): HrAction | undefined => {
    return HR_PAGE_PERMISSIONS.find(p => path === p.path)?.permission;
  };

  const canAccessPage = (path: string): boolean => {
    const perm = getPagePermission(path);
    if (!perm) return canAccessHr;
    return can(perm);
  };

  const filterPages = <T extends { path: string }>(pages: T[]): T[] => {
    return pages.filter(p => canAccessPage(p.path));
  };

  const filterByPermission = <T extends { permission?: HrAction }>(items: T[]): T[] => {
    return items.filter(item => {
      if (!item.permission) return true;
      return can(item.permission);
    });
  };

  return {
    canAccessHr,
    can,
    canAccessPage,
    getPagePermission,
    filterPages,
    filterByPermission,
  };
}

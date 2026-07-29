import { Outlet, NavLink } from 'react-router-dom';

const TABS = [
  { label: 'Dashboard', path: '/app/hr/workflow' },
  { label: 'Templates', path: '/app/hr/workflow/templates' },
  { label: 'Automation Rules', path: '/app/hr/workflow/automation-rules' },
  { label: 'Notifications', path: '/app/hr/workflow/notifications' },
  { label: 'Reminder Configs', path: '/app/hr/workflow/reminder-configs' },
];

export function WorkflowLayout() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400 mt-0.5">Manage automated workflows, templates, and notifications.</p>
      </div>
      <div className="border-b border-border-custom">
        <nav className="flex gap-6 -mb-px">
          {TABS.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/app/hr/workflow'}
              className={({ isActive }) =>
                `pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink-500 hover:text-ink-700 hover:border-ink-300'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

export default WorkflowLayout;

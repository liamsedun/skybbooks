import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, CalendarCheck, Clock, TrendingUp, ArrowRight, Building, Briefcase, MoreHorizontal } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { statusColor, formatDate } from '../../../lib/hrExport';

const MOCK_EMPLOYEES = [
  { id: '1', name: 'Alice Johnson', department: 'Engineering', status: 'active', joinDate: '2023-01-15' },
  { id: '2', name: 'Bob Smith', department: 'Marketing', status: 'active', joinDate: '2022-06-01' },
  { id: '3', name: 'Carol Williams', department: 'Finance', status: 'active', joinDate: '2024-03-10' },
  { id: '4', name: 'David Brown', department: 'Engineering', status: 'inactive', joinDate: '2023-09-20' },
  { id: '5', name: 'Eve Davis', department: 'HR', status: 'active', joinDate: '2021-11-01' },
  { id: '6', name: 'Frank Miller', department: 'Sales', status: 'active', joinDate: '2024-07-15' },
  { id: '7', name: 'Grace Wilson', department: 'Marketing', status: 'inactive', joinDate: '2023-04-05' },
  { id: '8', name: 'Henry Taylor', department: 'Engineering', status: 'active', joinDate: '2025-01-10' },
];

const MOCK_RECENT_ACTIVITY = [
  { id: '1', action: 'New employee onboarded', actor: 'Eve Davis', time: '2 hours ago', type: 'create' },
  { id: '2', action: 'Leave request approved', actor: 'Alice Johnson', time: '4 hours ago', type: 'approve' },
  { id: '3', action: 'Employee record updated', actor: 'Bob Smith', time: '1 day ago', type: 'update' },
  { id: '4', action: 'Contract renewed', actor: 'Carol Williams', time: '2 days ago', type: 'renew' },
  { id: '5', action: 'Resignation submitted', actor: 'David Brown', time: '3 days ago', type: 'exit' },
];

const MOCK_UPCOMING_EVENTS = [
  { id: '1', title: 'Performance Reviews', date: '2025-08-15', type: 'review' },
  { id: '2', title: 'Payroll Run', date: '2025-08-25', type: 'payroll' },
  { id: '3', title: 'Team Building Workshop', date: '2025-09-05', type: 'event' },
  { id: '4', title: 'Quarterly All-Hands', date: '2025-09-20', type: 'meeting' },
];

const DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-500',
  Marketing: 'bg-purple-500',
  Finance: 'bg-emerald-500',
  HR: 'bg-amber-500',
  Sales: 'bg-rose-500',
};

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, string> = { create: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400', approve: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400', update: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400', renew: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400', exit: 'bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400' };
  return <div className={`w-2 h-2 rounded-full ${map[type] || 'bg-ink-300'} shrink-0 mt-1.5`} />;
}

function EventIcon({ type }: { type: string }) {
  const map: Record<string, string> = { review: 'text-blue-500', payroll: 'text-emerald-500', event: 'text-purple-500', meeting: 'text-amber-500' };
  const icons: Record<string, React.ReactNode> = { review: <Users className="w-4 h-4" />, payroll: <Clock className="w-4 h-4" />, event: <CalendarCheck className="w-4 h-4" />, meeting: <Users className="w-4 h-4" /> };
  return <div className={`p-2 rounded-xl ${map[type] || ''} bg-ink-50 dark:bg-ink-800`}>{icons[type] || <CalendarCheck className="w-4 h-4" />}</div>;
}

export function HrDashboardPage() {
  const navigate = useNavigate();

  const deptData = useMemo(() => {
    const map = new Map<string, number>();
    MOCK_EMPLOYEES.forEach(e => map.set(e.department, (map.get(e.department) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, []);

  const stats = useMemo(() => [
    { label: 'Total Employees', value: MOCK_EMPLOYEES.length, icon: <Users className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Active Employees', value: MOCK_EMPLOYEES.filter(e => e.status === 'active').length, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Inactive', value: MOCK_EMPLOYEES.filter(e => e.status === 'inactive').length, icon: <UserX className="w-4 h-4" />, color: 'rose' as const },
    { label: 'Departments', value: deptData.length, icon: <Building className="w-4 h-4" />, color: 'purple' as const },
    { label: 'New This Month', value: MOCK_EMPLOYEES.filter(e => { const d = new Date(e.joinDate); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length, icon: <TrendingUp className="w-4 h-4" />, color: 'cyan' as const },
    { label: 'Upcoming Events', value: MOCK_UPCOMING_EVENTS.length, icon: <CalendarCheck className="w-4 h-4" />, color: 'amber' as const },
  ], [deptData.length]);

  return (
    <HrPageShell title="HR Dashboard" description="Overview of your human resources"
      pageKey="welcome"
      headerActions={
        <button onClick={() => navigate('/app/hr/employees/add')}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm">
          <Users className="w-3.5 h-3.5" /> Add Employee
        </button>
      }>

      <HrStatCards items={stats} columns={3} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
              <h3 className="text-sm font-semibold text-ink-900">Recent Activity</h3>
              <button className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">View All</button>
            </div>
            <div className="divide-y divide-border-custom">
              {MOCK_RECENT_ACTIVITY.map(activity => (
                <div key={activity.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-ink-50/50 dark:hover:bg-ink-800/20 transition-colors">
                  <ActivityIcon type={activity.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900">{activity.action}</p>
                    <p className="text-xs text-ink-400 mt-0.5">by {activity.actor}</p>
                  </div>
                  <span className="text-xs text-ink-400 shrink-0">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
              <h3 className="text-sm font-semibold text-ink-900">Quick Links</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
              {[
                { label: 'Employees', icon: <Users className="w-4 h-4" />, path: '/app/hr/employees', color: 'text-blue-500' },
                { label: 'Departments', icon: <Building className="w-4 h-4" />, path: '/app/hr/departments', color: 'text-purple-500' },
                { label: 'Designations', icon: <Briefcase className="w-4 h-4" />, path: '/app/hr/designations', color: 'text-emerald-500' },
                { label: 'Settings', icon: <Clock className="w-4 h-4" />, path: '/app/hr/settings', color: 'text-amber-500' },
              ].map(link => (
                <button key={link.label} onClick={() => navigate(link.path)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border-custom hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-all group">
                  <div className={`p-3 rounded-xl bg-ink-50 dark:bg-ink-800 ${link.color} group-hover:scale-110 transition-transform`}>{link.icon}</div>
                  <span className="text-xs font-medium text-ink-600">{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
              <h3 className="text-sm font-semibold text-ink-900">Department Distribution</h3>
            </div>
            <div className="p-5 space-y-3">
              {deptData.map(([dept, count]) => {
                const pct = Math.round((count / MOCK_EMPLOYEES.length) * 100);
                return (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-700">{dept}</span>
                      <span className="text-ink-400">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${DEPARTMENT_COLORS[dept] || 'bg-ink-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
              <h3 className="text-sm font-semibold text-ink-900">Upcoming Events</h3>
              <button className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">View All</button>
            </div>
            <div className="divide-y divide-border-custom">
              {MOCK_UPCOMING_EVENTS.map(event => (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50/50 dark:hover:bg-ink-800/20 transition-colors">
                  <EventIcon type={event.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900">{event.title}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{formatDate(event.date)}</p>
                  </div>
                  <button className="text-ink-300 hover:text-ink-500 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}



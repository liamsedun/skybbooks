import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, UserX, CalendarCheck, Clock, TrendingUp, Building, Briefcase } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { formatDate } from '../../../lib/hrExport';
import { hrApi } from '../../../lib/api';

interface RecentEmployee {
  id: string;
  name: string;
  department?: string;
  joinDate?: string;
  status?: string;
}

interface DashboardData {
  totalEmployees: number;
  activeCount: number;
  newThisMonth: number;
  departmentCount: number;
  designationCount: number;
  recentEmployees: RecentEmployee[];
}

interface Department {
  id: string;
  name: string;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-500',
  Marketing: 'bg-purple-500',
  Finance: 'bg-emerald-500',
  HR: 'bg-amber-500',
  Sales: 'bg-rose-500',
};

function DeptBar({ name, count, total }: { name: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-ink-700">{name}</span>
        <span className="text-ink-400">{count}{total > 0 ? ` (${pct}%)` : ''}</span>
      </div>
      <div className="w-full h-2 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${DEPARTMENT_COLORS[name] || 'bg-ink-400'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function HrDashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dash, depts] = await Promise.all([
          hrApi.getDashboard(),
          hrApi.getDepartments(),
        ]);
        if (cancelled) return;
        setDashboard(dash);
        setDepartments(Array.isArray(depts) ? depts : []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const deptDistribution = (() => {
    if (!dashboard?.recentEmployees?.length) return [] as [string, number][];
    const map = new Map<string, number>();
    dashboard.recentEmployees.forEach(e => {
      const dept = e.department || 'Other';
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const totalRecent = dashboard?.recentEmployees?.length || 0;

  if (loading) {
    return (
      <HrPageShell title="HR Dashboard" description="Overview of your human resources" pageKey="welcome">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-ink-50 dark:bg-ink-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </HrPageShell>
    );
  }

  if (error) {
    return (
      <HrPageShell title="HR Dashboard" description="Overview of your human resources" pageKey="welcome">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 text-center">
          <p className="text-rose-600 dark:text-rose-400 text-sm font-medium">{error}</p>
          <button onClick={() => window.location.reload()}
            className="mt-3 px-4 py-1.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900 transition-colors">
            Retry
          </button>
        </div>
      </HrPageShell>
    );
  }

  const stats = [
    { label: 'Total Employees', value: dashboard?.totalEmployees ?? 0, icon: <Users className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Active', value: dashboard?.activeCount ?? 0, icon: <UserCheck className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Inactive', value: (dashboard?.totalEmployees ?? 0) - (dashboard?.activeCount ?? 0), icon: <UserX className="w-4 h-4" />, color: 'rose' as const },
    { label: 'Departments', value: dashboard?.departmentCount ?? departments.length, icon: <Building className="w-4 h-4" />, color: 'purple' as const },
    { label: 'New This Month', value: dashboard?.newThisMonth ?? 0, icon: <TrendingUp className="w-4 h-4" />, color: 'cyan' as const },
  ];

  const recentEmployees = dashboard?.recentEmployees ?? [];

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
              <h3 className="text-sm font-semibold text-ink-900">Recent Employees</h3>
              <button onClick={() => navigate('/app/hr/employees')}
                className="text-xs font-medium text-primary hover:text-primary-hover transition-colors">View All</button>
            </div>
            <div className="divide-y divide-border-custom">
              {recentEmployees.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-400 text-center">No employees yet</p>
              ) : recentEmployees.slice(0, 5).map(emp => (
                <div key={emp.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-ink-50/50 dark:hover:bg-ink-800/20 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {emp.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-900">{emp.name}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{emp.department || '—'}</p>
                  </div>
                  <span className="text-xs text-ink-400 shrink-0">{emp.joinDate ? formatDate(emp.joinDate) : '—'}</span>
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
              {departments.length === 0 && deptDistribution.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-4">No departments found</p>
              ) : (
                (deptDistribution.length > 0 ? deptDistribution : departments.map(d => [d.name, 0] as [string, number]))
                  .map(([name, count]) => (
                    <DeptBar key={name} name={name} count={count} total={totalRecent} />
                  ))
              )}
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
              <h3 className="text-sm font-semibold text-ink-900">Upcoming Events</h3>
            </div>
            <div className="p-6 text-center">
              <CalendarCheck className="w-8 h-8 text-ink-300 mx-auto mb-2" />
              <p className="text-sm text-ink-400">Coming soon</p>
              <p className="text-xs text-ink-300 mt-1">Calendar events will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </HrPageShell>
  );
}

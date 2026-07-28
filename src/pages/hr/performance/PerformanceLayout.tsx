import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ClipboardCheck, Target, TrendingUp, Calendar, Award } from 'lucide-react';
import { useHrPermissions } from '../../../hooks/useHrPermissions';

interface TabItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: 'hr:read' | 'hr:create' | 'hr:update' | 'hr:delete' | 'hr:approve' | 'hr:export' | 'hr:reports' | 'hr:admin' | 'hr:manage';
}

const ALL_TABS: TabItem[] = [
  { label: 'Overview', path: '/app/hr/performance/overview', icon: BarChart3 },
  { label: 'Reviews', path: '/app/hr/performance/reviews', icon: ClipboardCheck },
  { label: 'Goals / OKRs', path: '/app/hr/performance/goals', icon: Target },
  { label: 'KPIs', path: '/app/hr/performance/kpis', icon: TrendingUp },
  { label: 'Cycles', path: '/app/hr/performance/cycles', icon: Calendar },
  { label: 'Development Plans', path: '/app/hr/performance/development', icon: TrendingUp },
  { label: 'Promotions', path: '/app/hr/performance/promotions', icon: Award },
];

export function PerformanceLayout() {
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
          <h1 className="text-xl font-bold text-ink-900">Performance Management</h1>
          <p className="text-sm text-ink-400 mt-0.5">Manage goals, reviews, KPIs, development plans, and performance cycles.</p>
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
        <h1 className="text-xl font-bold text-ink-900">Performance Management</h1>
        <p className="text-sm text-ink-400 mt-0.5">Manage goals, reviews, KPIs, development plans, and performance cycles.</p>
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

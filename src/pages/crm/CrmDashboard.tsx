import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Target, DollarSign, CalendarCheck, BarChart3,
  Phone, Users, Mail, CheckCircle, FileText, Plus, Kanban,
  Clock, AlertCircle, Loader2
} from 'lucide-react';
import { crmApi } from '../../lib/api';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  call: Phone, meeting: Users, email: Mail, task: CheckCircle, note: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-600',
  meeting: 'bg-purple-100 text-purple-600',
  email: 'bg-amber-100 text-amber-600',
  task: 'bg-green-100 text-green-600',
  note: 'bg-slate-100 text-slate-600',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

function MetricCard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: string; icon: React.ElementType; color: string; subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase font-bold tracking-widest text-ink-400">{title}</span>
        <div className={`p-2.5 rounded-xl ${colorMap[color] || colorMap.emerald}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-ink-900 tabular-nums tracking-tight">{value}</div>
      {subtitle && <p className="text-[11px] text-ink-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export function CrmDashboard() {
  const navigate = useNavigate();
  const [showAllActivities, setShowAllActivities] = useState(false);

  const { data: dashRes, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: async () => {
      const res = await crmApi.getDashboard();
      return res.data;
    },
  });

  const d = dashRes as any;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  const activities = d?.recentActivities || [];
  const displayedActivities = showAllActivities ? activities : activities.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">CRM Dashboard</h1>
          <p className="text-sm text-ink-400 mt-0.5">Track your sales pipeline, deals, and team activities</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Deals" value={`${d?.totalDeals ?? 0}`} icon={Target} color="blue" subtitle="All deals in pipeline" />
        <MetricCard title="Deals Won" value={`${d?.totalWon ?? 0}`} icon={TrendingUp} color="emerald" subtitle="Closed won deals" />
        <MetricCard title="Won Value" value={fmtNaira(d?.totalWonValue ?? 0)} icon={DollarSign} color="amber" subtitle="Total revenue from won deals" />
        <MetricCard title="Activities Due Today" value={`${d?.activitiesDueToday ?? 0}`} icon={CalendarCheck} color="rose" subtitle="Requires attention" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-bold text-ink-900 mb-4">Deals by Stage</h3>
          {d?.dealsByStage?.length > 0 ? (
            <div className="space-y-3">
              {d.dealsByStage.map((s: any, i: number) => {
                const maxCount = Math.max(...d.dealsByStage.map((x: any) => x.count), 1);
                const pct = (s.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#94a3b8' }} />
                        <span className="text-xs font-medium text-ink-700">{s.stageName}</span>
                      </div>
                      <div className="text-xs text-ink-400 tabular-nums">
                        {s.count} deals · {fmtNaira(s.totalValue)}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color || '#94a3b8' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-ink-400">
              <BarChart3 className="w-8 h-8 mb-2" />
              <p className="text-xs">No deals yet</p>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
          <h3 className="text-sm font-bold text-ink-900 mb-4">Recent Activities</h3>
          {displayedActivities.length > 0 ? (
            <div className="space-y-2">
              {displayedActivities.map((a: any, i: number) => {
                const TypeIcon = TYPE_ICONS[a.type] || FileText;
                const typeColor = TYPE_COLORS[a.type] || 'bg-slate-100 text-slate-600';
                const statusColor = STATUS_COLORS[a.status] || 'bg-slate-100 text-slate-600';
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-colors">
                    <div className={`p-2 rounded-lg ${typeColor} shrink-0`}>
                      <TypeIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-ink-900 truncate">{a.subject}</div>
                      <div className="text-[10px] text-ink-400 mt-0.5 space-x-1">
                        {a.dealTitle && <span>Deal: {a.dealTitle}</span>}
                        {a.assigneeName && <span>· {a.assigneeName}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statusColor}`}>
                          {a.status}
                        </span>
                        {a.dueDate && (
                          <span className="text-[10px] text-ink-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> {fmtDate(a.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {activities.length > 5 && (
                <button
                  onClick={() => setShowAllActivities(!showAllActivities)}
                  className="w-full text-center text-xs font-medium text-primary hover:text-primary-hover py-2 transition-colors"
                >
                  {showAllActivities ? 'Show less' : `View all ${activities.length} activities`}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-ink-400">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-xs">No recent activities</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
        <h3 className="text-sm font-bold text-ink-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/app/crm/pipeline')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-colors shadow-sm"
          >
            <Kanban className="w-4 h-4" />
            View Pipeline
          </button>
          <button
            onClick={() => navigate('/app/crm/pipeline')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
          <button
            onClick={() => navigate('/app/crm/activities')}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Activity
          </button>
        </div>
      </div>
    </div>
  );
}

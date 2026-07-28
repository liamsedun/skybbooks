import { useState, useEffect } from 'react';
import { ClipboardCheck, Star, TrendingUp, Award, BarChart3 } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { useToast } from '../../../contexts/ToastContext';
import { hrApi } from '../../../lib/api';
import { formatDate } from '../../../lib/hrExport';

interface PerformanceAnalytics {
  totalReviews: number;
  avgRating: number;
  ratingDistribution: Record<number, number>;
  reviewsByType: Record<string, number>;
  totalKpis: number;
  activeKpis: number;
  activeDevPlans: number;
  pendingPromotions: number;
}

const now = new Date();
const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
const defaultTo = now.toISOString().split('T')[0];

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const style: Record<string, { bg: string; border: string; label: string; value: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-100 dark:border-blue-900', label: 'text-blue-700 dark:text-blue-400', value: 'text-blue-800 dark:text-blue-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-100 dark:border-amber-900', label: 'text-amber-700 dark:text-amber-400', value: 'text-amber-800 dark:text-amber-300' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900', label: 'text-emerald-700 dark:text-emerald-400', value: 'text-emerald-800 dark:text-emerald-300' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-100 dark:border-violet-900', label: 'text-violet-700 dark:text-violet-400', value: 'text-violet-800 dark:text-violet-300' },
  };
  const s = style[color] || style.blue;
  return (
    <div className={`${s.bg} rounded-xl p-4 border ${s.border}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className={`text-xs ${s.label} font-medium`}>{label}</span></div>
      <p className={`text-2xl font-bold ${s.value}`}>{value}</p>
    </div>
  );
}

export function PerformanceAnalyticsPage() {
  const { error: showError } = useToast();

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await hrApi.getPerformanceAnalytics({ dateFrom, dateTo });
      const data: PerformanceAnalytics = res.data ?? res;
      setAnalytics(data);
    } catch (err: any) {
      showError(err?.response?.data?.error || err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [dateFrom, dateTo]);

  const maxRatingCount = analytics ? Math.max(...Object.values(analytics.ratingDistribution), 1) : 1;

  return (
    <HrPageShell title="Performance Analytics" description="Overview of performance metrics and KPIs"
      pageKey="performance-analytics"
      headerActions={
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-ink-400" />
          <span className="text-xs text-ink-400">{formatDate(dateFrom)} – {formatDate(dateTo)}</span>
        </div>
      }>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-400 text-sm">Loading analytics...</div>
      ) : !analytics ? (
        <div className="flex items-center justify-center py-20 text-rose-500 text-sm">Failed to load analytics</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Total Reviews" value={analytics.totalReviews} color="blue"
              icon={<ClipboardCheck className="w-4 h-4 text-blue-600" />} />
            <StatCard label="Avg Rating" value={analytics.avgRating.toFixed(1)} color="amber"
              icon={<Star className="w-4 h-4 text-amber-500" />} />
            <StatCard label="Active KPIs" value={analytics.activeKpis} color="emerald"
              icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} />
            <StatCard label="Active Dev Plans" value={analytics.activeDevPlans} color="violet"
              icon={<TrendingUp className="w-4 h-4 text-violet-500" />} />
            <StatCard label="Pending Promotions" value={analytics.pendingPromotions} color="amber"
              icon={<Award className="w-4 h-4 text-amber-500" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-surface rounded-xl border border-border-custom p-5">
              <h3 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Rating Distribution
              </h3>
              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map(rating => {
                  const count = analytics.ratingDistribution[rating] || 0;
                  const pct = maxRatingCount > 0 ? (count / maxRatingCount) * 100 : 0;
                  return (
                    <div key={rating}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-ink-700">{rating} Star{rating !== 1 ? 's' : ''}</span>
                        <span className="text-ink-400">{count} review{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="w-full h-2.5 bg-ink-100 dark:bg-ink-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border-custom p-5">
              <h3 className="text-sm font-semibold text-ink-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Reviews by Type
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-custom">
                    <th className="text-left py-2 px-1 text-xs font-semibold text-ink-400 uppercase tracking-wider">Review Type</th>
                    <th className="text-right py-2 px-1 text-xs font-semibold text-ink-400 uppercase tracking-wider">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analytics.reviewsByType).length === 0 ? (
                    <tr><td colSpan={2} className="py-8 text-center text-ink-400 text-xs">No reviews found</td></tr>
                  ) : (
                    Object.entries(analytics.reviewsByType).map(([type, count]) => (
                      <tr key={type} className="border-b border-border-custom last:border-0">
                        <td className="py-2.5 px-1 text-ink-700 capitalize">{type.replace('_', ' ')}</td>
                        <td className="py-2.5 px-1 text-right font-semibold text-ink-900">{count}</td>
                      </tr>
                    ))
                  )}
                  {Object.entries(analytics.reviewsByType).length > 0 && (
                    <tr className="bg-ink-50 dark:bg-ink-800/50">
                      <td className="py-2.5 px-1 text-xs font-semibold text-ink-600 uppercase">Total</td>
                      <td className="py-2.5 px-1 text-right font-bold text-ink-900">
                        {Object.values(analytics.reviewsByType).reduce((a, b) => a + b, 0)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </HrPageShell>
  );
}
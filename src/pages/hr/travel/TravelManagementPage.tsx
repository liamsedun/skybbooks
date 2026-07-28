import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, DollarSign, Receipt, CheckCircle2, History, BarChart3, RefreshCw, ArrowRight, ClipboardList, Wallet } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { hrApi } from '../../../lib/api';

interface DashboardData {
  pendingRequests: number;
  pendingAdvances: number;
  pendingExpenses: number;
  statusBreakdown: { status: string; count: number }[];
}

const QUICK_LINKS = [
  { label: 'Travel Requests', icon: <ClipboardList className="w-5 h-5" />, path: '/app/hr/travel/requests', color: 'text-blue-500' },
  { label: 'Travel Advances', icon: <Wallet className="w-5 h-5" />, path: '/app/hr/travel/advances', color: 'text-purple-500' },
  { label: 'Expense Claims', icon: <Receipt className="w-5 h-5" />, path: '/app/hr/travel/expenses', color: 'text-amber-500' },
  { label: 'Settlements', icon: <CheckCircle2 className="w-5 h-5" />, path: '/app/hr/travel/settlements', color: 'text-emerald-500' },
  { label: 'History', icon: <History className="w-5 h-5" />, path: '/app/hr/travel/history', color: 'text-cyan-500' },
  { label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, path: '/app/hr/travel/reports', color: 'text-rose-500' },
];

export function TravelManagementPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await hrApi.getTravelDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load travel dashboard');
    } finally {
      setLoading(false);
    }
  }

  const totalTrips = useMemo(() => {
    if (!dashboard?.statusBreakdown) return 0;
    return dashboard.statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  }, [dashboard]);

  const stats = useMemo(() => [
    { label: 'Pending Requests', value: dashboard?.pendingRequests ?? 0, icon: <ClipboardList className="w-4 h-4" />, color: 'blue' as const },
    { label: 'Pending Advances', value: dashboard?.pendingAdvances ?? 0, icon: <Wallet className="w-4 h-4" />, color: 'purple' as const },
    { label: 'Pending Expenses', value: dashboard?.pendingExpenses ?? 0, icon: <Receipt className="w-4 h-4" />, color: 'amber' as const },
    { label: 'Total Trips', value: totalTrips, icon: <Plane className="w-4 h-4" />, color: 'emerald' as const },
  ], [dashboard, totalTrips]);

  if (loading) {
    return (
      <HrPageShell title="Travel Management" description="Overview of travel requests, advances, and expenses" pageKey="travel">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-ink-50 dark:bg-ink-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </HrPageShell>
    );
  }

  if (error) {
    return (
      <HrPageShell title="Travel Management" description="Overview of travel requests, advances, and expenses" pageKey="travel">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 text-center">
          <p className="text-rose-600 dark:text-rose-400 text-sm font-medium">{error}</p>
          <button onClick={loadDashboard}
            className="mt-3 px-4 py-1.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900 transition-colors">
            Retry
          </button>
        </div>
      </HrPageShell>
    );
  }

  return (
    <HrPageShell title="Travel Management" description="Overview of travel requests, advances, and expenses"
      pageKey="travel"
      headerActions={
        <button onClick={loadDashboard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      }>

      <HrStatCards items={stats} columns={4} />

      <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
          <h3 className="text-sm font-semibold text-ink-900">Quick Links</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-5">
          {QUICK_LINKS.map(link => (
            <button key={link.label} onClick={() => navigate(link.path)}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-border-custom hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-all group">
              <div className={`p-3 rounded-xl bg-ink-50 dark:bg-ink-800 ${link.color} group-hover:scale-110 transition-transform`}>{link.icon}</div>
              <span className="text-xs font-medium text-ink-600">{link.label}</span>
              <ArrowRight className="w-3 h-3 text-ink-300 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </HrPageShell>
  );
}
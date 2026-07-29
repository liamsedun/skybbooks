import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ListChecks, Users, Settings, History, AlertTriangle, BarChart3, ArrowRight } from 'lucide-react';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { hrApi } from '../../../lib/api';

interface DashboardData {
  total: number; pending: number; approved: number; rejected: number; cancelled: number;
  myPendingCount: number; avgApprovalHours: number;
  byModule: { module: string; count: number }[];
}

export function ApprovalDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    hrApi.getApprovalDashboard().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total Requests', value: data?.total || 0, icon: ListChecks, color: 'blue' as const },
    { label: 'Pending', value: data?.pending || 0, icon: Clock, color: 'amber' as const },
    { label: 'Approved', value: data?.approved || 0, icon: CheckCircle, color: 'green' as const },
    { label: 'Rejected', value: data?.rejected || 0, icon: XCircle, color: 'rose' as const },
    { label: 'My Queue', value: data?.myPendingCount || 0, icon: Users, color: 'purple' as const },
    { label: 'Avg Hours', value: data?.avgApprovalHours || 0, icon: BarChart3, color: 'indigo' as const, suffix: 'h' },
  ];

  const quickLinks = [
    { label: 'My Approval Queue', path: '/app/hr/approvals/my-queue', icon: ListChecks, badge: data?.myPendingCount },
    { label: 'Configuration', path: '/app/hr/approvals/configs', icon: Settings },
    { label: 'Delegations', path: '/app/hr/approvals/delegations', icon: Users },
    { label: 'Escalation Rules', path: '/app/hr/approvals/escalations', icon: AlertTriangle },
    { label: 'Approval History', path: '/app/hr/approvals/history', icon: History },
  ];

  return (
    <HrPageShell title="Approval Engine" description="Centralized approval workflow management for all HR processes" pageKey="approvals">
      {loading ? <div className="text-muted-foreground p-4">Loading...</div> : (
        <>
          <HrStatCards items={stats} columns={6} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
              <h3 className="text-sm font-semibold text-ink-700 mb-3">Quick Actions</h3>
              <div className="space-y-1">
                {quickLinks.map(link => (
                  <button key={link.label} onClick={() => navigate(link.path)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors text-sm">
                    <span className="flex items-center gap-2"><link.icon className="w-4 h-4 text-ink-500" />{link.label}</span>
                    {link.badge !== undefined ? <span className="text-xs font-semibold text-primary">{link.badge}</span> : <ArrowRight className="w-4 h-4 text-ink-300" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-5">
              <h3 className="text-sm font-semibold text-ink-700 mb-3">Requests by Module</h3>
              <div className="space-y-2">
                {data?.byModule.map(m => (
                  <div key={m.module} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-ink-600">{m.module.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-semibold bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{m.count}</span>
                  </div>
                ))}
                {(!data?.byModule || data.byModule.length === 0) && <p className="text-xs text-ink-400">No requests yet</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </HrPageShell>
  );
}

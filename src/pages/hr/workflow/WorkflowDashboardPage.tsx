import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Zap, PlayCircle, CheckCircle } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrStatCards } from '../../../components/hr/HrStatCards';
import { HrDataTable } from '../../../components/hr/HrDataTable';

export function WorkflowDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrApi.getWorkflowDashboard().then((res: any) => {
      setData(res.data || res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Total Templates', value: data.totalTemplates ?? 0, icon: Settings, color: 'blue' },
    { label: 'Active Rules', value: data.activeRules ?? 0, icon: Zap, color: 'green' },
    { label: 'Running Instances', value: data.runningInstances ?? 0, icon: PlayCircle, color: 'amber' },
    { label: 'Completed Instances', value: data.completedInstances ?? 0, icon: CheckCircle, color: 'indigo' },
  ] : [];

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'trigger', label: 'Trigger' },
    { key: 'status', label: 'Status', render: (v: string) => <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (v === 'completed' ? 'bg-green-100 text-green-700' : v === 'running' ? 'bg-blue-100 text-blue-700' : v === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>{v}</span> },
    { key: 'currentStep', label: 'Step', render: (_: any, row: any) => `${row.currentStep ?? 0}/${row.totalSteps ?? 0}` },
    { key: 'startedAt', label: 'Started', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
  ];

  return (
    <HrPageShell title="Workflow Engine Dashboard" loading={loading}>
      <div className="space-y-6">
        <HrStatCards cards={stats} />

        <div className="flex gap-3 flex-wrap">
          <button onClick={() => navigate('/app/hr/workflow/templates')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Manage Templates</button>
          <button onClick={() => navigate('/app/hr/workflow/automation-rules')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Automation Rules</button>
          <button onClick={() => navigate('/app/hr/workflow/notifications')} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">View Notifications</button>
          <button onClick={() => navigate('/app/hr/workflow/reminder-configs')} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">Reminder Configs</button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Workflow Instances</h3>
          <HrDataTable columns={columns} data={data?.recentInstances ?? []} />
        </div>
      </div>
    </HrPageShell>
  );
}

export default WorkflowDashboardPage;

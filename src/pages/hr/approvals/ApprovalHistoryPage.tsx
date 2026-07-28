import { useState, useEffect } from 'react';
import { History, Eye } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { HrFilterBar } from '../../../components/hr/HrFilterBar';

export function ApprovalHistoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.module = search;
    if (statusFilter) params.status = statusFilter;
    hrApi.getApprovalHistory(params).then(r => { setRows(r.data || []); setLoading(false); });
  };
  useEffect(() => { load(); }, [search, statusFilter]);

  const viewDetails = async (item: any) => {
    setSelected(item);
    const id = item.hr_approval_requests?.id || item.id;
    const s = await hrApi.getApprovalSteps(id).catch(() => ({ data: [] }));
    setSteps(s.data || []);
  };

  const columns: Column<any>[] = [
    { key: 'title', label: 'Title', render: r => r.hr_approval_requests?.title || r.title || 'Untitled', className: 'font-medium' },
    { key: 'module', label: 'Module', render: r => <span className="capitalize text-xs bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{(r.hr_approval_requests?.module || r.module || '').replace(/_/g, ' ')}</span> },
    { key: 'status', label: 'Status', render: r => {
      const s = r.hr_approval_requests?.status || r.status;
      const colors: Record<string, string> = { approved: 'text-green-600 bg-green-50', rejected: 'text-red-600 bg-red-50', pending: 'text-amber-600 bg-amber-50', cancelled: 'text-ink-400 bg-ink-50' };
      return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${colors[s] || ''}`}>{s}</span>;
    }},
    { key: 'requester', label: 'Requester', render: r => r.hrEmployees?.firstName + ' ' + r.hrEmployees?.lastName || '-' },
    { key: 'created', label: 'Created', render: r => new Date(r.hr_approval_requests?.createdAt || r.created_at || r.createdAt).toLocaleDateString(), hideOnMobile: true },
    { key: 'decided', label: 'Decided', render: r => r.hr_approval_requests?.decidedAt || r.decidedAt ? new Date(r.hr_approval_requests?.decidedAt || r.decidedAt).toLocaleDateString() : '-', hideOnMobile: true },
  ];

  return (
    <HrPageShell title="Approval History" description="Complete record of all approval requests">
      <HrFilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Filter by module..."
        statusFilter={statusFilter} onStatusChange={setStatusFilter}
        statusOptions={[{ value: '', label: 'All Statuses' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'cancelled', label: 'Cancelled' }]}
        onClear={() => { setSearch(''); setStatusFilter(''); }} hasActiveFilters={!!search || !!statusFilter} />
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.hr_approval_requests?.id || r.id}
        loading={loading} emptyMessage="No approval history found" onRowClick={viewDetails} />

      <HrViewDrawer open={!!selected} onClose={() => { setSelected(null); setSteps([]); }}
        title={selected?.hr_approval_requests?.title || selected?.title || 'Request Details'}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-ink-400">Module:</span> <span className="capitalize font-medium">{selected.hr_approval_requests?.module || selected.module}</span></div>
              <div><span className="text-ink-400">Status:</span> <span className="capitalize font-medium">{selected.hr_approval_requests?.status || selected.status}</span></div>
              <div><span className="text-ink-400">Priority:</span> <span className="capitalize font-medium">{selected.hr_approval_requests?.priority || selected.priority || 'normal'}</span></div>
              <div><span className="text-ink-400">Created:</span> <span className="font-medium">{new Date(selected.hr_approval_requests?.createdAt || selected.created_at || selected.createdAt).toLocaleString()}</span></div>
              {(selected.hr_approval_requests?.decidedAt || selected.decidedAt) && (
                <div><span className="text-ink-400">Decided:</span> <span className="font-medium">{new Date(selected.hr_approval_requests?.decidedAt || selected.decidedAt).toLocaleString()}</span></div>
              )}
            </div>
            {selected.hr_approval_requests?.comment || selected.comment ? (
              <div><span className="text-sm text-ink-400">Comment:</span><p className="text-sm mt-1">{selected.hr_approval_requests?.comment || selected.comment}</p></div>
            ) : null}
            <div>
              <h4 className="text-sm font-semibold text-ink-700 mb-2">Steps</h4>
              <div className="space-y-1">
                {steps.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg text-sm border border-border-custom">
                    <span className="font-medium">{s.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                      s.status === 'approved' ? 'bg-green-100 text-green-700' :
                      s.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-ink-100 text-ink-500'
                    }`}>{s.status?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </HrViewDrawer>
    </HrPageShell>
  );
}

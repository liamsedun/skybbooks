import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, ArrowLeft, MessageSquare, User, Clock, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrViewDrawer } from '../../../components/hr/HrViewDrawer';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';

export function ApprovalMyQueuePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showConfirm, setShowConfirm] = useState<{ type: string } | null>(null);

  const load = () => {
    setLoading(true);
    hrApi.getMyApprovalQueue().then(r => { setRows(r.data || []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const columns: Column<any>[] = [
    { key: 'title', label: 'Title', render: r => r.hr_approval_requests?.title || 'Untitled', className: 'font-medium' },
    { key: 'module', label: 'Module', render: r => <span className="capitalize text-xs bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{(r.hr_approval_requests?.module || '').replace(/_/g, ' ')}</span> },
    { key: 'priority', label: 'Priority', render: r => {
      const p = r.hr_approval_requests?.priority;
      const colors: Record<string, string> = { urgent: 'text-red-600', high: 'text-orange-500', normal: 'text-blue-500', low: 'text-ink-400' };
      return <span className={`capitalize text-xs font-semibold ${colors[p] || ''}`}>{p || 'normal'}</span>;
    }},
    { key: 'step', label: 'Current Step', render: r => r.hr_approval_step_instances?.label || '-' },
    { key: 'requester', label: 'Requester', render: r => r.hrEmployees?.firstName + ' ' + r.hrEmployees?.lastName || r.hr_employees?.firstName + ' ' + r.hr_employees?.lastName || '-' },
    { key: 'created', label: 'Created', render: r => new Date(r.hr_approval_requests?.createdAt || r.created_at).toLocaleDateString(), hideOnMobile: true },
  ];

  const handleAction = async (type: string) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const id = selected.hr_approval_requests?.id || selected.id;
      if (type === 'approve') await hrApi.approveApprovalStep(id, comment);
      else if (type === 'reject') await hrApi.rejectApprovalStep(id, comment);
      else if (type === 'send-back') await hrApi.sendBackApprovalStep(id, comment);
      setSelected(null); setComment(''); load();
    } catch (e: any) { alert(e?.response?.data?.error || e.message); }
    setActionLoading(false); setShowConfirm(null);
  };

  const viewDetails = async (item: any) => {
    setSelected(item);
    const id = item.hr_approval_requests?.id || item.id;
    const [s, c] = await Promise.all([
      hrApi.getApprovalSteps(id).catch(() => ({ data: [] })),
      hrApi.getApprovalComments(id).catch(() => ({ data: [] })),
    ]);
    setSteps(s.data || []); setComments(c.data || []);
  };

  return (
    <HrPageShell title="My Approval Queue" description="Requests awaiting your decision">
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.hr_approval_requests?.id || r.id}
        loading={loading} emptyMessage="No pending approvals in your queue" onRowClick={viewDetails} />

      <HrViewDrawer open={!!selected} onClose={() => { setSelected(null); setSteps([]); setComments([]); }}
        title={selected?.hr_approval_requests?.title || 'Approval Request'}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-ink-400">Module:</span> <span className="capitalize font-medium">{(selected.hr_approval_requests?.module || '').replace(/_/g, ' ')}</span></div>
              <div><span className="text-ink-400">Priority:</span> <span className="capitalize font-medium">{selected.hr_approval_requests?.priority || 'normal'}</span></div>
              <div><span className="text-ink-400">Status:</span> <span className="capitalize font-medium">{selected.hr_approval_requests?.status}</span></div>
              <div><span className="text-ink-400">Created:</span> <span className="font-medium">{new Date(selected.hr_approval_requests?.createdAt || selected.created_at).toLocaleString()}</span></div>
            </div>
            {selected.hr_approval_requests?.description && (
              <div><span className="text-sm text-ink-400">Description:</span><p className="text-sm mt-1">{selected.hr_approval_requests.description}</p></div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-ink-700 mb-2">Approval Steps</h4>
              <div className="space-y-2">
                {steps.map((s: any) => (
                  <div key={s.id} className={`flex items-center justify-between p-2 rounded-lg text-sm border ${s.status === 'in_progress' ? 'border-primary/30 bg-primary/5' : 'border-border-custom'}`}>
                    <div>
                      <span className="font-medium">{s.label}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full capitalize ${
                        s.status === 'approved' ? 'bg-green-100 text-green-700' :
                        s.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        s.status === 'sent_back' ? 'bg-amber-100 text-amber-700' :
                        'bg-ink-100 text-ink-500'
                      }`}>{s.status?.replace(/_/g, ' ')}</span>
                    </div>
                    {s.decidedAt && <span className="text-xs text-ink-400">{new Date(s.decidedAt).toLocaleDateString()}</span>}
                  </div>
                ))}
                {steps.length === 0 && <p className="text-xs text-ink-400">No steps loaded</p>}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-ink-700 mb-2">Comments</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {comments.map((c: any) => (
                  <div key={c.id} className="text-sm p-2 bg-ink-50 dark:bg-ink-800/50 rounded-lg">
                    <span className="font-medium text-xs">{c.hrEmployees?.firstName || 'User'}: </span>
                    {c.comment}
                  </div>
                ))}
                {comments.length === 0 && <p className="text-xs text-ink-400">No comments yet</p>}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-ink-700 mb-2">Your Decision</h4>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface resize-none"
                rows={3} placeholder="Add a comment..." />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setShowConfirm({ type: 'approve' })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  disabled={actionLoading}><CheckCircle className="w-4 h-4" />Approve</button>
                <button onClick={() => setShowConfirm({ type: 'reject' })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={actionLoading}><XCircle className="w-4 h-4" />Reject</button>
                <button onClick={() => setShowConfirm({ type: 'send-back' })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  disabled={actionLoading}><ArrowLeft className="w-4 h-4" />Send Back</button>
              </div>
            </div>
          </div>
        )}
      </HrViewDrawer>

      <HrConfirmDialog open={!!showConfirm} onClose={() => setShowConfirm(null)} onConfirm={() => handleAction(showConfirm!.type)}
        title={`${showConfirm?.type === 'approve' ? 'Approve' : showConfirm?.type === 'reject' ? 'Reject' : 'Send Back'} Request`}
        message={`Are you sure you want to ${showConfirm?.type} this approval request?`} loading={actionLoading}
        confirmLabel={showConfirm?.type === 'approve' ? 'Approve' : showConfirm?.type === 'reject' ? 'Reject' : 'Send Back'} />
    </HrPageShell>
  );
}

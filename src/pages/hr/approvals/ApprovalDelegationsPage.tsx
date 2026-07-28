import { useState, useEffect } from 'react';
import { Plus, Trash2, User, Calendar } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';

export function ApprovalDelegationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ delegatorId: '', delegateId: '', module: '', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); hrApi.getDelegations().then(r => { setRows(r.data || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await hrApi.createDelegation(form);
      setShowForm(false); load();
    } catch (e: any) { alert(e?.response?.data?.error || e.message); }
    setSaving(false);
  };

  const del = async () => {
    if (showDelete) { await hrApi.deleteDelegation(showDelete); setShowDelete(null); load(); }
  };

  const columns: Column<any>[] = [
    { key: 'delegator', label: 'Delegator', render: r => r.hrEmployees?.firstName + ' ' + r.hrEmployees?.lastName || r.hr_employees?.firstName + ' ' + r.hr_employees?.lastName || r.delegatorId?.slice(0, 8) },
    { key: 'delegate', label: 'Delegate', render: r => r.hr_employees?.firstName + ' ' + r.hr_employees?.lastName || r.delegateId?.slice(0, 8) },
    { key: 'module', label: 'Module', render: r => r.module ? <span className="capitalize text-xs bg-ink-100 px-2 py-0.5 rounded-full">{r.module}</span> : <span className="text-xs text-ink-400">All</span> },
    { key: 'dates', label: 'Dates', render: r => <span className="text-xs">{new Date(r.startDate).toLocaleDateString()}{r.endDate ? ` - ${new Date(r.endDate).toLocaleDateString()}` : ''}</span> },
    { key: 'active', label: 'Active', render: r => r.isActive ? <span className="text-xs text-green-600 font-semibold">Yes</span> : <span className="text-xs text-ink-400">No</span> },
    { key: 'actions', label: '', render: r => (
      <button onClick={e => { e.stopPropagation(); setShowDelete(r.id); }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
    )},
  ];

  return (
    <HrPageShell title="Approval Delegations" description="Delegate approval authority to another employee"
      headerActions={<button onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90"><Plus className="w-3.5 h-3.5" />New Delegation</button>}>
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.id} loading={loading} emptyMessage="No delegations set up" />

      <HrFormModal open={showForm} onClose={() => setShowForm(false)} onSubmit={e => { e.preventDefault(); save(); }} title="New Delegation" loading={saving}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600">Delegator ID</label>
            <input value={form.delegatorId} onChange={e => setForm({ ...form, delegatorId: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="Employee UUID" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Delegate ID</label>
            <input value={form.delegateId} onChange={e => setForm({ ...form, delegateId: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="Employee UUID" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Module (optional)</label>
            <input value={form.module} onChange={e => setForm({ ...form, module: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="leave_request, travel_request, etc." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-600">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Reason</label>
            <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" rows={2} />
          </div>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={del}
        title="Delete Delegation" message="Remove this delegation?" />
    </HrPageShell>
  );
}

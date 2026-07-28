import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';

export function ApprovalConfigsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', module: '', steps: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); hrApi.getApprovalConfigs().then(r => { setRows(r.data || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const openEdit = (row: any) => {
    setForm({ name: row.name, module: row.module, steps: JSON.stringify(row.steps, null, 2), isActive: row.isActive });
    setEditing(row); setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      let steps: any[];
      try { steps = JSON.parse(form.steps); } catch { steps = [{ stepName: form.steps || 'approver', order: 1 }]; }
      const payload = { name: form.name, module: form.module, steps, isActive: form.isActive };
      if (editing) await hrApi.updateApprovalConfig(editing.id, payload);
      else await hrApi.createApprovalConfig(payload);
      setShowForm(false); setEditing(null); load();
    } catch (e: any) { alert(e?.response?.data?.error || e.message); }
    setSaving(false);
  };

  const columns: Column<any>[] = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'module', label: 'Module', render: r => <span className="capitalize text-xs bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{r.module}</span> },
    { key: 'steps', label: 'Steps', render: r => <span className="text-xs">{(r.steps as any[] || []).map((s: any) => s.stepName || s.label).join(', ') || '-'}</span> },
    { key: 'status', label: 'Active', render: r => r.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-ink-300" /> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800"><Edit3 className="w-3.5 h-3.5 text-ink-400" /></button>
        <button onClick={() => setShowDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <HrPageShell title="Approval Configurations" description="Define multi-step approval workflows per module"
      headerActions={<button onClick={() => { setEditing(null); setForm({ name: '', module: '', steps: JSON.stringify([{ stepName: 'maker', order: 1 }, { stepName: 'reviewer', order: 2 }, { stepName: 'approver', order: 3 }, { stepName: 'final_approval', order: 4 }], null, 2), isActive: true }); setShowForm(true); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90"><Plus className="w-3.5 h-3.5" />New Config</button>}>
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.id} loading={loading}
        emptyMessage="No approval configs yet" emptyIcon={<Settings className="w-8 h-8 text-ink-300" />}
        onRowClick={openEdit} />

      <HrFormModal open={showForm} onClose={() => setShowForm(false)} onSubmit={(e) => { e.preventDefault(); save(); }} title={editing ? 'Edit Config' : 'New Config'} loading={saving}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600">Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="e.g. Leave Approval" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Module</label>
            <input value={form.module} onChange={e => setForm({ ...form, module: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="e.g. leave_request" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Steps (JSON)</label>
            <textarea value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1 font-mono" rows={8} />
            <p className="text-[10px] text-ink-400 mt-1">Array of {stepName}: maker, reviewer, approver, final_approval</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={async () => { if (showDelete) { await hrApi.deleteApprovalConfig(showDelete); setShowDelete(null); load(); } }}
        title="Delete Config" message="Are you sure you want to delete this approval configuration?" />
    </HrPageShell>
  );
}

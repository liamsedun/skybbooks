import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';

export function WorkflowTemplatesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', steps: '', isActive: true });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); hrApi.getWorkflowTemplates().then(r => { setRows(r.data || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const openEdit = (row: any) => {
    setForm({ name: row.name, description: row.description || '', steps: JSON.stringify(row.steps, null, 2), isActive: row.isActive });
    setEditing(row); setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      let steps: any[];
      try { steps = JSON.parse(form.steps); } catch { steps = []; }
      const payload = { name: form.name, description: form.description, steps, isActive: form.isActive };
      if (editing) await hrApi.updateWorkflowTemplate(editing.id, payload);
      else await hrApi.createWorkflowTemplate(payload);
      setShowForm(false); setEditing(null); load();
    } catch (e: any) { alert(e?.response?.data?.error || e.message); }
    setSaving(false);
  };

  const columns: Column<any>[] = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'description', label: 'Description', render: r => <span className="text-xs text-ink-500 truncate max-w-[200px] block">{r.description || '-'}</span> },
    { key: 'steps', label: 'Steps', render: r => <span className="text-xs font-mono bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{(r.steps as any[] || []).length}</span> },
    { key: 'status', label: 'Status', render: r => r.isActive
      ? <span className="text-[11px] font-medium text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400 px-2 py-0.5 rounded-full">Active</span>
      : <span className="text-[11px] font-medium text-ink-500 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">Inactive</span> },
    { key: 'createdAt', label: 'Created At', render: r => <span className="text-xs text-ink-400">{new Date(r.createdAt).toLocaleDateString()}</span> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800"><Edit2 className="w-3.5 h-3.5 text-ink-400" /></button>
        <button onClick={() => setShowDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <HrPageShell title="Workflow Templates" description="Create and manage workflow templates for HR processes"
      headerActions={<button onClick={() => { setEditing(null); setForm({ name: '', description: '', steps: '[]', isActive: true }); setShowForm(true); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90"><Plus className="w-3.5 h-3.5" />New Template</button>}>
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.id} loading={loading}
        emptyMessage="No workflow templates yet" />

      <HrFormModal open={showForm} onClose={() => setShowForm(false)} onSubmit={(e) => { e.preventDefault(); save(); }} title={editing ? 'Edit Template' : 'New Template'} loading={saving}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600">Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="e.g. Leave Workflow" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" rows={3} placeholder="Brief description of this workflow" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Steps (JSON)</label>
            <textarea value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1 font-mono" rows={8} />
            <p className="text-[10px] text-ink-400 mt-1">Array of step objects e.g. {`{ "stepName": "review", "order": 1, "assigneeType": "role" }`}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={async () => { if (showDelete) { await hrApi.deleteWorkflowTemplate(showDelete); setShowDelete(null); load(); } }}
        title="Delete Template" message="Are you sure you want to delete this workflow template?" />
    </HrPageShell>
  );
}

export default WorkflowTemplatesPage;

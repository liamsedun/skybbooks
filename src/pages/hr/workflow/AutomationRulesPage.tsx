import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';

const EVENT_OPTIONS = [
  'leave.created', 'leave.approved', 'travel.created',
  'expense.created', 'ticket.created', 'bonus.created', 'salary_review.created',
];

function AutomationRulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', event: '', conditions: '{}', actions: '[]',
    templateId: '', schedule: '', isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); hrApi.getAutomationRules().then(r => { setRows(r.data || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const openEdit = (row: any) => {
    setForm({
      name: row.name, event: row.event,
      conditions: JSON.stringify(row.conditions || {}, null, 2),
      actions: JSON.stringify(row.actions || [], null, 2),
      templateId: row.templateId || '', schedule: row.schedule || '',
      isActive: row.isActive,
    });
    setEditing(row); setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name, event: form.event,
        conditions: JSON.parse(form.conditions),
        actions: JSON.parse(form.actions),
        templateId: form.templateId || undefined,
        schedule: form.schedule || undefined,
        isActive: form.isActive,
      };
      if (editing) await hrApi.updateAutomationRule(editing.id, payload);
      else await hrApi.createAutomationRule(payload);
      setShowForm(false); setEditing(null); load();
    } catch (e: any) { alert(e?.response?.data?.error || e.message); }
    setSaving(false);
  };

  const columns: Column<any>[] = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'event', label: 'Event', render: r => <span className="text-xs bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">{r.event}</span> },
    { key: 'template', label: 'Template', render: r => <span className="text-xs">{r.templateId || '-'}</span> },
    { key: 'schedule', label: 'Schedule', render: r => <span className="text-xs">{r.schedule || '-'}</span> },
    { key: 'status', label: 'Status', render: r => r.isActive
      ? <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Active</span>
      : <span className="text-xs text-ink-400 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded-full">Inactive</span> },
    { key: 'lastTriggered', label: 'Last Triggered', render: r => <span className="text-xs">{r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toLocaleDateString() : '-'}</span> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800"><Edit2 className="w-3.5 h-3.5 text-ink-400" /></button>
        <button onClick={() => setShowDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <HrPageShell title="Automation Rules" description="Automate HR workflows triggered by events"
      headerActions={<button onClick={() => { setEditing(null); setForm({ name: '', event: '', conditions: '{}', actions: '[]', templateId: '', schedule: '', isActive: true }); setShowForm(true); }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90"><Plus className="w-3.5 h-3.5" />New Rule</button>}>
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.id} loading={loading}
        emptyMessage="No automation rules yet" onRowClick={openEdit} />

      <HrFormModal open={showForm} onClose={() => setShowForm(false)} onSubmit={(e) => { e.preventDefault(); save(); }} title={editing ? 'Edit Rule' : 'New Rule'} loading={saving}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600">Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="e.g. Notify manager on leave" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Event</label>
            <select value={form.event} onChange={e => setForm({ ...form, event: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1">
              <option value="">Select event</option>
              {EVENT_OPTIONS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Conditions (JSON)</label>
            <textarea value={form.conditions} onChange={e => setForm({ ...form, conditions: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1 font-mono" rows={4} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Actions (JSON)</label>
            <textarea value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1 font-mono" rows={4} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Template ID (optional)</label>
            <input value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="e.g. leave-notification" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Schedule (optional)</label>
            <input value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="e.g. 0 9 * * *" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={async () => { if (showDelete) { await hrApi.deleteAutomationRule(showDelete); setShowDelete(null); load(); } }}
        title="Delete Rule" message="Are you sure you want to delete this automation rule?" />
    </HrPageShell>
  );
}

export { AutomationRulesPage };
export default AutomationRulesPage;

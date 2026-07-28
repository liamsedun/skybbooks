import { useEffect, useState } from 'react';
import { Plus, Trash2, Play } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable } from '../../../components/hr/HrDataTable';
import type { Column } from '../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../components/hr/HrConfirmDialog';

interface ReminderConfig {
  id: string;
  name: string;
  type: string;
  schedule: string;
  recipients: string[];
  isActive: boolean;
  lastRunAt: string | null;
}

const TYPE_OPTIONS = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'probation', label: 'Probation' },
  { value: 'contract_expiry', label: 'Contract Expiry' },
  { value: 'custom', label: 'Custom' },
];

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReminderConfigsPage() {
  const [data, setData] = useState<ReminderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('birthday');
  const [formSchedule, setFormSchedule] = useState('');
  const [formRecipients, setFormRecipients] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await hrApi.getReminderConfigs();
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch {
      setError('Failed to load reminder configs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function openAddModal() {
    setFormName('');
    setFormType('birthday');
    setFormSchedule('');
    setFormRecipients('');
    setFormIsActive(true);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) { setFormError('Name is required'); return; }
    if (!formSchedule.trim()) { setFormError('Schedule is required'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const recipients = formRecipients
        .split(',')
        .map(r => r.trim())
        .filter(Boolean);
      await hrApi.createReminderConfig({
        name: formName.trim(),
        type: formType,
        schedule: formSchedule.trim(),
        recipients,
        isActive: formIsActive,
      });
      setModalOpen(false);
      await fetchData();
    } catch {
      setFormError('Failed to create reminder config');
    } finally {
      setSubmitting(false);
    }
  }

  function openDelete(id: string) {
    setDeleteTarget(id);
    setConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await hrApi.deleteReminderConfig(deleteTarget);
      setConfirmOpen(false);
      setDeleteTarget(null);
      await fetchData();
    } catch {
      setFormError('Failed to delete reminder config');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    try {
      await hrApi.runScheduledAlerts();
      await fetchData();
    } catch {
      setError('Failed to run alerts');
    } finally {
      setRunning(false);
    }
  }

  const columns: Column<ReminderConfig>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (i) => <span className="font-medium text-ink-900">{i.name}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (i) => {
        const opt = TYPE_OPTIONS.find(o => o.value === i.type);
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 capitalize">
            {opt?.label ?? i.type}
          </span>
        );
      },
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (i) => <span className="font-mono text-xs text-ink-500">{i.schedule}</span>,
    },
    {
      key: 'recipients',
      label: 'Recipients',
      render: (i) => (
        <span className="text-ink-600 text-xs">
          {i.recipients?.length ?? 0} recipient{(i.recipients?.length ?? 0) !== 1 ? 's' : ''}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (i) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
          i.isActive
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
            : 'bg-ink-50 dark:bg-ink-800 text-ink-400 dark:text-ink-500 border-ink-200 dark:border-ink-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${i.isActive ? 'bg-emerald-500' : 'bg-ink-300'}`} />
          {i.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'lastRunAt',
      label: 'Last Run',
      render: (i) => <span className="text-ink-500 text-xs">{fmtDate(i.lastRunAt)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'actions',
      label: '',
      render: (i) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openDelete(i.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <HrPageShell
      title="Reminder Configs"
      description="Manage HR reminder and alert configurations"
      headerActions={
        <>
          <button onClick={handleRunNow} disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom text-ink-600 text-xs font-medium rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition-all disabled:opacity-50">
            <Play className="w-3.5 h-3.5" />
            {running ? 'Running...' : 'Run Now'}
          </button>
          <button onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Reminder
          </button>
        </>
      }>
      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
        Reminder configs control automated notifications for key HR events. Use "Run Now" to trigger all active configs immediately.
      </div>

      <HrDataTable
        columns={columns}
        data={data}
        keyExtractor={i => i.id}
        loading={loading}
        error={error}
        emptyMessage="No reminder configs"
        emptyAction={
          <button onClick={openAddModal} className="text-xs font-medium text-primary">Add your first reminder</button>
        }
      />

      <HrFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Reminder Config"
        onSubmit={handleCreate}
        error={formError}
        loading={submitting}
        submitLabel="Create">
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Name</label>
          <input value={formName} onChange={e => setFormName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="e.g. Birthday Reminder" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Type</label>
          <select value={formType} onChange={e => setFormType(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Schedule</label>
          <input value={formSchedule} onChange={e => setFormSchedule(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
            placeholder="e.g. 0 8 * * * (cron expression)" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">Recipients (comma-separated emails)</label>
          <input value={formRecipients} onChange={e => setFormRecipients(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="admin@example.com, manager@example.com" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-ink-500">Active</label>
          <button type="button" role="switch" aria-checked={formIsActive}
            onClick={() => setFormIsActive(!formIsActive)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${formIsActive ? 'bg-primary' : 'bg-ink-200 dark:bg-ink-700'}`}>
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition-transform ${formIsActive ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      </HrFormModal>

      <HrConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDelete}
        title="Delete Reminder Config"
        message="Are you sure you want to delete this reminder config? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={submitting}
      />
    </HrPageShell>
  );
}

export default ReminderConfigsPage;

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Trash2, RefreshCw } from 'lucide-react';
import { HrPageShell } from '../../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../../components/hr/HrDataTable';
import { HrFormModal } from '../../../../components/hr/HrFormModal';
import { HrConfirmDialog } from '../../../../components/hr/HrConfirmDialog';
import { hrApi } from '../../../../lib/api';

const REPORT_TYPES = ['employees', 'leave', 'attendance', 'performance', 'compensation', 'turnover', 'recruitment', 'travel'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'];

export function SchedulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', reportType: 'employees', frequency: 'weekly', recipients: '', format: 'csv', isActive: true });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); hrApi.getScheduledReports().then(r => { setRows(r.data || []); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await hrApi.createScheduledReport({
        ...form,
        recipients: form.recipients ? form.recipients.split(',').map((s: string) => s.trim()) : [],
      });
      setShowForm(false); load();
    } catch (e: any) { alert(e?.response?.data?.error || e.message); }
    setSaving(false);
  };

  const columns: Column<any>[] = [
    { key: 'name', label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { key: 'reportType', label: 'Type', render: r => <span className="capitalize text-xs bg-ink-100 px-2 py-0.5 rounded-full">{r.reportType}</span> },
    { key: 'frequency', label: 'Frequency', render: r => <span className="capitalize text-xs">{r.frequency}</span> },
    { key: 'format', label: 'Format', render: r => <span className="uppercase text-xs font-mono">{r.format}</span> },
    { key: 'active', label: 'Active', render: r => r.isActive ? <span className="text-xs text-green-600 font-semibold">Yes</span> : <span className="text-xs text-ink-400">No</span> },
    { key: 'actions', label: '', render: r => (
      <button onClick={e => { e.stopPropagation(); setShowDelete(r.id); }} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
    )},
  ];

  return (
    <HrPageShell title="Scheduled Reports" description="Automate report generation and email delivery"
      headerActions={<button onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90"><Plus className="w-3.5 h-3.5" />New Schedule</button>}>
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.id} loading={loading}
        emptyMessage="No scheduled reports yet" emptyIcon={<Calendar className="w-8 h-8 text-ink-300" />} />

      <HrFormModal open={showForm} onClose={() => setShowForm(false)} onSubmit={e => { e.preventDefault(); save(); }} title="New Schedule" loading={saving}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600">Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="Weekly Employee Report" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Report Type</label>
            <select value={form.reportType} onChange={e => setForm({ ...form, reportType: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1">
              {REPORT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-600">Frequency</label>
              <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
                className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1">
                {FREQUENCIES.map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Format</label>
              <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1">
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Recipients (comma-separated emails)</label>
            <input value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })}
              className="w-full border border-border-custom rounded-lg p-2 text-sm bg-surface mt-1" placeholder="hr@company.com, manager@company.com" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </HrFormModal>

      <HrConfirmDialog open={!!showDelete} onClose={() => setShowDelete(null)} onConfirm={async () => { if (showDelete) { await hrApi.deleteScheduledReport(showDelete); setShowDelete(null); load(); } }}
        title="Delete Schedule" message="Remove this scheduled report?" />
    </HrPageShell>
  );
}

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Users, Mail, CheckCircle, FileText, Plus,
  Search, Filter, Calendar, Clock, Trash2, Pencil, X,
  Loader2, AlertCircle, Save
} from 'lucide-react';
import { crmApi, api } from '../../lib/api';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  call: Phone, meeting: Users, email: Mail, task: CheckCircle, note: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-600',
  meeting: 'bg-purple-100 text-purple-600',
  email: 'bg-amber-100 text-amber-600',
  task: 'bg-green-100 text-green-600',
  note: 'bg-slate-100 text-slate-600',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'task', 'note'];

const EMPTY_FORM = {
  type: 'call', subject: '', description: '', dealId: '',
  contactId: '', assignedTo: '', dueDate: '',
};

export function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: activitiesRes, isLoading } = useQuery({
    queryKey: ['crm-activities'],
    queryFn: async () => { const r = await crmApi.getActivities(); return r.data as any[]; },
  });
  const activities = activitiesRes || [];

  const { data: dealsRes } = useQuery({
    queryKey: ['crm-deals'],
    queryFn: async () => { const r = await crmApi.getDeals(); return r.data as any[]; },
  });
  const deals = dealsRes || [];

  const { data: customersRes } = useQuery({
    queryKey: ['crm-customers'],
    queryFn: async () => { const r = await api.get('/sales/customers'); return r.data.data as any[]; },
  });
  const customers = customersRes || [];

  const { data: usersRes } = useQuery({
    queryKey: ['crm-users'],
    queryFn: async () => { const r = await api.get('/users'); return r.data.data as any[]; },
  });
  const users = usersRes || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await crmApi.createActivity(data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-activities'] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await crmApi.updateActivity(id, data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-activities'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await crmApi.deleteActivity(id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-activities'] }); setDetailId(null); },
  });

  const filtered = useMemo(() => {
    let list = activities;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a: any) =>
        a.subject?.toLowerCase().includes(q) ||
        a.dealTitle?.toLowerCase().includes(q) ||
        a.contactName?.toLowerCase().includes(q)
      );
    }
    if (filterType) list = list.filter((a: any) => a.type === filterType);
    if (filterStatus) list = list.filter((a: any) => a.status === filterStatus);
    return list;
  }, [activities, search, filterType, filterStatus]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setConfirmDelete(false);
    setShowCreate(true);
  }

  function openEdit(a: any) {
    setEditId(a.id);
    setForm({
      type: a.type || 'call',
      subject: a.subject || '',
      description: a.description || '',
      dealId: a.dealId || '',
      contactId: a.contactId || '',
      assignedTo: a.assignedTo || '',
      dueDate: a.dueDate ? a.dueDate.slice(0, 10) : '',
    });
    setConfirmDelete(false);
    setShowCreate(true);
  }

  function closeForm() {
    setShowCreate(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setConfirmDelete(false);
  }

  function handleSave() {
    const payload: any = { ...form };
    if (!payload.dealId) delete payload.dealId;
    if (!payload.contactId) delete payload.contactId;
    if (!payload.assignedTo) delete payload.assignedTo;
    if (!payload.dueDate) delete payload.dueDate;
    if (!payload.description) delete payload.description;
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  const detailActivity = detailId ? activities.find((a: any) => a.id === detailId) : null;

  if (detailId && detailActivity) {
    const TypeIcon = TYPE_ICONS[detailActivity.type] || FileText;
    const typeColor = TYPE_COLORS[detailActivity.type] || 'bg-slate-100 text-slate-600';
    const statusStyle = STATUS_STYLES[detailActivity.status] || 'bg-slate-100 text-slate-600';
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setDetailId(null)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover text-ink-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-ink-900">Activity Details</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setDetailId(null); openEdit(detailActivity); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-500 bg-surface border border-border-custom rounded-xl hover:bg-surface-hover transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={() => { if (confirm('Are you sure you want to delete this activity?')) handleDelete(detailActivity.id); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-surface border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${typeColor}`}>
              <TypeIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink-900">{detailActivity.subject}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${statusStyle}`}>
                {detailActivity.status || 'pending'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Type</span>
              <span className="text-ink-700 font-medium capitalize">{detailActivity.type}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Related Deal</span>
              <span className="text-ink-700 font-medium">{detailActivity.dealTitle || '—'}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Contact</span>
              <span className="text-ink-700 font-medium">{detailActivity.contactName || '—'}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Assignee</span>
              <span className="text-ink-700 font-medium">{detailActivity.assigneeName || '—'}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Due Date</span>
              <span className="text-ink-700 font-medium">{fmtDate(detailActivity.dueDate)}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Completed At</span>
              <span className="text-ink-700 font-medium">{fmtDateTime(detailActivity.completedAt)}</span>
            </div>
            <div>
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider">Created At</span>
              <span className="text-ink-700 font-medium">{fmtDateTime(detailActivity.createdAt)}</span>
            </div>
          </div>
          {detailActivity.description && (
            <div className="mt-4 pt-4 border-t border-border-custom">
              <span className="text-ink-400 block text-[10px] font-semibold uppercase tracking-wider mb-1">Description</span>
              <p className="text-xs text-ink-700 whitespace-pre-wrap">{detailActivity.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">

        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Activity
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input type="text" placeholder="Search activities..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface text-ink-600">
          <option value="">All Types</option>
          {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface text-ink-600">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-ink-300 mb-3" />
          <p className="text-sm font-medium text-ink-500">No activities found</p>
          <p className="text-xs text-ink-400 mt-1">Create a new activity to start tracking interactions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((a: any) => {
            const TypeIcon = TYPE_ICONS[a.type] || FileText;
            const typeColor = TYPE_COLORS[a.type] || 'bg-slate-100 text-slate-600';
            const statusStyle = STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600';
            return (
              <button key={a.id} onClick={() => setDetailId(a.id)}
                className="w-full text-left bg-surface rounded-xl border border-border-custom shadow-sm p-3.5 hover:shadow-md hover:border-primary/20 transition-all duration-200 group">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${typeColor} shrink-0`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-900 truncate">{a.subject}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${statusStyle}`}>
                        {a.status || 'pending'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                      {a.dealTitle && <span className="text-[10px] text-ink-400">Deal: {a.dealTitle}</span>}
                      {a.contactName && <span className="text-[10px] text-ink-400">Contact: {a.contactName}</span>}
                      {a.assigneeName && <span className="text-[10px] text-ink-400">· {a.assigneeName}</span>}
                      {a.dueDate && (
                        <span className="text-[10px] text-ink-400 flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" /> {fmtDate(a.dueDate)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-ink-300 mt-0.5">{fmtDateTime(a.createdAt)}</div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRightIcon className="w-4 h-4 text-ink-300" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeForm}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl"><FileText className="w-5 h-5" /></div>
                <h2 className="text-base font-bold">{editId ? 'Edit Activity' : 'New Activity'}</h2>
              </div>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Type *</label>
                <select value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                >
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Subject *</label>
                <input type="text" placeholder="e.g. Follow-up call with client" value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Description</label>
                <textarea rows={3} placeholder="Details about this activity..." value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Related Deal</label>
                <select value={form.dealId}
                  onChange={e => setForm(p => ({ ...p, dealId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                >
                  <option value="">No deal</option>
                  {deals.map((d: any) => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Contact</label>
                <select value={form.contactId}
                  onChange={e => setForm(p => ({ ...p, contactId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                >
                  <option value="">No contact</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Assigned To</label>
                <select value={form.assignedTo}
                  onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                >
                  <option value="">Unassigned</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name || u.fullName || u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Due Date</label>
                <input type="date" value={form.dueDate}
                  onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div></div>
              <div className="flex items-center gap-2.5">
                <button onClick={closeForm} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={!form.subject || !form.type || createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-sm transition-all disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

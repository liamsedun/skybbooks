import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Filter, Plus, DollarSign, Calendar, Percent,
  Loader2, X, AlertCircle, Kanban, User, Save, Trash2, ChevronRight
} from 'lucide-react';
import { crmApi, api } from '../../lib/api';

function fmtNaira(v: number): string {
  return `\u20A6${(v / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const EMPTY_DEAL_FORM = {
  title: '', contactId: '', value: '', currency: 'NGN', source: '',
  probability: '', expectedCloseDate: '', notes: '', assignedTo: '', stageId: '',
};

export function DealsTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_DEAL_FORM);
  const [contactSearch, setContactSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const contactIdFilter = searchParams.get('contactId');

  const { data: stagesRes } = useQuery({
    queryKey: ['crm-stages'],
    queryFn: async () => { const r = await crmApi.getStages(); return r.data as any[]; },
  });
  const stages = stagesRes || [];

  const { data: dealsRes, isLoading } = useQuery({
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
    mutationFn: async (data: any) => { const r = await crmApi.createDeal(data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-deals'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await crmApi.updateDeal(id, data); return r.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-deals'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await crmApi.deleteDeal(id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-deals'] }); closeModal(); },
  });

  const filteredDeals = useMemo(() => {
    let list = deals;
    if (contactIdFilter) list = list.filter((d: any) => d.contactId === contactIdFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d: any) =>
        d.title?.toLowerCase().includes(q) ||
        d.contactName?.toLowerCase().includes(q)
      );
    }
    if (filterStage) list = list.filter((d: any) => d.stageId === filterStage);
    if (filterStatus) list = list.filter((d: any) => d.status === filterStatus);
    if (filterSource) list = list.filter((d: any) => d.source === filterSource);
    return list;
  }, [deals, contactIdFilter, search, filterStage, filterStatus, filterSource]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    deals.forEach((d: any) => { if (d.source) s.add(d.source); });
    return Array.from(s);
  }, [deals]);

  function openEdit(deal: any) {
    setEditId(deal.id);
    setForm({
      title: deal.title || '',
      contactId: deal.contactId || '',
      value: deal.value ? String(deal.value) : '',
      currency: deal.currency || 'NGN',
      source: deal.source || '',
      probability: deal.probability ? String(deal.probability) : '',
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '',
      notes: deal.notes || '',
      assignedTo: deal.assignedTo || '',
      stageId: deal.stageId || '',
    });
    setConfirmDelete(false);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setForm(EMPTY_DEAL_FORM);
    setContactSearch('');
    setConfirmDelete(false);
  }

  function handleSave() {
    const payload: any = { ...form };
    payload.value = form.value ? Math.round(parseFloat(form.value) * 100) : 0;
    payload.probability = form.probability ? parseInt(form.probability) : 0;
    if (!payload.contactId) delete payload.contactId;
    if (!payload.assignedTo) delete payload.assignedTo;
    if (!payload.expectedCloseDate) delete payload.expectedCloseDate;
    if (!payload.notes) delete payload.notes;
    if (!payload.source) delete payload.source;
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleDelete() {
    if (editId) deleteMutation.mutate(editId);
  }

  const filteredContacts = contactSearch
    ? customers.filter((c: any) =>
        c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(contactSearch.toLowerCase())
      )
    : customers;

  const selectedContact = customers.find((c: any) => c.id === form.contactId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">
          {contactIdFilter ? 'Deals for Contact' : 'All Deals'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/crm/pipeline')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-500 bg-surface border border-border-custom rounded-xl hover:bg-surface-hover transition-colors"
          >
            <Kanban className="w-3.5 h-3.5" /> Pipeline View
          </button>
          <button
            onClick={() => { setEditId(null); setForm(EMPTY_DEAL_FORM); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-hover transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Deal
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input type="text" placeholder="Search deals..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface" />
        </div>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
          className="px-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface text-ink-600">
          <option value="">All Stages</option>
          {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface text-ink-600">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="px-3 py-2 text-xs border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface text-ink-600">
          <option value="">All Sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-12 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-ink-300 mb-3" />
          <p className="text-sm font-medium text-ink-500">No deals found</p>
          <p className="text-xs text-ink-400 mt-1">Try adjusting your filters or create a new deal.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-custom">
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Title</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Contact</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Value</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Stage</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Prob.</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Source</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Assigned To</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Close</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-ink-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal: any, i: number) => (
                  <tr key={deal.id} onClick={() => openEdit(deal)}
                    className={`border-b border-border-custom/50 cursor-pointer hover:bg-surface-hover transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-ink-900">{deal.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-ink-500">{deal.contactName || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-ink-700">{fmtNaira(deal.value || 0)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium text-white"
                        style={{ backgroundColor: deal.stageColor || '#94a3b8' }}
                      >
                        {deal.stageName || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {deal.probability != null ? (
                        <span className="text-xs text-ink-500 flex items-center gap-0.5">
                          <Percent className="w-3 h-3" />{deal.probability}%
                        </span>
                      ) : <span className="text-xs text-ink-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-ink-500 capitalize">{deal.source || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-ink-500">{deal.assigneeName || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-ink-500">{fmtDate(deal.expectedCloseDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${STATUS_STYLES[deal.status] || 'bg-slate-100 text-slate-600'}`}>
                        {deal.status || 'open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl"><Kanban className="w-5 h-5" /></div>
                <h2 className="text-base font-bold">{editId ? 'Edit Deal' : 'New Deal'}</h2>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Title *</label>
                <input type="text" placeholder="e.g. Enterprise Software Deal" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Contact</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input type="text" placeholder="Search contacts..." value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
                </div>
                <div className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5">
                  {selectedContact && !contactSearch && (
                    <div className="px-2 py-1.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg">{selectedContact.name} · {selectedContact.email || '—'}</div>
                  )}
                  {contactSearch && filteredContacts.slice(0, 10).map((c: any) => (
                    <button key={c.id} type="button"
                      onClick={() => { setForm(p => ({ ...p, contactId: c.id })); setContactSearch(''); }}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors ${form.contactId === c.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                    >{c.name} · {c.email || '—'}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Value (₦)</label>
                  <input type="number" placeholder="0.00" value={form.value}
                    onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Currency</label>
                  <select value={form.currency}
                    onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                  >
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Probability (%)</label>
                  <input type="number" placeholder="0" min="0" max="100" value={form.probability}
                    onChange={e => setForm(p => ({ ...p, probability: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Expected Close Date</label>
                  <input type="date" value={form.expectedCloseDate}
                    onChange={e => setForm(p => ({ ...p, expectedCloseDate: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Source</label>
                <select value={form.source}
                  onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                >
                  <option value="">Select source</option>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="email">Email Campaign</option>
                  <option value="phone">Phone Inquiry</option>
                  <option value="social">Social Media</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="other">Other</option>
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
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Stage</label>
                <select value={form.stageId}
                  onChange={e => setForm(p => ({ ...p, stageId: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white"
                >
                  {stages.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Notes</label>
                <textarea rows={3} placeholder="Additional notes..." value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all resize-none placeholder:text-slate-400" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                {editId && (
                  <button onClick={() => setConfirmDelete(!confirmDelete)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  ><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                )}
                {confirmDelete && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-red-600">Are you sure?</span>
                    <button onClick={handleDelete} className="px-2.5 py-1 text-[10px] font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button onClick={closeModal} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={!form.title || createMutation.isPending || updateMutation.isPending}
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

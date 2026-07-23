import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket, MessageSquare, Plus, Loader2, RefreshCw, Search,
  CheckCircle2, Clock, AlertCircle, ArrowRight, User, Building2,
  Flag, Send, X, ChevronDown,
} from 'lucide-react';
import { api } from '../../lib/api';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-surface-hover text-ink-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-surface-hover text-ink-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function SupportTicketsPage() {
  const [tab, setTab] = useState<'all' | 'detail'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', 'all', statusFilter, priorityFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const res = await api.get('/support/all', { params });
      return res.data.data as any[];
    },
  });

  const { data: ticketDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['support-ticket', selectedId],
    queryFn: async () => {
      const res = await api.get(`/support/${selectedId}`);
      return res.data.data as any;
    },
    enabled: !!selectedId,
  });

  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/support/${selectedId}/messages`, { message: newMessage, isInternal });
    },
    onSuccess: () => {
      setNewMessage('');
      refetchDetail();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, resolution }: { status: string; resolution?: string }) => {
      await api.put(`/support/${selectedId}/status`, { status, resolution });
    },
    onSuccess: () => {
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; category: string; priority: string }) => {
      const res = await api.post('/support', data);
      return res.data.data;
    },
    onSuccess: () => {
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  const [createForm, setCreateForm] = useState({ subject: '', message: '', category: 'general', priority: 'normal' });

  if (tab === 'detail' && selectedId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setTab('all'); setSelectedId(null); }} className="text-sm text-ink-500 hover:text-ink-700">&larr; Back</button>
            <h1 className="text-2xl font-bold text-ink-900">Ticket #{selectedId.slice(0, 8)}</h1>
          </div>
          <button onClick={() => refetchDetail()} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-subtle">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {ticketDetail && (
          <>
            <div className="bg-surface rounded-xl border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{ticketDetail.ticket.subject}</h2>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[ticketDetail.ticket.status] || ''}`}>
                    {ticketDetail.ticket.status}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[ticketDetail.ticket.priority] || ''}`}>
                    {ticketDetail.ticket.priority}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-500">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {ticketDetail.user?.fullName || 'Unknown'}</span>
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {ticketDetail.orgName || '-'}</span>
                <span className="flex items-center gap-1"><Flag className="w-3 h-3" /> {ticketDetail.ticket.category}</span>
                <span>{fmtDate(ticketDetail.ticket.createdAt)}</span>
              </div>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">{ticketDetail.ticket.message}</p>
              {ticketDetail.ticket.resolution && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  <strong>Resolution:</strong> {ticketDetail.ticket.resolution}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {ticketDetail.ticket.status === 'open' && (
                <button onClick={() => statusMutation.mutate({ status: 'in_progress' })}
                  className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  Start Progress
                </button>
              )}
              {ticketDetail.ticket.status === 'in_progress' && (
                <button onClick={() => statusMutation.mutate({ status: 'resolved' })}
                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600">
                  Mark Resolved
                </button>
              )}
              {ticketDetail.ticket.status === 'resolved' && (
                <button onClick={() => statusMutation.mutate({ status: 'closed' })}
                  className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                  Close Ticket
                </button>
              )}
              {(ticketDetail.ticket.status === 'open' || ticketDetail.ticket.status === 'in_progress') && (
                <button onClick={() => statusMutation.mutate({ status: 'closed' })}
                  className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                  Close Without Resolution
                </button>
              )}
            </div>

            <div className="bg-surface rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-ink-700 mb-4">Messages ({ticketDetail.messages.length})</h3>
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {ticketDetail.messages.map((msg: any) => (
                  <div key={msg.id} className={`p-3 rounded-lg ${msg.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-surface-subtle border'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-700">{msg.user?.fullName || 'Unknown'}</span>
                      <div className="flex items-center gap-2">
                        {msg.isInternal && <span className="px-1.5 py-0.5 text-xs rounded bg-amber-200 text-amber-800">Internal</span>}
                        <span className="text-xs text-ink-400">{fmtDate(msg.createdAt)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-ink-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))}
                {ticketDetail.messages.length === 0 && (
                  <p className="text-sm text-ink-400 text-center py-4">No messages yet</p>
                )}
              </div>
              <div className="flex gap-2">
                <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 border rounded-lg p-2 text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
                  <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                  Internal note (not visible to requester)
                </label>
                <button onClick={() => sendMutation.mutate()} disabled={!newMessage.trim() || sendMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Support Tickets</h1>
          <p className="text-sm text-ink-500 mt-1">Manage organisation support requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['support-tickets'] })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-subtle">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="bg-surface rounded-xl border">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-subtle">
                <th className="text-left p-3 font-medium text-ink-600">Subject</th>
                <th className="text-left p-3 font-medium text-ink-600">Org</th>
                <th className="text-left p-3 font-medium text-ink-600">Requester</th>
                <th className="text-left p-3 font-medium text-ink-600">Status</th>
                <th className="text-left p-3 font-medium text-ink-600">Priority</th>
                <th className="text-left p-3 font-medium text-ink-600">Date</th>
                <th className="text-left p-3 font-medium text-ink-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets?.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-surface-subtle">
                  <td className="p-3 font-medium text-ink-900">{t.subject}</td>
                  <td className="p-3 text-ink-500">{t.orgName || '-'}</td>
                  <td className="p-3 text-ink-500">{t.user?.fullName || 'Unknown'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[t.status] || ''}`}>{t.status}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[t.priority] || ''}`}>{t.priority}</span>
                  </td>
                  <td className="p-3 text-ink-500">{fmtDate(t.createdAt)}</td>
                  <td className="p-3">
                    <button onClick={() => { setSelectedId(t.id); setTab('detail'); }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {(!tickets || tickets.length === 0) && (
                <tr><td colSpan={7} className="p-6 text-center text-ink-400">No tickets found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Ticket</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-ink-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Subject</label>
                <input value={createForm.subject} onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Category</label>
                <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="general">General</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="bug">Bug Report</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Priority</label>
                <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Message</label>
                <textarea value={createForm.message} onChange={e => setCreateForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => createMutation.mutate(createForm)} disabled={!createForm.subject || !createForm.message || createMutation.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

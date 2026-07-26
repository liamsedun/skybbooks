import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ticket, MessageSquare, Plus, Loader2, RefreshCw,
  Clock, AlertCircle, Send, X, User, LifeBuoy,
} from 'lucide-react';
import { api } from '../../lib/api';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function SupportTicketsPage() {
  const [tab, setTab] = useState<'list' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [createForm, setCreateForm] = useState({ subject: '', message: '', category: 'general', priority: 'normal' });
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const res = await api.get('/support');
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

  const createMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; category: string; priority: string }) => {
      const res = await api.post('/support', data);
      return res.data.data;
    },
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm({ subject: '', message: '', category: 'general', priority: 'normal' });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/support/${selectedId}/messages`, { message: newMessage });
    },
    onSuccess: () => {
      setNewMessage('');
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });

  if (tab === 'detail' && selectedId) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setTab('list'); setSelectedId(null); }}
              className="text-sm text-ink-500 hover:text-ink-700 transition-colors">&larr; Back to tickets</button>
          </div>
          <button onClick={() => refetchDetail()}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {ticketDetail && (
          <>
            <div className="bg-surface rounded-xl border p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-ink-900">{ticketDetail.subject}</h2>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[ticketDetail.status] || ''}`}>
                    {ticketDetail.status === 'in_progress' ? 'In Progress' : ticketDetail.status}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[ticketDetail.priority] || ''}`}>
                    {ticketDetail.priority}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-500 flex-wrap">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {ticketDetail.userName || 'You'}</span>
                <span className="flex items-center gap-1"><LifeBuoy className="w-3 h-3" /> {ticketDetail.category}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(ticketDetail.createdAt)}</span>
              </div>
              <p className="text-sm text-ink-700 whitespace-pre-wrap bg-surface-subtle rounded-lg p-3">{ticketDetail.message}</p>
              {ticketDetail.resolution && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  <strong>Resolution:</strong> {ticketDetail.resolution}
                </div>
              )}
            </div>

            <div className="bg-surface rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-ink-700 mb-4">Conversation ({ticketDetail.messages.length})</h3>
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {ticketDetail.messages
                  .filter((m: any) => !m.isInternal)
                  .map((msg: any) => (
                    <div key={msg.id} className="p-3 rounded-lg bg-surface-subtle border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-ink-700">{msg.userName || 'Support Team'}</span>
                        <span className="text-xs text-ink-400">{fmtDate(msg.createdAt)}</span>
                      </div>
                      <p className="text-sm text-ink-700 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                {(!ticketDetail.messages || ticketDetail.messages.filter((m: any) => !m.isInternal).length === 0) && (
                  <p className="text-sm text-ink-400 text-center py-4">No messages yet. Awaiting response from the support team.</p>
                )}
              </div>
              {ticketDetail.status !== 'resolved' && ticketDetail.status !== 'closed' && (
                <div className="border-t pt-4 space-y-3">
                  <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full border rounded-lg p-3 text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex justify-end">
                    <button onClick={() => sendMutation.mutate()} disabled={!newMessage.trim() || sendMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send Message
                    </button>
                  </div>
                </div>
              )}
              {(ticketDetail.status === 'resolved' || ticketDetail.status === 'closed') && (
                <p className="text-sm text-ink-400 text-center py-3">This ticket is {ticketDetail.status}. To follow up, create a new ticket.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Support Tickets</h1>
          <p className="text-sm text-ink-500 mt-1">Submit and track support requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['support-tickets'] })}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-surface border rounded-lg hover:bg-surface-hover">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-subtle">
                <th className="text-left p-3 font-medium text-ink-600">Subject</th>
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
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[t.status] || ''}`}>
                      {t.status === 'in_progress' ? 'In Progress' : t.status}
                    </span>
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
                <tr><td colSpan={5} className="p-6 text-center text-ink-400">No tickets found. Create one to get help.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Create Support Ticket</h3>
              </div>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-ink-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Subject</label>
                <input value={createForm.subject} onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Brief summary of the issue"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Message</label>
                <textarea value={createForm.message} onChange={e => setCreateForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe the issue in detail"
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-28 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => createMutation.mutate(createForm)}
                disabled={!createForm.subject || !createForm.message || createMutation.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

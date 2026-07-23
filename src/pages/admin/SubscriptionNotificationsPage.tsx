import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Mail, MessageSquare, Smartphone, Pen, Save, Trash2, Plus, X,
  Loader2, RefreshCw, FileText, Settings, History, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';

const EVENT_TYPES = [
  { id: 'trial_started', label: 'Trial Started' },
  { id: 'trial_ending', label: 'Trial Ending' },
  { id: 'subscription_activated', label: 'Subscription Activated' },
  { id: 'payment_successful', label: 'Payment Successful' },
  { id: 'payment_failed', label: 'Payment Failed' },
  { id: 'renewal_reminder', label: 'Renewal Reminder' },
  { id: 'subscription_expired', label: 'Subscription Expired' },
  { id: 'plan_upgraded', label: 'Plan Upgraded' },
  { id: 'plan_downgraded', label: 'Plan Downgraded' },
  { id: 'coupon_applied', label: 'Coupon Applied' },
  { id: 'storage_limit_reached', label: 'Storage Limit Reached' },
  { id: 'user_limit_reached', label: 'User Limit Reached' },
  { id: 'feature_limit_reached', label: 'Feature Limit Reached' },
];

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'in_app', label: 'In-App', icon: Bell },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
];

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SubscriptionNotificationsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'templates' | 'log' | 'preferences'>('templates');
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [orgFilter, setOrgFilter] = useState('');

  const { data: templates, isLoading: tplsLoading, refetch: refetchTpls } = useQuery({
    queryKey: ['sub-notif', 'templates'],
    queryFn: async () => { const r = await api.get('/subscription-notifications/templates'); return r.data.data; },
  });

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ['sub-notif', 'log', orgFilter],
    queryFn: async () => { const r = await api.get(`/subscription-notifications/log?limit=200&orgId=${orgFilter}`); return r.data; },
  });

  const { data: prefs } = useQuery({
    queryKey: ['sub-notif', 'preferences'],
    queryFn: async () => { const r = await api.get(`/subscription-notifications/preferences?orgId=`); return r.data.data; },
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => { const r = await api.post('/subscription-notifications/templates', data); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sub-notif', 'templates'] }); setEditingTemplate(null); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await api.put(`/subscription-notifications/templates/${id}`, data); return r.data.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sub-notif', 'templates'] }); setEditingTemplate(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/subscription-notifications/templates/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sub-notif', 'templates'] }),
  });

  const savePrefsMut = useMutation({
    mutationFn: async (data: any) => { const r = await api.put('/subscription-notifications/preferences', data); return r.data.data; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sub-notif', 'preferences'] }),
  });

  const tabs = [
    { id: 'templates' as const, label: 'Templates', icon: FileText },
    { id: 'log' as const, label: 'Notification Log', icon: History },
    { id: 'preferences' as const, label: 'Preferences', icon: Settings },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Subscription Notifications</h1>
          <p className="text-sm text-ink-500 mt-1">Manage notification templates, view history, and configure preferences</p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-hover p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${tab === t.id ? 'bg-surface shadow-sm text-ink-900 font-medium' : 'text-ink-500 hover:text-ink-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-ink-500">Customize notification templates per event type and channel. Leave empty to use defaults.</p>
            <button onClick={() => setEditingTemplate({ eventType: 'payment_successful', channel: 'email', subject: '', body: '', isActive: true })}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>

          {tplsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
          ) : (
            <div className="bg-surface rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-subtle">
                    <th className="text-left p-3 font-medium text-ink-600">Event</th>
                    <th className="text-left p-3 font-medium text-ink-600">Channel</th>
                    <th className="text-left p-3 font-medium text-ink-600">Subject</th>
                    <th className="text-left p-3 font-medium text-ink-600">Active</th>
                    <th className="text-right p-3 font-medium text-ink-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates?.map((t: any) => (
                    <tr key={t.id} className="border-b hover:bg-surface-hover">
                      <td className="p-3 font-medium">{EVENT_TYPES.find(e => e.id === t.eventType)?.label || t.eventType}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-hover rounded text-xs">
                          {t.channel === 'email' ? <Mail className="w-3 h-3" /> : t.channel === 'in_app' ? <Bell className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                          {t.channel}
                        </span>
                      </td>
                      <td className="p-3 text-ink-600 max-w-[200px] truncate">{t.subject}</td>
                      <td className="p-3">{t.isActive ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-gray-300" />}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => setEditingTemplate(t)} className="p-1 hover:bg-surface-hover rounded mr-1"><Pen className="w-4 h-4 text-ink-500" /></button>
                        <button onClick={() => { if (confirm('Delete template?')) deleteMut.mutate(t.id); }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </td>
                    </tr>
                  ))}
                  {(!templates || templates.length === 0) && (
                    <tr><td colSpan={5} className="p-6 text-center text-ink-400">No custom templates yet. Defaults will be used.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {editingTemplate && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditingTemplate(null)}>
              <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{editingTemplate.id ? 'Edit Template' : 'New Template'}</h3>
                  <button onClick={() => setEditingTemplate(null)}><X className="w-5 h-5 text-ink-400" /></button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ink-500 mb-1">Event Type</label>
                      <select value={editingTemplate.eventType} onChange={e => setEditingTemplate({ ...editingTemplate, eventType: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        {EVENT_TYPES.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-500 mb-1">Channel</label>
                      <select value={editingTemplate.channel} onChange={e => setEditingTemplate({ ...editingTemplate, channel: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-ink-500 mb-1">Subject (email only)</label>
                    <input value={editingTemplate.subject || ''} onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Enter subject with {{placeholders}}" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-500 mb-1">Body</label>
                    <textarea value={editingTemplate.body || ''} onChange={e => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm h-32 font-mono" placeholder="Enter body with {{placeholders}}" />
                  </div>
                  <div className="bg-surface-subtle rounded-lg p-3 text-xs text-ink-500">
                    <p className="font-medium mb-1">Available placeholders:</p>
                    <code className="text-blue-600">{'{{orgName}}, {{planName}}, {{amount}}, {{trialEnd}}, {{renewalDate}}, {{oldPlan}}, {{newPlan}}, {{couponCode}}, {{usage}}, {{limit}}, {{userCount}}, {{userLimit}}, {{featureName}}, {{billingUrl}}, {{reason}}'}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={editingTemplate.isActive !== false} onChange={e => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })} />
                    <span className="text-sm">Active</span>
                  </div>
                  <button onClick={() => {
                    const payload = { ...editingTemplate };
                    delete payload.id;
                    if (editingTemplate.id) updateMut.mutate({ id: editingTemplate.id, data: payload });
                    else createMut.mutate(payload);
                  }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    {editingTemplate.id ? 'Update' : 'Create'} Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input value={orgFilter} onChange={e => setOrgFilter(e.target.value)} placeholder="Filter by org ID..."
              className="border rounded-lg px-3 py-1.5 text-sm w-64" />
            <span className="text-sm text-ink-500">{logData?.total || 0} entries</span>
          </div>
          <div className="bg-surface rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-surface-subtle">
                  <th className="text-left p-3 font-medium text-ink-600">Date</th>
                  <th className="text-left p-3 font-medium text-ink-600">Event</th>
                  <th className="text-left p-3 font-medium text-ink-600">Channel</th>
                  <th className="text-left p-3 font-medium text-ink-600">Recipient</th>
                  <th className="text-left p-3 font-medium text-ink-600">Subject</th>
                  <th className="text-left p-3 font-medium text-ink-600">Status</th>
                  <th className="text-left p-3 font-medium text-ink-600">Error</th>
                </tr>
              </thead>
              <tbody>
                {logData?.data?.map((entry: any) => (
                  <tr key={entry.id} className="border-b hover:bg-surface-hover">
                    <td className="p-3 text-ink-500 text-xs">{fmtDate(entry.createdAt)}</td>
                    <td className="p-3 font-medium">{EVENT_TYPES.find(e => e.id === entry.eventType)?.label || entry.eventType}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-hover rounded text-xs">
                        {entry.channel === 'email' ? <Mail className="w-3 h-3" /> : entry.channel === 'in_app' ? <Bell className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                        {entry.channel}
                      </span>
                    </td>
                    <td className="p-3 text-ink-600">{entry.recipient || '-'}</td>
                    <td className="p-3 text-ink-600 max-w-[200px] truncate">{entry.subject || '-'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.status === 'sent' ? 'bg-green-100 text-green-700' :
                        entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {entry.status === 'sent' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {entry.status}
                      </span>
                    </td>
                    <td className="p-3 text-red-500 text-xs max-w-[150px] truncate">{entry.error || '-'}</td>
                  </tr>
                ))}
                {(!logData?.data || logData.data.length === 0) && (
                  <tr><td colSpan={7} className="p-6 text-center text-ink-400">No notifications sent yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-surface rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-4">Notification Channels</h3>
            <div className="space-y-3">
              {CHANNELS.map(ch => (
                <label key={ch.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-surface-hover cursor-pointer">
                  <input type="checkbox" checked={prefs?.channels?.includes(ch.id) ?? ['email', 'in_app'].includes(ch.id)}
                    onChange={e => {
                      const current = prefs?.channels || ['email', 'in_app'];
                      const next = e.target.value ? [...current, ch.id] : current.filter((c: string) => c !== ch.id);
                      savePrefsMut.mutate({ channels: next });
                    }} className="rounded" />
                  <ch.icon className="w-5 h-5 text-ink-500" />
                  <div>
                    <p className="text-sm font-medium">{ch.label}</p>
                    <p className="text-xs text-ink-400">{ch.id === 'sms' || ch.id === 'whatsapp' ? 'Future-ready — not yet active' : 'Active'}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-ink-700 mb-4">Enable/Disable Events</h3>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(et => (
                <label key={et.id} className="flex items-center gap-2 p-2 border rounded hover:bg-surface-hover cursor-pointer text-sm">
                  <input type="checkbox" checked={prefs ? (prefs.enabledEvents?.includes(et.id) ?? true) : true}
                    onChange={e => {
                      const current = prefs?.enabledEvents || EVENT_TYPES.map(e => e.id);
                      const next = e.target.checked ? [...current, et.id] : current.filter((id: string) => id !== et.id);
                      savePrefsMut.mutate({ enabledEvents: next });
                    }} />
                  {et.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

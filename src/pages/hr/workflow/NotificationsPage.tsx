import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Mail, MailOpen } from 'lucide-react';
import { hrApi } from '../../../lib/api';
import { HrPageShell } from '../../../components/hr/HrPageShell';
import { HrDataTable, Column } from '../../../components/hr/HrDataTable';

export function NotificationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      hrApi.getNotifications(undefined, unreadOnly || undefined),
      hrApi.getUnreadNotificationCount(),
    ]).then(([notifRes, countRes]) => {
      setRows(notifRes?.data || notifRes || []);
      setUnreadCount(countRes?.data?.count ?? countRes?.count ?? 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [unreadOnly]);

  const handleMarkRead = async (id: string) => {
    if (markingId) return;
    setMarkingId(id);
    try {
      await hrApi.markNotificationRead(id);
      setRows(prev => prev.map(r => (r.id === id || r.notification_id === id) ? { ...r, readAt: new Date().toISOString(), isRead: true } : r));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { }
    setMarkingId(null);
  };

  const handleMarkAllRead = async () => {
    try {
      await hrApi.markAllNotificationsRead();
      setRows(prev => prev.map(r => ({ ...r, readAt: new Date().toISOString(), isRead: true })));
      setUnreadCount(0);
    } catch { }
  };

  const columns: Column<any>[] = [
    {
      key: 'type', label: 'Type',
      render: r => {
        const icon = r.isRead || r.readAt ? 'bg-ink-100 text-ink-400' : 'bg-primary/10 text-primary';
        return (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${icon}`}>
            <Bell className="w-4 h-4" />
          </div>
        );
      },
    },
    { key: 'title', label: 'Title', render: r => <span className={`font-medium ${(!r.isRead && !r.readAt) ? 'text-ink-900' : 'text-ink-500'}`}>{r.title || r.notification_title || '-'}</span> },
    { key: 'body', label: 'Body', render: r => <span className="text-ink-400 truncate max-w-[200px] block">{r.body || r.message || '-'}</span>, hideOnMobile: true },
    { key: 'link', label: 'Link', render: r => r.link || r.notification_link ? <span className="text-xs text-primary truncate max-w-[150px] block">{r.link || r.notification_link}</span> : <span className="text-ink-300">—</span>, hideOnMobile: true },
    {
      key: 'readStatus', label: 'Read Status',
      render: r => {
        const read = r.isRead || r.readAt;
        return (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${read ? 'bg-ink-100 text-ink-500' : 'bg-blue-100 text-blue-700'}`}>
            {read ? <MailOpen className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
            {read ? 'Read' : 'Unread'}
          </span>
        );
      },
    },
    { key: 'createdAt', label: 'Created At', render: r => new Date(r.createdAt || r.created_at).toLocaleDateString(), hideOnMobile: true },
  ];

  return (
    <HrPageShell
      title="Notifications"
      description={`Stay up to date with HR alerts and updates`}
      headerActions={
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-500 cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}
              className="rounded border-ink-300 text-primary focus:ring-primary/30" />
            Unread only
          </label>
          <button onClick={handleMarkAllRead} disabled={unreadCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary rounded-full">{unreadCount}</span>
            )}
          </button>
          <div className="relative">
            <Bell className="w-5 h-5 text-ink-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </div>
        </div>
      }
    >
      <HrDataTable columns={columns} data={rows} keyExtractor={r => r.id || r.notification_id}
        loading={loading} emptyMessage={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
        onRowClick={r => { if (!r.isRead && !r.readAt) handleMarkRead(r.id || r.notification_id); }} />
    </HrPageShell>
  );
}

export default NotificationsPage;

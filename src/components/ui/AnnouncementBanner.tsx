import { useState, useEffect, useCallback } from 'react';
import { X, Info, AlertTriangle, AlertOctagon, Wrench, Megaphone } from 'lucide-react';
import { announcementApi } from '../../lib/api';

const TYPE_ICONS: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  important: AlertOctagon,
  maintenance: Wrench,
};

const TYPE_BG: Record<string, string> = {
  info: 'bg-blue-50 border-blue-200',
  warning: 'bg-amber-50 border-amber-200',
  important: 'bg-red-50 border-red-200',
  maintenance: 'bg-purple-50 border-purple-200',
};

const TYPE_TEXT: Record<string, string> = {
  info: 'text-blue-800',
  warning: 'text-amber-800',
  important: 'text-red-800',
  maintenance: 'text-purple-800',
};

const TYPE_ICON_COLORS: Record<string, string> = {
  info: 'text-blue-600',
  warning: 'text-amber-600',
  important: 'text-red-600',
  maintenance: 'text-purple-600',
};

const DISMISSED_KEY = 'sb_dismissed_announcements';
const SEEN_MODAL_KEY = 'sb_seen_announcement_modal';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch { return []; }
}

function addDismissed(id: string) {
  const list = getDismissed();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(list));
  }
}

function getSeenModal(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_MODAL_KEY) || '[]');
  } catch { return []; }
}

function markSeenModal(id: string) {
  const list = getSeenModal();
  if (!list.includes(id)) {
    list.push(id);
    sessionStorage.setItem(SEEN_MODAL_KEY, JSON.stringify(list));
  }
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed);
  const [seenModal, setSeenModal] = useState<string[]>(getSeenModal);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await announcementApi.getActiveAnnouncements();
        if (!cancelled) setAnnouncements(res.data || []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    addDismissed(id);
    setDismissed(prev => [...prev, id]);
    announcementApi.dismissAnnouncement(id).catch(() => {});
  }, []);

  const handleDismissModal = useCallback((id: string) => {
    markSeenModal(id);
    setSeenModal(prev => [...prev, id]);
  }, []);

  const visible = announcements.filter(a => !dismissed.includes(a.id));

  if (loading || visible.length === 0) return null;

  const modalAnnouncement = visible.find(a => !seenModal.includes(a.id));

  return (
    <>
      {visible.map(a => {
        const TypeIcon = TYPE_ICONS[a.type] || Info;
        const bg = TYPE_BG[a.type] || 'bg-gray-50 border-gray-200';
        const txt = TYPE_TEXT[a.type] || 'text-gray-800';
        const iconColor = TYPE_ICON_COLORS[a.type] || 'text-gray-600';
        return (
          <div key={a.id} className={`${bg} border-b px-4 sm:px-6 py-2.5 flex items-start gap-3`}>
            <div className={`mt-0.5 ${iconColor}`}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${txt}`}>{a.title}</p>
              <p className={`text-[11px] ${txt} opacity-80 mt-0.5 whitespace-pre-wrap line-clamp-2`}>{a.message}</p>
            </div>
            <button
              onClick={() => handleDismiss(a.id)}
              className={`p-1 rounded hover:bg-black/5 transition-colors shrink-0 ${txt}`}
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {modalAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => handleDismissModal(modalAnnouncement.id)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 text-blue-700">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{modalAnnouncement.title}</h2>
                  <p className="text-[11px] text-gray-500">
                    {modalAnnouncement.isGlobal ? 'Platform announcement' : 'Organisation announcement'}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDismissModal(modalAnnouncement.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{modalAnnouncement.message}</p>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t flex justify-end shrink-0">
              <button onClick={() => handleDismissModal(modalAnnouncement.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

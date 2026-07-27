import { AlertTriangle } from 'lucide-react';

interface HrConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function HrConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }: HrConfirmDialogProps) {
  if (!open) return null;

  const confirmColors = variant === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : variant === 'warning'
    ? 'bg-amber-500 hover:bg-amber-600 text-white'
    : 'bg-primary hover:bg-primary-hover text-white';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="alertdialog" aria-modal="true" aria-label={title}
    >
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm border border-border-custom p-6 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${variant === 'danger' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-500' : variant === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-500' : 'bg-primary/10 text-primary'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            <p className="text-xs text-ink-400 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={loading}
            className="px-3 py-2 text-xs font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 ${confirmColors}`}>
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

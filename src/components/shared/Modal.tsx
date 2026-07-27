import { ReactNode, FormEvent, useRef, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeMap = {
  sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-xl', xl: 'max-w-2xl', full: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md', className }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className={`bg-surface rounded-2xl shadow-2xl w-full ${sizeMap[size]} max-h-[90vh] flex flex-col border border-border-custom ${className || ''}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-custom shrink-0">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border-custom shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  error?: string | null;
  loading?: boolean;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function FormModal({ open, onClose, title, onSubmit, children, error, loading, submitLabel = 'Save', size }: FormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={size}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-ink-600 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm inline-flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Saving...' : submitLabel}
          </button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {children}
      </form>
    </Modal>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}

export function Drawer({ open, onClose, title, children, width = 'max-w-lg', footer }: DrawerProps) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${width} bg-surface border-l border-border-custom shadow-2xl h-full flex flex-col animate-slide-in-right`}
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-custom shrink-0">
          <h2 className="text-base font-semibold text-ink-900 truncate">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border-custom shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading, children }: ConfirmDialogProps) {
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
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">{title}</h3>
            <p className="text-xs text-ink-400 mt-0.5">{message}</p>
          </div>
        </div>
        {children}
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

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface HrViewDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function HrViewDrawer({ open, onClose, title, children, width = 'max-w-lg' }: HrViewDrawerProps) {
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

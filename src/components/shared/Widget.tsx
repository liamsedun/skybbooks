import { ReactNode, useState } from 'react';
import { Maximize2, Minimize2, MoreHorizontal, RefreshCw, Loader2 } from 'lucide-react';

interface WidgetProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  fullscreen?: boolean;
  onFullscreenToggle?: () => void;
  menu?: ReactNode;
}

export function Widget({ title, subtitle, children, action, className, loading, error, onRefresh, fullscreen, onFullscreenToggle, menu }: WidgetProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`bg-surface border border-border-custom rounded-xl shadow-sm ${fullscreen ? 'fixed inset-4 z-50 overflow-auto' : ''} ${className || ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            {title}
          </h3>
          {subtitle && <p className="text-[10px] text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {action}
          {onRefresh && (
            <button onClick={onRefresh} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onFullscreenToggle && (
            <button onClick={onFullscreenToggle} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          {menu && (
            <div className="relative">
              <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Menu">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border-custom rounded-xl shadow-lg py-1 min-w-[160px]">
                    {menu}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        {error ? (
          <div className="flex items-center justify-center py-8 text-sm text-rose-500">{error}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function WidgetMenuButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors ${danger ? 'text-rose-600' : 'text-ink-700'}`}>
      {label}
    </button>
  );
}

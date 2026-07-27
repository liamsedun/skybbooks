import { useState, ReactNode } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

interface HelpPanelProps {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function HelpPanel({ title = 'Quick Guide', children, defaultOpen = false }: HelpPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] dark:bg-primary/[0.05] overflow-hidden transition-all">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-3 text-xs text-ink-600 dark:text-ink-400 leading-relaxed space-y-1.5 border-t border-primary/10 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

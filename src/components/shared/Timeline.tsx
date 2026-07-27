import { ReactNode } from 'react';

interface TimelineProps {
  children: ReactNode;
  className?: string;
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <ol className={`relative border-l-2 border-border-custom ml-3 space-y-6 ${className || ''}`}>
      {children}
    </ol>
  );
}

interface TimelineItemProps {
  children: ReactNode;
  icon?: ReactNode;
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'slate';
  className?: string;
}

const dotColors = {
  primary: 'border-primary bg-primary/10 text-primary',
  emerald: 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30',
  amber: 'border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950/30',
  rose: 'border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-950/30',
  slate: 'border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-800',
};

export function TimelineItem({ children, icon, color = 'primary', className }: TimelineItemProps) {
  return (
    <li className={`relative pl-6 ${className || ''}`}>
      <span className={`absolute -left-[13px] top-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${dotColors[color]}`}>
        {icon || <span className="w-2 h-2 rounded-full bg-current" />}
      </span>
      {children}
    </li>
  );
}

interface TimelineTitleProps {
  children: ReactNode;
  className?: string;
}

export function TimelineTitle({ children, className }: TimelineTitleProps) {
  return <p className={`text-sm font-semibold text-ink-900 ${className || ''}`}>{children}</p>;
}

interface TimelineTextProps {
  children: ReactNode;
  className?: string;
}

export function TimelineText({ children, className }: TimelineTextProps) {
  return <p className={`text-xs text-ink-500 mt-0.5 ${className || ''}`}>{children}</p>;
}

interface TimelineTimeProps {
  children: ReactNode;
  className?: string;
}

export function TimelineTime({ children, className }: TimelineTimeProps) {
  return <time className={`text-[10px] text-ink-400 ${className || ''}`}>{children}</time>;
}

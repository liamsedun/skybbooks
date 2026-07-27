import { ReactNode } from 'react';

type StatusLevel = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const statusColorMap: Record<string, StatusLevel> = {
  active: 'success', paid: 'success', approved: 'success', completed: 'success', confirmed: 'success', accepted: 'success', recognized: 'success', open: 'info',
  pending: 'warning', pending_review: 'warning', draft: 'neutral', overdue: 'danger', expired: 'danger', rejected: 'danger', cancelled: 'neutral', void: 'neutral', locked: 'info', reversed: 'info',
  submitted: 'info', posted: 'success', closed: 'neutral', failed: 'danger',
};

const levelStyles: Record<StatusLevel, { bg: string; text: string; dot: string; border: string }> = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  danger: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800' },
  neutral: { bg: 'bg-slate-50 dark:bg-slate-800/30', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400', border: 'border-slate-200 dark:border-slate-700' },
  primary: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary', border: 'border-primary/20' },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  dot?: boolean;
  outline?: boolean;
  pulse?: boolean;
  className?: string;
  customColor?: StatusLevel;
}

export function StatusBadge({ status, label, dot = true, outline, pulse, className, customColor }: StatusBadgeProps) {
  const level = customColor || statusColorMap[status.toLowerCase()] || 'neutral';
  const styles = levelStyles[level];

  const displayLabel = label || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${outline ? 'border ' + styles.border : styles.bg} ${styles.text} ${className || ''}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} ${pulse ? 'animate-pulse' : ''}`} />
      )}
      {displayLabel}
    </span>
  );
}

export function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  const level = statusColorMap[status.toLowerCase()] || 'neutral';
  return levelStyles[level];
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const level = statusColorMap[status.toLowerCase()] || 'neutral';
  return <span className={`w-2 h-2 rounded-full ${levelStyles[level].dot} inline-block ${className || ''}`} />;
}

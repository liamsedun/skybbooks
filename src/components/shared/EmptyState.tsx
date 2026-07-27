import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title = 'No data', message = 'There are no items to display.', action, className, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'py-8' : 'py-16'} px-4 ${className || ''}`}>
      <div className={`p-3 rounded-2xl bg-ink-50 dark:bg-ink-800/50 text-ink-300 dark:text-ink-500 ${compact ? 'mb-2' : 'mb-4'}`}>
        {icon || <Inbox className={compact ? 'w-6 h-6' : 'w-10 h-10'} />}
      </div>
      <h3 className={`font-semibold text-ink-900 ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
      <p className={`text-ink-500 mt-1 text-center max-w-sm ${compact ? 'text-xs' : 'text-sm'}`}>{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

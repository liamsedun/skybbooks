import { ReactNode } from 'react';
import { Clock, User } from 'lucide-react';

interface ActivityFeedProps {
  children: ReactNode;
  className?: string;
}

export function ActivityFeed({ children, className }: ActivityFeedProps) {
  return (
    <div className={`space-y-0 divide-y divide-border-custom ${className || ''}`}>
      {children}
    </div>
  );
}

interface ActivityItemProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  timestamp?: string;
  actor?: string;
  actorAvatar?: string;
  children?: ReactNode;
  className?: string;
}

const defaultIcon = <User className="w-4 h-4" />;

export function ActivityItem({ icon = defaultIcon, title, description, timestamp, actor, actorAvatar, children, className }: ActivityItemProps) {
  return (
    <div className={`flex gap-3 px-4 py-3 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors ${className || ''}`}>
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {actorAvatar ? (
          <img src={actorAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : icon}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm text-ink-900">
          {actor && <span className="font-semibold">{actor}</span>}{actor && ' '}{title}
        </p>
        {description && <p className="text-xs text-ink-500">{description}</p>}
        {children && <div className="mt-1">{children}</div>}
        {timestamp && (
          <p className="flex items-center gap-1 text-[10px] text-ink-400 mt-1">
            <Clock className="w-3 h-3" />
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}

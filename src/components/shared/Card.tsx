import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className, padding = true, onClick, hover }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border-custom rounded-xl shadow-sm ${padding ? 'p-4' : ''} ${onClick || hover ? 'cursor-pointer hover:shadow-md hover:border-primary/30 transition-all' : ''} ${className || ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-3 ${className || ''}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={`text-sm text-ink-600 space-y-2 ${className || ''}`}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return <div className={`mt-3 pt-3 border-t border-border-custom flex items-center gap-2 ${className || ''}`}>{children}</div>;
}

interface CardGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const gridCols = {
  1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', 5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
};

export function CardGrid({ children, columns = 3, className }: CardGridProps) {
  return <div className={`grid ${gridCols[columns]} gap-4 ${className || ''}`}>{children}</div>;
}

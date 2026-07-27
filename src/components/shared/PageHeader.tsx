import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  tabs?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, description, actions, className, tabs, children }: PageHeaderProps) {
  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">{title}</h1>
          {description && <p className="text-sm text-ink-500 mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {tabs && <div className="-mb-1">{tabs}</div>}
      {children}
    </div>
  );
}

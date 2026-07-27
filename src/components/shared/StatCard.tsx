import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
  subtitle?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'slate';
  onClick?: () => void;
  active?: boolean;
  className?: string;
  children?: ReactNode;
}

const colorConfig = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: 'text-blue-600 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', icon: 'text-rose-600 dark:text-rose-400', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', icon: 'text-purple-600 dark:text-purple-400', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', icon: 'text-cyan-600 dark:text-cyan-400', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-800/50', icon: 'text-slate-600 dark:text-slate-400', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
};

export function StatCard({ label, value, icon, trend, trendValue, subtitle, color = 'blue', onClick, active, className, children }: StatCardProps) {
  const c = colorConfig[color];

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 transition-all ${active ? `${c.bg} ${c.border} ring-2 ring-primary/20` : 'bg-surface border-border-custom hover:shadow-sm'} ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-500 dark:text-ink-400 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold mt-0.5 ${active ? c.text : 'text-ink-900 dark:text-ink-100'}`}>{value}</p>
          {subtitle && <p className="text-[10px] text-ink-400 mt-0.5">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg shrink-0 ${c.bg} ${c.icon}`}>
            {icon}
          </div>
        )}
      </div>
      {(trend || children) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && trendValue && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendValue}
            </span>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const gridCols = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

import { ReactNode as ReactNodeType } from 'react';

export function StatGrid({ children, columns = 4, className }: StatGridProps) {
  return <div className={`grid ${gridCols[columns]} gap-4 ${className || ''}`}>{children}</div>;
}

import { ReactNode } from 'react';

interface StatCardItem {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'slate';
  filterValue?: string;
  active?: boolean;
  onClick?: () => void;
}

interface HrStatCardsProps {
  items: StatCardItem[];
  columns?: 2 | 3 | 4 | 5;
}

const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', iconBg: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', iconBg: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' },
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', iconBg: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', iconBg: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', iconBg: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900/50', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
};

const gridCols = { 2: 'grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', 5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' };

export function HrStatCards({ items, columns = 4 }: HrStatCardsProps) {
  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {items.map((item, i) => {
        const c = colorMap[item.color || 'blue'] || colorMap.blue;
        const isActive = item.active;
        const Comp = item.onClick ? 'button' : 'div';
        return (
          <Comp key={i} onClick={item.onClick}
            className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 ${
              isActive
                ? `${c.bg} ${c.border} ring-2 ring-${item.color || 'blue'}-300 dark:ring-${item.color || 'blue'}-700 shadow-md`
                : `${c.bg} ${c.border} hover:shadow-sm`
            } ${item.onClick ? 'cursor-pointer outline-none focus:ring-2 focus:ring-primary' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${c.text}`}>{item.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-ink-100 tabular-nums">{item.value}</p>
              </div>
              {item.icon && <div className={`p-2 rounded-xl ${c.iconBg} shrink-0`}>{item.icon}</div>}
            </div>
          </Comp>
        );
      })}
    </div>
  );
}

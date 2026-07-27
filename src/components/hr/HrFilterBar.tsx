import { Search, RotateCcw } from 'lucide-react';
import { ReactNode } from 'react';

interface HrFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  statusFilter?: string;
  onStatusChange?: (v: string) => void;
  statusOptions?: { label: string; value: string }[];
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;
  children?: ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
}

export function HrFilterBar({
  search, onSearchChange, searchPlaceholder = 'Search...',
  statusFilter, onStatusChange, statusOptions,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  children, onClear, hasActiveFilters,
}: HrFilterBarProps) {
  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
          <input type="text" value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            aria-label="Search" />
        </div>
        {statusOptions && onStatusChange && (
          <select value={statusFilter} onChange={e => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            aria-label="Status filter"
          >
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {onDateFromChange && (
          <input type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            aria-label="Date from" />
        )}
        {onDateToChange && (
          <input type="date" value={dateTo} onChange={e => onDateToChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border-custom rounded-xl bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            aria-label="Date to" />
        )}
      </div>
      {children}
      {hasActiveFilters && onClear && (
        <div className="flex justify-end">
          <button onClick={onClear}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { SearchBar } from './SearchBar';

interface FilterPanelProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  onClear?: () => void;
  hasFilters?: boolean;
  className?: string;
}

export function FilterPanel({ search, onSearchChange, searchPlaceholder, children, onClear, hasFilters, className }: FilterPanelProps) {
  return (
    <div className={`space-y-3 ${className || ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar value={search} onChange={onSearchChange} placeholder={searchPlaceholder} />
        </div>
        {hasFilters && onClear && (
          <button onClick={onClear}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-ink-500 hover:text-ink-700 bg-ink-50 dark:bg-ink-800 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors shrink-0">
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string; color?: string }[];
  placeholder?: string;
  className?: string;
}

export function FilterSelect({ value, onChange, options, placeholder = 'All', className }: FilterSelectProps) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 text-xs bg-surface border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer ${className || ''}`}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

interface FilterDateRangeProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
}

export function FilterDateRange({ from, to, onFromChange, onToChange, className }: FilterDateRangeProps) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <input type="date" value={from} onChange={e => onFromChange(e.target.value)}
        className="px-3 py-2 text-xs bg-surface border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
      <span className="text-xs text-ink-400">–</span>
      <input type="date" value={to} onChange={e => onToChange(e.target.value)}
        className="px-3 py-2 text-xs bg-surface border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
    </div>
  );
}

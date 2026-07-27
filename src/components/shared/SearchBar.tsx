import { Search, X, Filter } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFilterToggle?: () => void;
  showFilterButton?: boolean;
  filterActive?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, placeholder = 'Search...', className, onFilterToggle, showFilterButton, filterActive, autoFocus }: SearchBarProps) {
  return (
    <div className={`relative ${className || ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-border-custom rounded-xl placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors" aria-label="Clear search">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {showFilterButton && (
        <button onClick={onFilterToggle}
          className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${filterActive ? 'text-primary bg-primary/10' : 'text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800'}`}
          aria-label="Toggle filters"
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

import { ReactNode, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render: (item: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

interface HrDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  selectedIds?: string[];
  onSelectOne?: (id: string) => void;
  onSelectAll?: () => void;
  totalRow?: Record<string, string | number> | null;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
  from?: number;
  to?: number;
  onRowClick?: (item: T) => void;
}

function SortIcon({ column, sortKey, sortDir }: { column: string; sortKey?: string; sortDir?: string }) {
  if (column !== sortKey) return <ChevronUp className="w-3 h-3 text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-primary" />
    : <ChevronDown className="w-3 h-3 text-primary" />;
}

export function HrDataTable<T extends Record<string, any>>({
  columns, data, keyExtractor, loading, error, emptyMessage = 'No data found', emptyIcon, emptyAction,
  sortKey, sortDir, onSort, selectedIds, onSelectOne, onSelectAll, totalRow,
  page, totalPages, onPageChange, pageSize = 10, totalItems, from, to, onRowClick,
}: HrDataTableProps<T>) {
  const allSelected = data.length > 0 && selectedIds?.length === data.length;
  const someSelected = (selectedIds?.length || 0) > 0;

  return (
    <div className="bg-surface rounded-2xl border border-border-custom shadow-sm overflow-hidden">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-ink-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm font-medium">Loading...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-rose-500 gap-3">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-ink-400 gap-3">
          {emptyIcon || <AlertCircle className="w-8 h-8 text-ink-300" />}
          <p className="text-sm font-medium text-ink-600">{emptyMessage}</p>
          {emptyAction}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" role="grid">
              <thead>
                <tr className="bg-ink-50 dark:bg-ink-800/50 text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
                  {onSelectOne && (
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected}
                        onChange={onSelectAll}
                        className="rounded border-ink-300 text-primary focus:ring-primary/30" />
                    </th>
                  )}
                  {columns.map(col => (
                    <th key={col.key}
                      className={`px-4 py-3 text-left group ${col.sortable ? 'cursor-pointer select-none hover:text-ink-600 transition-colors' : ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className || ''}`}
                      onClick={() => col.sortable && onSort?.(col.key)}
                      tabIndex={col.sortable ? 0 : undefined}
                      onKeyDown={e => { if (col.sortable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSort?.(col.key); } }}
                      aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom">
                {data.map((item) => {
                  const id = keyExtractor(item);
                  const isSelected = selectedIds?.includes(id);
                  return (
                    <tr key={id}
                      className={`group transition-colors ${isSelected ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-ink-50 dark:hover:bg-ink-800/30'} ${onRowClick ? 'cursor-pointer' : ''}`}
                      onClick={() => onRowClick?.(item)}
                    >
                      {onSelectOne && (
                        <td className="px-4 py-3 w-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected || false}
                            onChange={() => onSelectOne(id)}
                            className="rounded border-ink-300 text-primary focus:ring-primary/30" />
                        </td>
                      )}
                      {columns.map(col => (
                        <td key={col.key}
                          className={`px-4 py-3 text-sm text-ink-600 ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className || ''}`}
                        >
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              {totalRow && (
                <tfoot>
                  <tr className="border-t-2 border-ink-200 dark:border-ink-700 bg-ink-50/80 dark:bg-ink-800/50">
                    {onSelectOne && <td className="px-4 py-3" />}
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-3 text-sm font-bold text-ink-900 ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.className || ''}`}>
                        {totalRow[col.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {totalPages && totalPages > 1 && onPageChange && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-custom bg-ink-50/50 dark:bg-ink-800/30">
              <span className="text-xs text-ink-400">
                {from || ((page! - 1) * pageSize + 1)}–{to || Math.min(page! * pageSize, totalItems || data.length)} of {totalItems || data.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(page! - 1)} disabled={page! <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(page! - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => onPageChange(p)}
                      className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${
                        p === page ? 'bg-primary text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => onPageChange(page! + 1)} disabled={page! >= totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

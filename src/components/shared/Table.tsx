import { useState, useMemo, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

export interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  hideOnMobile?: boolean;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedRows?: Set<string | number>;
  onSelectRow?: (id: string | number) => void;
  onSelectAll?: () => void;
  totalRow?: Record<string, ReactNode>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
  className?: string;
}

export function Table<T>({ columns, data, keyExtractor, sortColumn, sortDirection, onSort, loading, error, emptyMessage = 'No data found', emptyIcon, emptyAction, onRowClick, selectedRows, onSelectRow, onSelectAll, totalRow, pagination, className }: TableProps<T>) {
  const hasSelection = !!onSelectRow;
  const allSelected = hasSelection && data.length > 0 && data.every(r => selectedRows?.has(keyExtractor(r)));

  if (loading) {
    return (
      <div className="border border-border-custom rounded-xl overflow-hidden bg-surface">
        <div className="p-8 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-ink-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-rose-200 dark:border-rose-800 rounded-xl p-8 flex flex-col items-center justify-center gap-2 bg-surface">
        <AlertCircle className="w-6 h-6 text-rose-400" />
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="border border-border-custom rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-surface">
        {emptyIcon || <AlertCircle className="w-8 h-8 text-ink-300" />}
        <p className="text-sm text-ink-500">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  const pageStart = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 1;
  const pageEnd = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : data.length;

  return (
    <div className="border border-border-custom rounded-xl overflow-hidden bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 dark:bg-ink-800/50">
              {hasSelection && (
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={onSelectAll}
                    className="w-4 h-4 rounded border-ink-300 text-primary focus:ring-primary/30" />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider ${col.sortable ? 'cursor-pointer select-none hover:text-ink-700 dark:hover:text-ink-300' : ''} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.headerClassName || ''}`}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortColumn === col.key
                        ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 text-ink-300" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-custom">
            {data.map(row => (
              <tr key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-ink-50/50 dark:hover:bg-ink-800/30' : 'hover:bg-ink-50/30 dark:hover:bg-ink-800/20'} ${selectedRows?.has(keyExtractor(row)) ? 'bg-primary/5' : ''}`}
              >
                {hasSelection && (
                  <td className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selectedRows?.has(keyExtractor(row)) || false} onChange={() => onSelectRow?.(keyExtractor(row))}
                      className="w-4 h-4 rounded border-ink-300 text-primary focus:ring-primary/30" />
                  </td>
                )}
                {columns.map(col => (
                  <td key={col.key}
                    className={`px-3 py-3 text-ink-700 ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : String((row as any)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totalRow && (
            <tfoot>
              <tr className="bg-ink-50/50 dark:bg-ink-800/30 font-semibold">
                {hasSelection && <td className="w-10 px-3 py-3" />}
                {columns.map(col => (
                  <td key={col.key}
                    className={`px-3 py-3 text-ink-800 ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {totalRow[col.key] ?? ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-custom bg-ink-50/30 dark:bg-ink-800/20">
          <p className="text-xs text-ink-400">
            Showing {pageStart}–{pageEnd} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
              const start = Math.max(1, pagination.page - 2);
              const page = start + i;
              if (page > pagination.totalPages) return null;
              return (
                <button key={page} onClick={() => pagination.onPageChange(page)}
                  className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${page === pagination.page ? 'bg-primary text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
                  {page}
                </button>
              );
            })}
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <select value={pagination.pageSize} onChange={e => pagination.onPageSizeChange?.(Number(e.target.value))}
            className="text-xs bg-surface border border-border-custom rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20">
            {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export function useTableSort<T>(defaultColumn?: string) {
  const [sortColumn, setSortColumn] = useState(defaultColumn || '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortColumn) return (data: T[]) => data;
    return (data: T[]) => [...data].sort((a, b) => {
      const aVal = (a as any)[sortColumn];
      const bVal = (b as any)[sortColumn];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [sortColumn, sortDirection]);

  return { sortColumn, sortDirection, handleSort, sorted };
}

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange, className }: PaginationProps) {
  if (total <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | 'dots')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('dots');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('dots');
    pages.push(totalPages);
  }

  return (
    <div className={`flex items-center justify-between gap-4 ${className || ''}`}>
      <p className="text-xs text-ink-400 whitespace-nowrap">
        Showing <span className="font-medium text-ink-600">{from}</span>–<span className="font-medium text-ink-600">{to}</span> of{' '}
        <span className="font-medium text-ink-600">{total}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, i) =>
          p === 'dots' ? (
            <span key={`dots-${i}`} className="px-1.5 text-xs text-ink-300">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${p === page ? 'bg-primary text-white shadow-sm' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
            >
              {p}
            </button>
          )
        )}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="text-xs bg-surface border border-border-custom rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        >
          {[5, 10, 20, 50, 100].map(n => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      )}
    </div>
  );
}

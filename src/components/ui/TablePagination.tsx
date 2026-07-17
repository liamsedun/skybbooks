import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function TablePagination({
  page, total, totalPages, from, to,
  onPageChange, onPageSizeChange,
}: TablePaginationProps) {
  if (total <= 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0',
      fontSize: '0.875rem', color: '#64748b',
    }}>
      <span>
        Showing {from + 1}–{to} of {total}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {onPageSizeChange && (
          <select
            value={20}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '0.25rem 0.5rem', borderRadius: '6px',
              border: '1px solid #e2e8f0', fontSize: '0.875rem',
              marginRight: '0.5rem',
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        )}
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          style={{
            padding: '0.25rem 0.5rem', borderRadius: '6px',
            border: '1px solid #e2e8f0', background: page <= 1 ? '#f1f5f9' : '#fff',
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
            opacity: page <= 1 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ padding: '0 0.5rem', fontWeight: 500 }}>
          {page} / {totalPages || 1}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{
            padding: '0.25rem 0.5rem', borderRadius: '6px',
            border: '1px solid #e2e8f0', background: page >= totalPages ? '#f1f5f9' : '#fff',
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            opacity: page >= totalPages ? 0.5 : 1,
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

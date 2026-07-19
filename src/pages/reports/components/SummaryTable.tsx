import React from 'react';

export function SummaryTable({ data, columns, onAccountClick }: { data: any; columns: { key: string; label: string; fmt?: (v: any) => string }[]; onAccountClick?: (acct: any) => void }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <tr>
            {columns.map(col => (
              <th key={col.key} className={`px-3 py-3 ${col.key === 'balance' || col.key === 'amount' ? 'text-right' : 'text-left'}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className={`border-t border-slate-100 hover:bg-slate-50/50 even:bg-slate-50/50 transition-colors ${row.accountId ? 'cursor-pointer' : ''}`} onClick={() => row.accountId && onAccountClick?.(row)}>
              {columns.map(col => (
                <td key={col.key} className={`px-3 py-3 ${col.key === 'balance' || col.key === 'amount' ? 'text-right font-semibold text-slate-800' : 'text-slate-800'}`}>
                  {col.fmt ? col.fmt(row[col.key] ?? row.balance ?? row.amount ?? 0) : row[col.key] || '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">No data available.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { Loader2, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  id?: string;
  searchPlaceholder?: string;
  searchColumn?: string;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  error = null,
  id,
  searchPlaceholder = 'Filter...',
  searchColumn,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
  });

  const getFilteredValue = () => globalFilter;

  return (
    <div className="w-full flex flex-col space-y-4" id={id || 'data-table-container'}>
      {/* Table search filter bar */}
      {searchColumn && (
        <div className="flex items-center">
          <input
            id="table-search-input"
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="px-3 py-2 text-sm border border-slate-200 outline-none rounded-lg w-full md:w-80 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors bg-white text-slate-800"
          />
        </div>
      )}

      {/* Main Grid Wrapper */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch max-h-[500px]">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 sm:px-6 h-12 align-middle text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-surface-subtle select-none"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-150">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 sm:px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-sm font-medium text-slate-500">Retrieving records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 sm:px-6 py-12 text-center text-rose-500 bg-rose-50/20">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <AlertCircle className="w-8 h-8" />
                      <span className="text-sm font-semibold">{error}</span>
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 sm:px-6 py-12 text-center text-slate-400">
                    <span className="text-sm">No transaction or ledger entries found.</span>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="h-12 hover:bg-slate-50/40 transition-colors align-middle">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 sm:px-6 h-12 align-middle text-[13px] text-slate-600 font-medium font-sans">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls footer */}
        {!isLoading && !error && data.length > pageSize && (
          <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between border-t border-slate-100 bg-white">
            <span className="text-xs text-slate-500">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount() || 1}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1 px-3 border border-slate-200 outline-none rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold flex items-center transition-all bg-white"
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" /> Previous
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1 px-3 border border-slate-200 outline-none rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-xs font-semibold flex items-center transition-all bg-white"
              >
                Next <ChevronRight className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default DataTable;

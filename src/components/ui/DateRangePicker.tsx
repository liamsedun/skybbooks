/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  id?: string;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  id,
  className = '',
}: DateRangePickerProps) {
  return (
    <div 
      id={id || 'date-range-picker'}
      className={`inline-flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 border border-slate-250 rounded-xl shadow-sm ${className}`}
    >
      <div className="flex items-center text-slate-400 space-x-1.5">
        <Calendar className="w-4 h-4 text-purple-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Period:</span>
      </div>

      <input
        type="date"
        id="start-date-input"
        value={startDate}
        onChange={(e) => onRangeChange(e.target.value, endDate)}
        className="px-2 py-1 border-0 outline-none text-xs font-medium text-slate-700 bg-transparent rounded focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
      />

      <span className="text-xs font-semibold text-slate-400">to</span>

      <input
        type="date"
        id="end-date-input"
        value={endDate}
        onChange={(e) => onRangeChange(startDate, e.target.value)}
        className="px-2 py-1 border-0 outline-none text-xs font-medium text-slate-700 bg-transparent rounded focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
      />
    </div>
  );
}
export default DateRangePicker;

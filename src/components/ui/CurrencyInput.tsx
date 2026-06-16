/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';

interface CurrencyInputProps {
  value: number; // in Kobo
  onChange: (value: number) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  id,
  placeholder = '0.00',
  className = '',
  disabled = false,
}: CurrencyInputProps) {
  // Represent kobo value as Naira string for editing
  const displayVal = value > 0 ? (value / 100).toFixed(2) : '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawString = e.target.value.replace(/[^\d.]/g, '');
    
    // Support typing decimal numbers
    const parts = rawString.split('.');
    let processed = rawString;
    if (parts.length > 2) {
      // ignore subsequent dots
      processed = parts[0] + '.' + parts[1];
    }

    const floatVal = parseFloat(processed);
    if (isNaN(floatVal)) {
      onChange(0);
    } else {
      // Round to prevent decimal floating point issues
      const koboVal = Math.round(floatVal * 100);
      onChange(koboVal);
    }
  };

  return (
    <div className={`relative flex items-center rounded-lg border border-slate-250 bg-white shadow-sm overflow-hidden focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all ${className}`}>
      <span className="pl-3.5 pr-2.5 text-slate-400 text-sm font-semibold select-none">
        ₦
      </span>
      <input
        type="text"
        id={id || 'naira-txt-input'}
        disabled={disabled}
        value={displayVal}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full py-2.5 pr-3.5 text-sm outline-none bg-transparent text-slate-800 font-medium font-mono"
      />
    </div>
  );
}
export default CurrencyInput;

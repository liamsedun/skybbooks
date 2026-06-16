/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCurrency } from '../../hooks/useCurrency';

interface AmountDisplayProps {
  amountInKobo: number | undefined | null;
  colorize?: 'none' | 'profit-loss' | 'ledger' | 'debit-credit';
  type?: 'debit' | 'credit';
  className?: string;
  decimals?: boolean;
}

export function AmountDisplay({
  amountInKobo,
  colorize = 'none',
  type,
  className = '',
  decimals = true,
}: AmountDisplayProps) {
  const { formatNaira } = useCurrency();
  const value = amountInKobo || 0;

  const formattedValue = formatNaira(value, decimals);

  let textColor = 'text-gray-900 dark:text-gray-100';

  if (colorize === 'profit-loss') {
    textColor = value > 0 ? 'text-emerald-600 font-medium' : value < 0 ? 'text-rose-600 font-medium' : 'text-gray-500';
  } else if (colorize === 'debit-credit') {
    if (type === 'debit') {
      textColor = 'text-emerald-600';
    } else if (type === 'credit') {
      textColor = 'text-rose-600';
    }
  } else if (colorize === 'ledger') {
    textColor = value >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold';
  }

  return (
    <span className={`font-mono ${textColor} ${className}`}>
      {formattedValue}
    </span>
  );
}
export default AmountDisplay;

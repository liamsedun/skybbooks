import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bankingApi } from '../../lib/api';

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

interface CurrencyRate {
  id: string;
  orgId: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source: string | null;
  effectiveDate: string;
  createdAt: string;
}

interface CurrencySelectorProps {
  currency: string;
  onCurrencyChange: (currency: string) => void;
  fxRate?: string | null;
  onFxRateChange?: (rate: string | null) => void;
  date?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencySelector({
  currency,
  onCurrencyChange,
  fxRate,
  onFxRateChange,
  disabled = false,
  className = '',
}: CurrencySelectorProps) {
  const { data: ratesData } = useQuery<CurrencyRate[]>({
    queryKey: ['currency-rates'],
    queryFn: () => bankingApi.getCurrencyRates(),
    staleTime: 5 * 60 * 1000,
  });

  const rates = ratesData || [];

  const latestRateForCurrency = useMemo(() => {
    if (!currency || currency === 'NGN') return null;
    const matching = rates
      .filter((r) => r.quoteCurrency === currency)
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
    return matching.length > 0 ? matching[0].rate : null;
  }, [rates, currency]);

  useEffect(() => {
    if (currency === 'NGN') {
      onFxRateChange?.('1.00000000');
    } else if (latestRateForCurrency && !fxRate) {
      onFxRateChange?.(latestRateForCurrency);
    }
  }, [currency, latestRateForCurrency]);

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = e.target.value;
    onCurrencyChange(newCurrency);
    if (newCurrency === 'NGN') {
      onFxRateChange?.('1.00000000');
    } else {
      onFxRateChange?.(null);
    }
  };

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
        <select
          value={currency}
          onChange={handleCurrencyChange}
          disabled={disabled}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white disabled:bg-slate-50"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          FX Rate {currency !== 'NGN' ? `(1 ${currency} → NGN)` : ''}
        </label>
        <input
          type="text"
          value={fxRate || ''}
          onChange={(e) => onFxRateChange?.(e.target.value || null)}
          disabled={disabled || currency === 'NGN'}
          placeholder={currency !== 'NGN' ? 'Auto-filled or enter rate' : '1.00000000'}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-shadow bg-white disabled:bg-slate-50 disabled:text-slate-400 font-mono"
        />
      </div>
    </div>
  );
}

export default CurrencySelector;

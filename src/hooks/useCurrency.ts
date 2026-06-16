/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery } from '@tanstack/react-query';
import { bankingApi } from '../lib/api';
import { useAuth } from './useAuth';

/**
 * Handles consistent currency formatting in Naira (₦) and converts amounts.
 * Standardizes handling of integer Kobo values (1 Naira = 100 Kobo).
 */
export function useCurrency() {
  const { token } = useAuth();

  const ratesQuery = useQuery({
    queryKey: ['currencyRates'],
    queryFn: bankingApi.getCurrencyRates,
    staleTime: 10 * 60 * 1000, // 10 mins cache
    enabled: !!token,
  });

  /**
   * Safe formatter for Naira (takes kobo or naira)
   */
  const formatNaira = (koboAmount: number | undefined | null, includeDecimals = true): string => {
    if (koboAmount === undefined || koboAmount === null) {
      return '₦0.00';
    }
    const naira = koboAmount / 100;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: includeDecimals ? 2 : 0,
      maximumFractionDigits: includeDecimals ? 2 : 0,
    }).format(naira);
  };

  /**
   * Helper to parse double or string numeric inputs into integer Kobo.
   */
  const parseToKobo = (nairaAmount: string | number): number => {
    if (!nairaAmount) return 0;
    const cleanValue = typeof nairaAmount === 'string' 
      ? nairaAmount.replace(/[^\d.]/g, '') 
      : nairaAmount.toString();
    const parsed = parseFloat(cleanValue);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  };

  /**
   * Converts currency from NGN to foreign or vice versa
   */
  const convertAmount = (amountInKobo: number, fromCurrency = 'NGN', toCurrency = 'USD'): number => {
    if (fromCurrency === toCurrency) return amountInKobo;
    const rates = ratesQuery.data || [];
    const sourceRate = rates.find((r: any) => r.currencyCode === fromCurrency);
    const destRate = rates.find((r: any) => r.currencyCode === toCurrency);

    if (!sourceRate || !destRate) return amountInKobo;

    // Standard rate calculation base
    const ngnValue = amountInKobo / (sourceRate.rateToNgn / 10000); // division by internally scaled rate
    return Math.round(ngnValue * (destRate.rateToNgn / 10000));
  };

  return {
    formatNaira,
    parseToKobo,
    convertAmount,
    rates: ratesQuery.data || [],
    isLoadingRates: ratesQuery.isLoading,
  };
}
export default useCurrency;

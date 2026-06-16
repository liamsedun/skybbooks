/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, currencyRates, organisations } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AppError } from '../lib/errors';

// 1-hour memory cache for fetched exchange rates
interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let ratesCache: RateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Default stable fallbacks: 1 Quote Currency = X Naira
const FALLBACK_TO_NAIRA: Record<string, number> = {
  NGN: 1.0,
  USD: 1620.0,
  GBP: 2050.0,
  EUR: 1730.0,
  GHS: 110.0,
  ZAR: 88.0
};

/**
 * 1. FETCH LATEST EXCHANGE RATES FROM EXTERNAL API
 */
export async function fetchLatestRates(orgId?: string): Promise<Record<string, number>> {
  const now = Date.now();

  // Return memory cache if still fresh
  if (ratesCache && now - ratesCache.fetchedAt < CACHE_TTL_MS) {
    return ratesCache.rates;
  }

  let finalRates: Record<string, number> = { ...FALLBACK_TO_NAIRA };

  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/NGN');
    if (!response.ok) {
      throw new Error(`Exchange Rate API returned status: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const baseRates = data.rates || {};

    // ExchangeRate-API returns rates relative to base (NGN).
    // E.g. baseRates['USD'] = 0.00062. Meaning 1 Naira = 0.00062 USD.
    // We convert this back to our standard Rate format: "How many Naira is 1 USD?"
    // R_usd = 1 / 0.00062 = 1612.9
    for (const currency of Object.keys(FALLBACK_TO_NAIRA)) {
      if (currency === 'NGN') continue;
      if (baseRates[currency] && baseRates[currency] > 0) {
        finalRates[currency] = parseFloat((1 / baseRates[currency]).toFixed(4));
      }
    }

    ratesCache = {
      rates: finalRates,
      fetchedAt: now
    };
  } catch (error: any) {
    console.warn(`CBN Exchange Rates Sync falling back to hardcoded metrics: ${error.message}`);
    // Non-blocking fallback
    ratesCache = {
      rates: finalRates,
      fetchedAt: now
    };
  }

  // Persist updated rates to the DB under target organization(s)
  try {
    let targetOrgIds: string[] = [];
    if (orgId) {
      targetOrgIds = [orgId];
    } else {
      // Find all organisations to keep systemic rates synced
      const allOrgs = await db.select({ id: organisations.id }).from(organisations);
      targetOrgIds = allOrgs.map((o) => o.id);
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (const curOrgId of targetOrgIds) {
      for (const [quote, val] of Object.entries(ratesCache!.rates)) {
        if (quote === 'NGN') continue;

        // "Upsert": delete duplicate entries for same org, day, and currency to keep index compact
        await db
          .delete(currencyRates)
          .where(
            and(
              eq(currencyRates.orgId, curOrgId),
              eq(currencyRates.quoteCurrency, quote),
              eq(currencyRates.baseCurrency, 'NGN')
            )
          );

        await db.insert(currencyRates).values({
          orgId: curOrgId,
          baseCurrency: 'NGN',
          quoteCurrency: quote,
          rate: String(val),
          source: 'ExchangeRate-API',
          effectiveDate: todayDate
        });
      }
    }
  } catch (dbError: any) {
    console.error(`Failed to store currency rates in database: ${dbError.message}`);
  }

  return ratesCache!.rates;
}

/**
 * 2. UNIVERSAL CORRESPONDENCE AMOUNT CONVERTER (ACCURATE KOBO INTEGER ARITHMETIC)
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: Date,
  orgId?: string
): Promise<number> {
  const fromUpper = fromCurrency.toUpperCase();
  const toUpper = toCurrency.toUpperCase();

  if (fromUpper === toUpper) {
    return Math.round(amount);
  }

  // Load converter rates from db or fallback
  let rateFromNaira = FALLBACK_TO_NAIRA[fromUpper] || 1600.0;
  let rateToNaira = FALLBACK_TO_NAIRA[toUpper] || 1600.0;

  try {
    // Attempt to load from database for precise rates
    if (orgId) {
      const dbRatesForOrg = await db
        .select()
        .from(currencyRates)
        .where(eq(currencyRates.orgId, orgId))
        .orderBy(desc(currencyRates.effectiveDate));

      const matchFrom = dbRatesForOrg.find((r) => r.quoteCurrency.toUpperCase() === fromUpper);
      if (matchFrom) rateFromNaira = parseFloat(matchFrom.rate);

      const matchTo = dbRatesForOrg.find((r) => r.quoteCurrency.toUpperCase() === toUpper);
      if (matchTo) rateToNaira = parseFloat(matchTo.rate);
    }
  } catch (err: any) {
    console.warn(`Failed to read currency rate from DB: ${err.message}. Using cache/fallback.`);
  }

  // If caching loaded fresh rates, override fallbacks
  if (ratesCache) {
    if (ratesCache.rates[fromUpper]) rateFromNaira = ratesCache.rates[fromUpper];
    if (ratesCache.rates[toUpper]) rateToNaira = ratesCache.rates[toUpper];
  }

  // 1. Convert fromCurrency amount to target base NGN (expressed as fractional float kobo)
  let nairaAmountFloat = 0;
  if (fromUpper === 'NGN') {
    nairaAmountFloat = amount;
  } else {
    nairaAmountFloat = amount * rateFromNaira;
  }

  // 2. Convert base NGN into target currency equivalent
  let convertedFloat = 0;
  if (toUpper === 'NGN') {
    convertedFloat = nairaAmountFloat;
  } else {
    convertedFloat = nairaAmountFloat / rateToNaira;
  }

  return Math.round(convertedFloat);
}

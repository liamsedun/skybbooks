import { db, currencyRates } from '../db/schema';
import { eq, and, desc, lte } from 'drizzle-orm';

const FALLBACK_RATES: Record<string, number> = {
  NGN: 1.0, USD: 1620.0, GBP: 2050.0, EUR: 1730.0,
  GHS: 110.0, ZAR: 88.0, CNY: 225.0, JPY: 10.8
};

export async function getRateForDate(
  orgId: string,
  currencyCode: string,
  date?: Date
): Promise<number> {
  const cc = currencyCode.toUpperCase();
  if (cc === 'NGN') return 1.0;

  const lookupDate = date || new Date();
  lookupDate.setHours(23, 59, 59, 999);

  try {
    const [rate] = await db
      .select()
      .from(currencyRates)
      .where(
        and(
          eq(currencyRates.orgId, orgId),
          eq(currencyRates.quoteCurrency, cc),
          eq(currencyRates.baseCurrency, 'NGN'),
          lte(currencyRates.effectiveDate, lookupDate)
        )
      )
      .orderBy(desc(currencyRates.effectiveDate))
      .limit(1);

    if (rate) return parseFloat(rate.rate);
  } catch {
    // fall through to fallback
  }

  return FALLBACK_RATES[cc] || 1600.0;
}

export async function populateFxRate(
  orgId: string,
  currency: string,
  date?: Date | string
): Promise<string> {
  if (currency.toUpperCase() === 'NGN') return '1.00000000';
  const d = date ? new Date(date) : new Date();
  const rate = await getRateForDate(orgId, currency, d);
  return rate.toFixed(8);
}

export function toNgn(amountKobo: number, fxRate: string | number | null): number {
  if (!fxRate) return amountKobo;
  const rate = typeof fxRate === 'string' ? parseFloat(fxRate) : fxRate;
  if (rate <= 0 || rate === 1.0) return amountKobo;
  return Math.round(amountKobo * rate);
}

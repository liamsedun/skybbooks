import { db, organisations } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface OrgSettings {
  general?: { defaultCurrency?: string; defaultTaxRate?: number; autoGenerateNumbers?: boolean; allowNegativeInventory?: boolean; [key: string]: any };
  currencies?: { baseCurrency?: string; activeCurrencies?: string[]; rates?: Record<string, number>; customCurrencies?: any[] };
  taxes?: { taxRates?: { name: string; rate: number }[]; whtRates?: any[]; taxRegistrationNumber?: string; enableWht?: boolean; [key: string]: any };
  txnNumbering?: { series?: { module: string; prefix: string; start: string }[] };
  branding?: { primaryColor?: string; showLogo?: boolean; [key: string]: any };
  paymentTerms?: { terms?: { name: string; days: number }[] };
  invoices?: { autoGenerateNumbers?: boolean; allowDiscounts?: boolean };
  bills?: { autoGenerateNumbers?: boolean };
  quotes?: { autoGenerateNumbers?: boolean };
  salesOrders?: { autoGenerateNumbers?: boolean };
  creditNotes?: { autoGenerateNumbers?: boolean };
  purchases?: { autoGenerateNumbers?: boolean };
  revenueRecognition?: { method?: 'accrual' | 'cash'; deferRevenue?: boolean; autoDeferredSchedule?: boolean };
  [key: string]: any;
}

const DEFAULT_SETTINGS: OrgSettings = {
  general: { defaultCurrency: 'NGN', defaultTaxRate: 7.5, autoGenerateNumbers: true, allowNegativeInventory: false },
  currencies: { baseCurrency: 'NGN', activeCurrencies: ['NGN', 'USD', 'EUR', 'GBP'], rates: {}, customCurrencies: [] },
  taxes: { taxRates: [{ name: 'VAT (7.5%)', rate: 7.5 }], whtRates: [], taxRegistrationNumber: '', enableWht: false },
  txnNumbering: { series: [] },
  branding: { primaryColor: '#1e3a8a', showLogo: true },
  paymentTerms: { terms: [] },
  invoices: { autoGenerateNumbers: true, allowDiscounts: true },
  bills: { autoGenerateNumbers: true },
  quotes: { autoGenerateNumbers: true },
  salesOrders: { autoGenerateNumbers: true },
  creditNotes: { autoGenerateNumbers: true },
  revenueRecognition: { method: 'accrual', deferRevenue: false, autoDeferredSchedule: false },
};

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  try {
    const [org] = await db.select({ settings: organisations.settings }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
    if (!org?.settings) return { ...DEFAULT_SETTINGS };
    const settings = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings;
    // Deep merge with defaults
    const merged: OrgSettings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (settings[key] && typeof settings[key] === 'object' && !Array.isArray(settings[key])) {
        merged[key] = { ...(DEFAULT_SETTINGS as any)[key], ...settings[key] };
      } else if (settings[key] !== undefined) {
        (merged as any)[key] = settings[key];
      }
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function getSetting<T>(orgId: string, key: string): Promise<T | undefined> {
  const settings = await getOrgSettings(orgId);
  return (settings as any)[key];
}

export { DEFAULT_SETTINGS };

import { eq, and } from 'drizzle-orm';
import { db, subscriptionPlans, subscriptionConfig } from '../db/schema';

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addBillingDuration(from: Date, cycle: string): Date {
  switch (cycle) {
    case 'monthly': return addDays(from, 30);
    case 'quarterly': return addDays(from, 90);
    case 'yearly': return addDays(from, 365);
    default: return addDays(from, 30);
  }
}

export function billingCycleToDays(cycle: string): number {
  switch (cycle) {
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'yearly': return 365;
    default: return 30;
  }
}

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function getPlan(planId: string) {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  return plan || null;
}

export function getPlanPrice(plan: any, billingCycle: string): number {
  if (billingCycle === 'yearly' || billingCycle === 'annual') return Number(plan.annualPriceKobo || 0);
  if (billingCycle === 'quarterly') return Number(plan.monthlyPriceKobo || 0) * 3;
  return Number(plan.monthlyPriceKobo || 0);
}

export function calculateDiscount(amountKobo: number, coupon?: any, promotion?: any): number {
  let discount = 0;
  if (coupon) {
    if (coupon.discountType === 'percentage') discount += amountKobo * (coupon.discountPercent / 100);
    else if (coupon.discountType === 'fixed_amount') discount += Number(coupon.discountAmountKobo || 0);
    else if (coupon.discountType === 'free_months') discount = amountKobo;
  }
  if (promotion) {
    if (promotion.discountType === 'percentage') discount += amountKobo * (promotion.discountPercent / 100);
    else if (promotion.discountType === 'fixed_amount') discount += Number(promotion.discountAmountKobo || 0);
    else if (promotion.discountType === 'free_months') discount = amountKobo;
  }
  return Math.min(discount, amountKobo);
}

export function prorateAmount(amountKobo: number, daysUsed: number, totalDays: number): number {
  if (totalDays <= 0) return amountKobo;
  return Math.round((amountKobo / totalDays) * daysUsed);
}

export function generateInvoiceNumber(orgId: string, prefix = 'SUB-INV'): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000000) + 1000000;
  return `${prefix}-${year}-${rand}`;
}

export function generateCreditNoteNumber(orgId: string, prefix = 'CN'): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}-${year}-${rand}`;
}

export async function getOrgConfig(orgId: string, key: string, defaultValue?: any): Promise<any> {
  const [row] = await db.select().from(subscriptionConfig)
    .where(and(eq(subscriptionConfig.orgId, orgId), eq(subscriptionConfig.key, key)))
    .limit(1);
  if (row) return row.value;
  return defaultValue !== undefined ? defaultValue : null;
}

export async function setOrgConfig(orgId: string, key: string, value: any): Promise<void> {
  await db.insert(subscriptionConfig).values({ orgId, key, value } as any)
    .onConflictDoUpdate({ target: [subscriptionConfig.orgId, subscriptionConfig.key], set: { value } as any });
}

export const DEFAULT_CONFIG: Record<string, any> = {
  'auto_renew': true,
  'payment_retry_count': 3,
  'payment_retry_interval_hours': 24,
  'invoice_due_days': 7,
  'grace_period_days': 3,
  'suspension_warning_days': 2,
  'max_failed_payments': 5,
  'currency': 'NGN',
  'timezone': 'Africa/Lagos',
  'invoice_prefix': 'SUB-INV',
  'credit_note_prefix': 'CN',
  'tax_calculation': 'exclusive',
  'decimal_places': 2,
  'notify_admin_on_signup': true,
  'notify_admin_on_payment': true,
  'notify_admin_on_failure': true,
  'allow_partial_payments': false,
  'require_po_number': false,
};

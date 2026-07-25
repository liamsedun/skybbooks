/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  billingCycleEnum,
  discountTypeEnum,
  referralRewardTypeEnum,
  subscriptionStatusEnum,
  promoCampaignStatusEnum,
  subInvoiceStatusEnum,
  subPaymentMethodEnum,
  subPaymentStatusEnum,
  featureFlagStateEnum,
  regionPricingEnum,
  subNotificationEventEnum,
  subNotificationChannelEnum,
  subNotificationStatusEnum,
  platformRoleEnum,
} from '../enums';

// ========== Subscription Plans ==========

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  monthlyPriceKobo: bigint('monthly_price_kobo', { mode: 'number' }).default(0).notNull(),
  annualPriceKobo: bigint('annual_price_kobo', { mode: 'number' }).default(0).notNull(),
  currency: text('currency').default('NGN').notNull(),
  billingCycle: billingCycleEnum('billing_cycle').default('monthly').notNull(),
  trialDays: integer('trial_days').default(0).notNull(),
  userLimit: integer('user_limit').default(1).notNull(),
  maxCompanies: integer('max_companies').default(1).notNull(),
  storageLimitGb: integer('storage_limit_gb').default(1).notNull(),
  apiRequests: integer('api_requests').default(0).notNull(),
  maxCustomers: integer('max_customers').default(0).notNull(),
  maxVendors: integer('max_vendors').default(0).notNull(),
  maxProducts: integer('max_products').default(0).notNull(),
  maxInvoices: integer('max_invoices').default(0).notNull(),
  maxTransactions: integer('max_transactions').default(0).notNull(),
  maxBankAccounts: integer('max_bank_accounts').default(0).notNull(),
  maxWarehouses: integer('max_warehouses').default(0).notNull(),
  maxProjects: integer('max_projects').default(0).notNull(),
  maxAssets: integer('max_assets').default(0).notNull(),
  maxReports: integer('max_reports').default(0).notNull(),
  maxAiRequests: integer('max_ai_requests').default(0).notNull(),
  maxOcrDocuments: integer('max_ocr_documents').default(0).notNull(),
  supportLevel: text('support_level').default('community').notNull(),
  popularBadge: boolean('popular_badge').default(false).notNull(),
  recommendedBadge: boolean('recommended_badge').default(false).notNull(),
  ribbonColor: text('ribbon_color'),
  buttonText: text('button_text').default('Subscribe').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  plansActiveIdx: index('idx_sub_plans_active').on(table.isActive, table.sortOrder),
  plansCodeIdx: index('idx_sub_plans_code').on(table.code),
}));

// ========== Subscriptions ==========

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id).notNull(),
  status: subscriptionStatusEnum('status').default('active').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  gracePeriodEnd: timestamp('grace_period_end'),
  suspendedAt: timestamp('suspended_at'),
  pausedAt: timestamp('paused_at'),
  pausedEnd: timestamp('paused_end'),
  canceledAt: timestamp('canceled_at'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  billingCycle: text('billing_cycle').default('monthly').notNull(),
  billingCycleAnchor: timestamp('billing_cycle_anchor').notNull(),
  couponId: uuid('coupon_id'),
  promotionId: uuid('promotion_id'),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  renewalCount: integer('renewal_count').default(0).notNull(),
  lastRenewalAttempt: timestamp('last_renewal_attempt'),
  paymentFailureCount: integer('payment_failure_count').default(0).notNull(),
  expirationReminderSentAt: timestamp('expiration_reminder_sent_at'),
  previousPlanId: uuid('previous_plan_id').references(() => subscriptionPlans.id),
  nextPlanId: uuid('next_plan_id').references(() => subscriptionPlans.id),
  scheduledChangeAt: timestamp('scheduled_change_at'),
  nextBillingDate: timestamp('next_billing_date'),
  lastPaymentDate: timestamp('last_payment_date'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  subOrgIdx: index('idx_sub_org').on(table.orgId),
  subPlanIdx: index('idx_sub_plan').on(table.planId),
  subStatusIdx: index('idx_sub_status').on(table.status),
  subOrgStatusIdx: index('idx_sub_org_status').on(table.orgId, table.status),
}));

// ========== Subscription Status History ==========

export const subscriptionStatusHistory = pgTable('subscription_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  fromStatus: subscriptionStatusEnum('from_status'),
  toStatus: subscriptionStatusEnum('to_status').notNull(),
  reason: text('reason'),
  changedBy: uuid('changed_by'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  histSubIdx: index('idx_ssh_sub').on(table.subscriptionId),
  histCreatedIdx: index('idx_ssh_created').on(table.createdAt),
}));

// ========== Coupons ==========

export const coupons = pgTable('coupons', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  code: text('code').notNull().unique(),
  description: text('description'),
  discountType: discountTypeEnum('discount_type').default('percentage').notNull(),
  discountPercent: integer('discount_percent'),
  discountAmountKobo: bigint('discount_amount_kobo', { mode: 'number' }),
  freeMonths: integer('free_months').default(0),
  maxRedemptions: integer('max_redemptions').default(0),
  currentRedemptions: integer('current_redemptions').default(0).notNull(),
  minAmountKobo: bigint('min_amount_kobo', { mode: 'number' }),
  maxAmountKobo: bigint('max_amount_kobo', { mode: 'number' }),
  applicablePlanIds: uuid('applicable_plan_ids').array(),
  minPlanId: uuid('min_plan_id'),
  maxPlanId: uuid('max_plan_id'),
  regionRestrictions: text('region_restrictions').array(),
  campaignId: uuid('campaign_id').references(() => promotionalCampaigns.id),
  isStackable: boolean('is_stackable').default(false).notNull(),
  priority: integer('priority').default(0).notNull(),
  requireMinimumPayment: boolean('require_minimum_payment').default(false),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  isFirstOrderOnly: boolean('is_first_order_only').default(false).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  couponCodeIdx: uniqueIndex('idx_coupon_code').on(table.code),
  couponActiveIdx: index('idx_coupon_active').on(table.isActive, table.expiresAt),
  couponCampaignIdx: index('idx_coupon_campaign').on(table.campaignId),
}));

// ========== Promotions ==========

export const promotions = pgTable('promotions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  name: text('name').notNull(),
  description: text('description'),
  discountType: discountTypeEnum('discount_type').default('percentage').notNull(),
  discountPercent: integer('discount_percent'),
  discountAmountKobo: bigint('discount_amount_kobo', { mode: 'number' }),
  freeMonths: integer('free_months').default(0),
  applicablePlanIds: uuid('applicable_plan_ids').array(),
  minPlanId: uuid('min_plan_id'),
  maxPlanId: uuid('max_plan_id'),
  regionRestrictions: text('region_restrictions').array(),
  campaignId: uuid('campaign_id').references(() => promotionalCampaigns.id),
  isStackable: boolean('is_stackable').default(false).notNull(),
  priority: integer('priority').default(0).notNull(),
  budgetKobo: bigint('budget_kobo', { mode: 'number' }),
  spentKobo: bigint('spent_kobo', { mode: 'number' }).default(0),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  maxRedemptions: integer('max_redemptions').default(0),
  currentRedemptions: integer('current_redemptions').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  promoActiveIdx: index('idx_promo_active').on(table.isActive, table.startDate, table.endDate),
  promoCampaignIdx: index('idx_promo_campaign').on(table.campaignId),
}));

// ========== Promotional Campaigns ==========

export const promotionalCampaigns = pgTable('promotional_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').default('general').notNull(),
  status: promoCampaignStatusEnum('status').default('draft').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  budgetKobo: bigint('budget_kobo', { mode: 'number' }),
  spentKobo: bigint('spent_kobo', { mode: 'number' }).default(0),
  targetPlanIds: uuid('target_plan_ids').array(),
  targetRegions: text('target_regions').array(),
  maxRedemptions: integer('max_redemptions').default(0),
  currentRedemptions: integer('current_redemptions').default(0).notNull(),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  campOrgIdx: index('idx_camp_org').on(table.orgId),
  campStatusIdx: index('idx_camp_status').on(table.status, table.startDate, table.endDate),
}));

// ========== Referral Codes ==========

export const referralCodes = pgTable('referral_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  referrerOrgId: uuid('referrer_org_id'),
  referrerUserId: uuid('referrer_user_id'),
  code: text('code').notNull().unique(),
  description: text('description'),
  rewardType: referralRewardTypeEnum('reward_type').default('fixed_amount').notNull(),
  rewardValue: integer('reward_value').default(0).notNull(),
  rewardFreeMonths: integer('reward_free_months').default(0),
  maxRedemptions: integer('max_redemptions').default(0),
  currentRedemptions: integer('current_redemptions').default(0).notNull(),
  rewardExpiresInDays: integer('reward_expires_in_days'),
  applicablePlanIds: uuid('applicable_plan_ids').array(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  refCodeIdx: uniqueIndex('idx_ref_code').on(table.code),
  refOrgIdx: index('idx_ref_org').on(table.orgId),
  refReferrerIdx: index('idx_ref_referrer').on(table.referrerOrgId),
}));

// ========== Partner Discounts ==========

export const partnerDiscounts = pgTable('partner_discounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  partnerName: text('partner_name').notNull(),
  partnerCode: text('partner_code').notNull().unique(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  discountType: discountTypeEnum('discount_type').default('percentage').notNull(),
  discountPercent: integer('discount_percent'),
  discountAmountKobo: bigint('discount_amount_kobo', { mode: 'number' }),
  freeMonths: integer('free_months').default(0),
  commissionPercent: integer('commission_percent').default(0),
  commissionAmountKobo: bigint('commission_amount_kobo', { mode: 'number' }),
  applicablePlanIds: uuid('applicable_plan_ids').array(),
  maxRedemptions: integer('max_redemptions').default(0),
  currentRedemptions: integer('current_redemptions').default(0).notNull(),
  regionRestrictions: text('region_restrictions').array(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  partnerCodeIdx: uniqueIndex('idx_partner_code').on(table.partnerCode),
  partnerOrgIdx: index('idx_partner_org').on(table.orgId),
}));

// ========== Redemption History ==========

export const redemptionHistory = pgTable('redemption_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id),
  redemptionType: text('redemption_type').notNull(),
  sourceId: text('source_id').notNull(),
  sourceCode: text('source_code'),
  discountType: discountTypeEnum('discount_type').notNull(),
  discountValue: integer('discount_value').default(0),
  discountKobo: bigint('discount_kobo', { mode: 'number' }).default(0).notNull(),
  freeMonths: integer('free_months').default(0),
  originalAmountKobo: bigint('original_amount_kobo', { mode: 'number' }).notNull(),
  finalAmountKobo: bigint('final_amount_kobo', { mode: 'number' }).notNull(),
  metadata: jsonb('metadata').default({}),
  redeemedBy: uuid('redeemed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  rhOrgIdx: index('idx_rh_org').on(table.orgId),
  rhSubIdx: index('idx_rh_sub').on(table.subscriptionId),
  rhInvIdx: index('idx_rh_inv').on(table.invoiceId),
  rhTypeIdx: index('idx_rh_type').on(table.redemptionType, table.sourceId),
  rhCreatedIdx: index('idx_rh_created').on(table.createdAt),
}));

// ========== Subscription Invoices ==========

export const subscriptionInvoices = pgTable('subscription_invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  invoiceNumber: text('invoice_number').notNull(),
  description: text('description'),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).default(0).notNull(),
  taxKobo: bigint('tax_kobo', { mode: 'number' }).default(0).notNull(),
  totalKobo: bigint('total_kobo', { mode: 'number' }).default(0).notNull(),
  discountKobo: bigint('discount_kobo', { mode: 'number' }).default(0).notNull(),
  status: subInvoiceStatusEnum('status').default('pending').notNull(),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  dueDate: timestamp('due_date'),
  paidAt: timestamp('paid_at'),
  paidBy: uuid('paid_by'),
  couponId: uuid('coupon_id').references(() => coupons.id),
  promotionId: uuid('promotion_id').references(() => promotions.id),
  paymentMethod: subPaymentMethodEnum('payment_method'),
  gatewayReference: text('gateway_reference'),
  gatewayResponse: jsonb('gateway_response').default({}),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  receiptUrl: text('receipt_url'),
  refundedAt: timestamp('refunded_at'),
  refundedAmountKobo: bigint('refunded_amount_kobo', { mode: 'number' }).default(0),
  refundReason: text('refund_reason'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  subInvOrgIdx: index('idx_sub_inv_org').on(table.orgId),
  subInvSubIdx: index('idx_sub_inv_sub').on(table.subscriptionId),
  subInvStatusIdx: index('idx_sub_inv_status').on(table.status),
  subInvNumberIdx: index('idx_sub_inv_number').on(table.invoiceNumber),
}));

// ========== Subscription Invoice Items ==========

export const subscriptionInvoiceItems = pgTable('subscription_invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id).notNull(),
  description: text('description').notNull(),
  type: text('type').default('subscription').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  unitPriceKobo: bigint('unit_price_kobo', { mode: 'number' }).default(0).notNull(),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).default(0).notNull(),
  taxKobo: bigint('tax_kobo', { mode: 'number' }).default(0).notNull(),
  totalKobo: bigint('total_kobo', { mode: 'number' }).default(0).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  siiInvIdx: index('idx_sii_invoice').on(table.invoiceId),
  siiOrgIdx: index('idx_sii_org').on(table.orgId),
}));

// ========== Subscription Payments ==========

export const subscriptionPayments = pgTable('subscription_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id),
  gateway: text('gateway').notNull(),
  gatewayReference: text('gateway_reference').notNull(),
  gatewayTransactionId: text('gateway_transaction_id'),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
  feeKobo: bigint('fee_kobo', { mode: 'number' }).default(0),
  currency: text('currency').default('NGN').notNull(),
  status: subPaymentStatusEnum('status').default('pending').notNull(),
  paymentMethod: subPaymentMethodEnum('payment_method').default('unknown'),
  payerEmail: text('payer_email'),
  payerName: text('payer_name'),
  channel: text('channel'),
  isAutoRenewal: boolean('is_auto_renewal').default(false).notNull(),
  isRetry: boolean('is_retry').default(false).notNull(),
  retryAttempt: integer('retry_attempt').default(0),
  receiptUrl: text('receipt_url'),
  authorizationUrl: text('authorization_url'),
  metadata: jsonb('metadata').default({}),
  rawResponse: jsonb('raw_response').default({}),
  paidAt: timestamp('paid_at'),
  settledAt: timestamp('settled_at'),
  refundedAt: timestamp('refunded_at'),
  refundedAmountKobo: bigint('refunded_amount_kobo', { mode: 'number' }).default(0),
  refundReason: text('refund_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  subPayOrgIdx: index('idx_sub_pay_org').on(table.orgId),
  subPaySubIdx: index('idx_sub_pay_sub').on(table.subscriptionId),
  subPayInvIdx: index('idx_sub_pay_inv').on(table.invoiceId),
  subPayRefIdx: index('idx_sub_pay_ref').on(table.gatewayReference),
  subPayStatusIdx: index('idx_sub_pay_status').on(table.status),
  subPayCreatedIdx: index('idx_sub_pay_created').on(table.createdAt),
}));

// ========== Subscription Credit Notes ==========

export const subscriptionCreditNotes = pgTable('subscription_credit_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  creditNoteNumber: text('credit_note_number').notNull(),
  reason: text('reason').notNull(),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).default(0).notNull(),
  taxKobo: bigint('tax_kobo', { mode: 'number' }).default(0).notNull(),
  totalKobo: bigint('total_kobo', { mode: 'number' }).default(0).notNull(),
  status: text('status').default('issued').notNull(),
  appliedAt: timestamp('applied_at'),
  refundedAt: timestamp('refunded_at'),
  refundPaymentId: uuid('refund_payment_id'),
  createdBy: uuid('created_by'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  scnOrgIdx: index('idx_scn_org').on(table.orgId),
  scnInvIdx: index('idx_scn_invoice').on(table.invoiceId),
  scnSubIdx: index('idx_scn_sub').on(table.subscriptionId),
  scnNumIdx: uniqueIndex('idx_scn_number').on(table.creditNoteNumber),
}));

// ========== Subscription Tax Rates ==========

export const subscriptionTaxRates = pgTable('subscription_tax_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  name: text('name').notNull(),
  rate: integer('rate').notNull(),
  type: text('type').default('vat').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  description: text('description'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  strOrgIdx: index('idx_str_org').on(table.orgId),
  strActiveIdx: index('idx_str_active').on(table.orgId, table.isActive, table.isDefault),
}));

// ========== Subscription Usage ==========

export const subscriptionUsage = pgTable('subscription_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  featureKey: text('feature_key').notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  usageLimit: integer('usage_limit'),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  usageSubFeatureIdx: index('idx_usage_sub_feature').on(table.subscriptionId, table.featureKey),
  usageOrgPeriodIdx: index('idx_usage_org_period').on(table.orgId, table.periodStart, table.periodEnd),
}));

// ========== Addon Products ==========

export const addonProducts = pgTable('addon_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  category: text('category').notNull(),
  monthlyPriceKobo: bigint('monthly_price_kobo', { mode: 'number' }).default(0).notNull(),
  annualPriceKobo: bigint('annual_price_kobo', { mode: 'number' }).default(0).notNull(),
  usageLimit: integer('usage_limit').default(0),
  limitKey: text('limit_key'),
  isActive: boolean('is_active').default(true).notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  apCodeIdx: uniqueIndex('idx_ap_code').on(table.code),
  apCategoryIdx: index('idx_ap_category').on(table.category),
  apActiveIdx: index('idx_ap_active').on(table.isActive, table.isPublic),
}));

// ========== Subscription Addons ==========

export const subscriptionAddons = pgTable('subscription_addons', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  productId: uuid('product_id').references(() => addonProducts.id),
  name: text('name').notNull(),
  description: text('description'),
  priceKobo: bigint('price_kobo', { mode: 'number' }).default(0).notNull(),
  priceWhenPurchasedKobo: bigint('price_when_purchased_kobo', { mode: 'number' }),
  quantity: integer('quantity').default(1).notNull(),
  billingCycle: text('billing_cycle').default('monthly').notNull(),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  activatedAt: timestamp('activated_at'),
  expiresAt: timestamp('expires_at'),
  nextBillingDate: timestamp('next_billing_date'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  removedAt: timestamp('removed_at'),
  limitsJson: jsonb('limits_json').default({}),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  saOrgIdx: index('idx_sa_org').on(table.orgId),
  saSubIdx: index('idx_sa_sub').on(table.subscriptionId),
  saProductIdx: index('idx_sa_product').on(table.productId),
  saActiveIdx: index('idx_sa_active').on(table.subscriptionId, table.isActive),
  saExpiryIdx: index('idx_sa_expiry').on(table.expiresAt),
  saNextBillingIdx: index('idx_sa_next_billing').on(table.nextBillingDate),
}));

// ========== Payment Gateway Configs ==========

export const paymentGatewayConfigs = pgTable('payment_gateway_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  gateway: text('gateway').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  publicKey: text('public_key'),
  secretKey: text('secret_key'),
  webhookSecret: text('webhook_secret'),
  environment: text('environment').default('live').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  pgcOrgIdx: index('idx_pgc_org').on(table.orgId),
  pgcOrgGatewayIdx: uniqueIndex('idx_pgc_org_gateway').on(table.orgId, table.gateway),
}));

// ========== Payment Receipts ==========

export const paymentReceipts = pgTable('payment_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  paymentId: uuid('payment_id').references(() => subscriptionPayments.id).notNull(),
  invoiceId: uuid('invoice_id').references(() => subscriptionInvoices.id),
  receiptNumber: text('receipt_number').notNull(),
  title: text('title').notNull(),
  htmlContent: text('html_content'),
  pdfUrl: text('pdf_url'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  prOrgIdx: index('idx_pr_org').on(table.orgId),
  prPaymentIdx: index('idx_pr_payment').on(table.paymentId),
  prReceiptNumIdx: uniqueIndex('idx_pr_receipt_num').on(table.receiptNumber),
}));

// ========== Feature Flags ==========

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').default('general').notNull(),
  defaultState: featureFlagStateEnum('default_state').default('disabled').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  flagsCodeIdx: index('idx_ff_code').on(table.code),
  flagsCategoryIdx: index('idx_ff_category').on(table.category),
  flagsActiveIdx: index('idx_ff_active').on(table.isActive, table.sortOrder),
}));

// ========== Plan Feature Flags ==========

export const planFeatureFlags = pgTable('plan_feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id).notNull(),
  featureCode: text('feature_code').notNull(),
  state: featureFlagStateEnum('state').default('disabled').notNull(),
  usageLimit: integer('usage_limit').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  planFeaturePlanIdx: index('idx_pff_plan').on(table.planId),
  planFeatureCodeIdx: index('idx_pff_code').on(table.featureCode),
  planFeatureUniqueIdx: uniqueIndex('idx_pff_plan_feature').on(table.planId, table.featureCode),
}));

// ========== Subscription Feature Overrides ==========

export const subscriptionFeatureOverrides = pgTable('subscription_feature_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  featureKey: text('feature_key').notNull(),
  featureValue: jsonb('feature_value').notNull(),
  isLimit: boolean('is_limit').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fOverridePlanIdx: index('idx_foverride_plan').on(table.planId, table.featureKey),
  fOverrideSubIdx: index('idx_foverride_sub').on(table.subscriptionId, table.featureKey),
}));

// ========== Org Feature Flags ==========

export const orgFeatureFlags = pgTable('org_feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  featureCode: text('feature_code').notNull(),
  state: featureFlagStateEnum('state'),
  usageLimit: integer('usage_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgFlagOrgIdx: index('idx_off_org').on(table.orgId),
  orgFlagCodeIdx: index('idx_off_code').on(table.featureCode),
  orgFlagUniqueIdx: uniqueIndex('idx_off_org_feature').on(table.orgId, table.featureCode),
}));

// ========== User Feature Flags ==========

export const userFeatureFlags = pgTable('user_feature_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  featureCode: text('feature_code').notNull(),
  state: featureFlagStateEnum('state'),
  usageLimit: integer('usage_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userFlagUserIdx: index('idx_uff_user').on(table.userId),
  userFlagCodeIdx: index('idx_uff_code').on(table.featureCode),
  userFlagUniqueIdx: uniqueIndex('idx_uff_user_feature').on(table.userId, table.featureCode),
}));

// ========== Regional Pricing ==========

export const regionalPricing = pgTable('regional_pricing', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id).notNull(),
  region: regionPricingEnum('region').notNull(),
  currency: text('currency').default('NGN').notNull(),
  monthlyPriceKobo: bigint('monthly_price_kobo', { mode: 'number' }).default(0).notNull(),
  annualPriceKobo: bigint('annual_price_kobo', { mode: 'number' }).default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  rpPlanRegionIdx: uniqueIndex('idx_rp_plan_region').on(table.planId, table.region),
  rpActiveIdx: index('idx_rp_active').on(table.isActive),
}));

// ========== Enterprise Contracts ==========

export const enterpriseContracts = pgTable('enterprise_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),
  contractNumber: text('contract_number').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  negotiatedPriceKobo: bigint('negotiated_price_kobo', { mode: 'number' }),
  currency: text('currency').default('NGN').notNull(),
  billingCycle: text('billing_cycle').default('monthly').notNull(),
  customFeatures: jsonb('custom_features').default({}),
  usageLimits: jsonb('usage_limits').default({}),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  autoRenew: boolean('auto_renew').default(true).notNull(),
  status: text('status').default('active').notNull(),
  signedByOrg: timestamp('signed_by_org'),
  signedByProvider: timestamp('signed_by_provider'),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ecOrgIdx: index('idx_ec_org').on(table.orgId),
  ecStatusIdx: index('idx_ec_status').on(table.status),
  ecEndIdx: index('idx_ec_end').on(table.endDate),
}));

// ========== Reseller Contracts ==========

export const resellerContracts = pgTable('reseller_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  resellerOrgId: uuid('reseller_org_id').notNull(),
  planId: uuid('plan_id').references(() => subscriptionPlans.id),
  resellerName: text('reseller_name').notNull(),
  resellerCode: text('reseller_code').notNull().unique(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  markupPercent: integer('markup_percent').default(0),
  markupAmountKobo: bigint('markup_amount_kobo', { mode: 'number' }).default(0),
  commissionPercent: integer('commission_percent').default(0),
  discountPercent: integer('discount_percent').default(0),
  currency: text('currency').default('NGN').notNull(),
  regionRestrictions: text('region_restrictions').array(),
  maxCustomers: integer('max_customers').default(0),
  commissionKobo: bigint('commission_kobo', { mode: 'number' }).default(0),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  status: text('status').default('active').notNull(),
  metadata: jsonb('metadata').default({}),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  rcOrgIdx: index('idx_rc_org').on(table.resellerOrgId),
  rcCodeIdx: uniqueIndex('idx_rc_code').on(table.resellerCode),
  rcStatusIdx: index('idx_rc_status').on(table.status),
}));

// ========== Subscription Config ==========

export const subscriptionConfig = pgTable('subscription_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').unique(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  scOrgKeyIdx: uniqueIndex('idx_sc_org_key').on(table.orgId, table.key),
}));

// ========== White Label Config ==========

export const whiteLabelConfig = pgTable('white_label_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().unique(),
  brandName: text('brand_name'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color').default('#3b82f6'),
  secondaryColor: text('secondary_color').default('#1e40af'),
  accentColor: text('accent_color').default('#10b981'),
  customDomain: text('custom_domain'),
  supportEmail: text('support_email'),
  supportPhone: text('support_phone'),
  footerText: text('footer_text'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  wlOrgIdx: uniqueIndex('idx_wl_org').on(table.orgId),
  wlDomainIdx: index('idx_wl_domain').on(table.customDomain),
}));

// ========== Subscription Notification Templates ==========

export const subNotificationTemplates = pgTable('sub_notification_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  eventType: subNotificationEventEnum('event_type').notNull(),
  channel: subNotificationChannelEnum('channel').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  sntOrgEventIdx: index('idx_snt_org_event').on(table.orgId, table.eventType),
  sntChannelIdx: index('idx_snt_channel').on(table.channel),
}));

// ========== Subscription Notification Log ==========

export const subNotificationLog = pgTable('sub_notification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  eventType: subNotificationEventEnum('event_type').notNull(),
  channel: subNotificationChannelEnum('channel').notNull(),
  recipient: text('recipient'),
  subject: text('subject'),
  body: text('body'),
  status: subNotificationStatusEnum('status').default('pending').notNull(),
  error: text('error'),
  metadata: jsonb('metadata').default({}),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  snlOrgIdx: index('idx_snl_org').on(table.orgId),
  snlEventIdx: index('idx_snl_event').on(table.eventType),
  snlStatusIdx: index('idx_snl_status').on(table.status),
  snlCreatedIdx: index('idx_snl_created').on(table.createdAt),
}));

// ========== Subscription Notification Preferences ==========

export const subNotificationPreferences = pgTable('sub_notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().unique(),
  enabledEvents: subNotificationEventEnum('enabled_events').array().default([]).notNull(),
  channels: subNotificationChannelEnum('channels').array().default(['email', 'in_app']).notNull(),
  emailRecipients: text('email_recipients').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ========== Subscription Notification Schedule ==========

export const subNotificationSchedule = pgTable('sub_notification_schedule', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  eventType: subNotificationEventEnum('event_type').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  processedAt: timestamp('processed_at'),
  status: subNotificationStatusEnum('status').default('pending').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  snsOrgIdx: index('idx_sns_org').on(table.orgId),
  snsScheduledIdx: index('idx_sns_scheduled').on(table.scheduledAt, table.status),
  snsEventIdx: index('idx_sns_event').on(table.eventType),
}));

// ========== Dunning Runs ==========

export const dunningRuns = pgTable('dunning_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  orgId: uuid('org_id').notNull(),
  stage: text('stage').default('warning').notNull(),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  notifiedAt: timestamp('notified_at'),
  response: text('response'),
  metadata: jsonb('metadata').default({}),
}, (table) => ({
  idxDrSub: index('idx_dr_sub').on(table.subscriptionId),
  idxDrStage: index('idx_dr_stage').on(table.stage),
}));

// ========== Support Tickets ==========

export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  userId: uuid('user_id').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  category: text('category').default('general').notNull(),
  priority: text('priority').default('normal').notNull(),
  status: text('status').default('open').notNull(),
  assignedTo: uuid('assigned_to'),
  resolution: text('resolution'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxStOrg: index('idx_st_org').on(table.orgId),
  idxStStatus: index('idx_st_status').on(table.status),
  idxStAssigned: index('idx_st_assigned').on(table.assignedTo),
}));

// ========== Ticket Messages ==========

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => supportTickets.id).notNull(),
  userId: uuid('user_id').notNull(),
  message: text('message').notNull(),
  isInternal: boolean('is_internal').default(false).notNull(),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxTmTicket: index('idx_tm_ticket').on(table.ticketId),
}));

// ========== Announcements ==========

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').default('info').notNull(),
  isGlobal: boolean('is_global').default(false).notNull(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  endsAt: timestamp('ends_at'),
  isDismissable: boolean('is_dismissable').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxAnnOrg: index('idx_ann_org').on(table.orgId),
  idxAnnActive: index('idx_ann_active').on(table.startsAt, table.endsAt),
}));

// ========== Rate Limit Configs ==========

export const rateLimitConfigs = pgTable('rate_limit_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id'),
  endpoint: text('endpoint').notNull(),
  method: text('method').default('ALL').notNull(),
  maxRequests: integer('max_requests').default(100).notNull(),
  windowMs: integer('window_ms').default(60000).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxRlcEndpoint: index('idx_rlc_endpoint').on(table.endpoint),
  idxRlcOrgEndpoint: uniqueIndex('idx_rlc_org_endpoint').on(table.orgId, table.endpoint),
}));

// ========== Feature Rollouts ==========

export const featureRollouts = pgTable('feature_rollouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  featureKey: text('feature_key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  rolloutPercent: integer('rollout_percent').default(0).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  allowlistOrgIds: text('allowlist_org_ids').array().default([]),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxFrKey: index('idx_fr_key').on(table.featureKey),
  idxFrActive: index('idx_fr_active').on(table.isActive),
}));

// ========== Feature Rollout Events ==========

export const featureRolloutEvents = pgTable('feature_rollout_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  rolloutId: uuid('rollout_id').references(() => featureRollouts.id).notNull(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id'),
  event: text('event').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxFreRollout: index('idx_fre_rollout').on(table.rolloutId),
  idxFreOrg: index('idx_fre_org').on(table.orgId),
}));

// ========== Platform Auth ==========

export const platformUsers = pgTable('platform_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  fullName: text('full_name'),
  role: platformRoleEnum('role').default('super_admin').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  avatarUrl: text('avatar_url'),
  preferences: jsonb('preferences').default({}),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const platformSessions = pgTable('platform_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  platformUserId: uuid('platform_user_id').references(() => platformUsers.id).notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ========== Role Permissions ==========

export const platformRolePermissions = pgTable('platform_role_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: text('role').notNull().unique(),
  permissions: text('permissions').array().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

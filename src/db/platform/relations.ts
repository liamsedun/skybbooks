import { relations } from 'drizzle-orm';
import {
  featureFlags,
  planFeatureFlags,
  orgFeatureFlags,
  userFeatureFlags,
  subscriptionPlans,
  subscriptions,
  subscriptionStatusHistory,
  coupons,
  promotions,
  promotionalCampaigns,
  referralCodes,
  partnerDiscounts,
  redemptionHistory,
  subscriptionInvoices,
  paymentGatewayConfigs,
  subscriptionPayments,
  paymentReceipts,
  subscriptionUsage,
  subscriptionFeatureOverrides,
  platformUsers,
  platformSessions,
} from './tables';

export const featureFlagsRelations = relations(featureFlags, ({ many }) => ({
  planFlags: many(planFeatureFlags),
  orgFlags: many(orgFeatureFlags),
  userFlags: many(userFeatureFlags),
}));

export const planFeatureFlagsRelations = relations(planFeatureFlags, ({ one }) => ({
  plan: one(subscriptionPlans, { fields: [planFeatureFlags.planId], references: [subscriptionPlans.id] }),
}));

export const orgFeatureFlagsRelations = relations(orgFeatureFlags, ({ one }) => ({}));

export const userFeatureFlagsRelations = relations(userFeatureFlags, ({ one }) => ({}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(subscriptions),
  featureOverrides: many(subscriptionFeatureOverrides),
  planFeatureFlags: many(planFeatureFlags),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  plan: one(subscriptionPlans, { fields: [subscriptions.planId], references: [subscriptionPlans.id] }),
  coupon: one(coupons, { fields: [subscriptions.couponId], references: [coupons.id] }),
  promotion: one(promotions, { fields: [subscriptions.promotionId], references: [promotions.id] }),
  invoices: many(subscriptionInvoices),
  usage: many(subscriptionUsage),
  featureOverrides: many(subscriptionFeatureOverrides),
  statusHistory: many(subscriptionStatusHistory),
  payments: many(subscriptionPayments),
}));

export const subscriptionStatusHistoryRelations = relations(subscriptionStatusHistory, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionStatusHistory.subscriptionId], references: [subscriptions.id] }),
}));

export const couponsRelations = relations(coupons, ({ one }) => ({
  campaign: one(promotionalCampaigns, { fields: [coupons.campaignId], references: [promotionalCampaigns.id] }),
  minPlan: one(subscriptionPlans, { fields: [coupons.minPlanId], references: [subscriptionPlans.id] }),
  maxPlan: one(subscriptionPlans, { fields: [coupons.maxPlanId], references: [subscriptionPlans.id] }),
}));

export const promotionsRelations = relations(promotions, ({ one }) => ({
  campaign: one(promotionalCampaigns, { fields: [promotions.campaignId], references: [promotionalCampaigns.id] }),
  minPlan: one(subscriptionPlans, { fields: [promotions.minPlanId], references: [subscriptionPlans.id] }),
  maxPlan: one(subscriptionPlans, { fields: [promotions.maxPlanId], references: [subscriptionPlans.id] }),
}));

export const promotionalCampaignsRelations = relations(promotionalCampaigns, ({ many }) => ({
  coupons: many(coupons),
  promotions: many(promotions),
}));

export const referralCodesRelations = relations(referralCodes, ({ one }) => ({}));

export const partnerDiscountsRelations = relations(partnerDiscounts, ({ one }) => ({}));

export const redemptionHistoryRelations = relations(redemptionHistory, ({ one }) => ({
  subscription: one(subscriptions, { fields: [redemptionHistory.subscriptionId], references: [subscriptions.id] }),
  invoice: one(subscriptionInvoices, { fields: [redemptionHistory.invoiceId], references: [subscriptionInvoices.id] }),
}));

export const subscriptionInvoicesRelations = relations(subscriptionInvoices, ({ one, many }) => ({
  subscription: one(subscriptions, { fields: [subscriptionInvoices.subscriptionId], references: [subscriptions.id] }),
  coupon: one(coupons, { fields: [subscriptionInvoices.couponId], references: [coupons.id] }),
  promotion: one(promotions, { fields: [subscriptionInvoices.promotionId], references: [promotions.id] }),
  payments: many(subscriptionPayments),
  receipts: many(paymentReceipts),
}));

export const paymentGatewayConfigsRelations = relations(paymentGatewayConfigs, ({ one }) => ({}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one, many }) => ({
  subscription: one(subscriptions, { fields: [subscriptionPayments.subscriptionId], references: [subscriptions.id] }),
  invoice: one(subscriptionInvoices, { fields: [subscriptionPayments.invoiceId], references: [subscriptionInvoices.id] }),
  receipts: many(paymentReceipts),
}));

export const paymentReceiptsRelations = relations(paymentReceipts, ({ one }) => ({
  payment: one(subscriptionPayments, { fields: [paymentReceipts.paymentId], references: [subscriptionPayments.id] }),
  invoice: one(subscriptionInvoices, { fields: [paymentReceipts.invoiceId], references: [subscriptionInvoices.id] }),
}));

export const subscriptionUsageRelations = relations(subscriptionUsage, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionUsage.subscriptionId], references: [subscriptions.id] }),
}));

export const subscriptionFeatureOverridesRelations = relations(subscriptionFeatureOverrides, ({ one }) => ({
  plan: one(subscriptionPlans, { fields: [subscriptionFeatureOverrides.planId], references: [subscriptionPlans.id] }),
  subscription: one(subscriptions, { fields: [subscriptionFeatureOverrides.subscriptionId], references: [subscriptions.id] }),
}));

export const platformUsersRelations = relations(platformUsers, ({ many }) => ({
  sessions: many(platformSessions),
}));

export const platformSessionsRelations = relations(platformSessions, ({ one }) => ({
  platformUser: one(platformUsers, {
    fields: [platformSessions.platformUserId],
    references: [platformUsers.id]
  })
}));

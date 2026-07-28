/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pgEnum } from 'drizzle-orm/pg-core';

// ==========================================
// 1. ENUMS DEFINITIONS
// ==========================================

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'accountant', 'staff', 'administrator', 'manager', 'sales', 'inventory', 'cashier', 'auditor', 'hr', 'purchasing']);

export const platformRoleEnum = pgEnum('platform_role', [
  'super_admin', 'ceo', 'director', 'finance', 'support',
  'marketing', 'developer', 'sales', 'customer_success',
  'operations', 'infrastructure',
]);

export const accountTypeEnum = pgEnum('account_type', [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
]);

export const journalSourceEnum = pgEnum('journal_source', [
  'manual',
  'invoice',
  'bill',
  'payment',
  'payroll',
  'bank_feed',
  'opening_balance',
  'opening_stock',
  'transfer',
  'vat_settlement',
  'tax_provision',
  'inventory_adjustment',
  'loan',
  'owner_capital',
  'owner_drawings',
  'revenue_recognition',
  'lease',
  'ecl_provision',
  'fixed_asset',
  'subscription'
]);

export const journalStatusEnum = pgEnum('journal_status', [
  'draft',
  'pending_review',
  'approved',
  'posted',
  'locked',
  'reversed',
  'cancelled'
]);

export const contactTypeEnum = pgEnum('contact_type', ['customer', 'vendor', 'both']);

export const vatTreatmentEnum = pgEnum('vat_treatment', [
  'standard',
  'zero_rated',
  'exempt',
  'blocked',
  'reverse_charge',
  'outside_scope',
  'system',
]);

export const vatPeriodStatusEnum = pgEnum('vat_period_status', [
  'draft',
  'reviewed',
  'filed',
  'paid',
]);

export const vatReturnLineTypeEnum = pgEnum('vat_return_line_type', [
  'output',
  'input',
  'adjustment',
]);

export const systemAccountRoleEnum = pgEnum('system_account_role', [
  'accounts_receivable',
  'accounts_payable',
  'vat_payable',
  'vat_receivable',
  'retained_earnings',
  'cogs',
  'inventory',
  'bank',
  'payroll_clearing',
  'paye_payable',
  'pension_payable',
  'wht_receivable',
  'wht_payable',
  'none',
  'allowance_for_doubtful_debts',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', ['free_trial', 'active', 'grace_period', 'suspended', 'expired', 'cancelled', 'pending_payment', 'failed_payment', 'renewing', 'downgraded', 'upgraded', 'paused']);
export const billingCycleEnum = pgEnum('billing_cycle', ['monthly', 'yearly', 'quarterly']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed_amount', 'free_months', 'referral_reward', 'partner_commission']);
export const promoCampaignStatusEnum = pgEnum('promo_campaign_status', ['draft', 'active', 'paused', 'completed', 'cancelled']);
export const referralRewardTypeEnum = pgEnum('referral_reward_type', ['percentage', 'fixed_amount', 'free_months']);
export const subInvoiceStatusEnum = pgEnum('sub_invoice_status', ['pending', 'paid', 'overdue', 'canceled', 'refunded']);
export const subPaymentMethodEnum = pgEnum('sub_payment_method', ['card', 'bank_transfer', 'ussd', 'wallet', 'unknown']);
export const subPaymentStatusEnum = pgEnum('sub_payment_status', ['pending', 'success', 'failed', 'refunded', 'partial_refund', 'cancelled']);

export const bankFeedProviderEnum = pgEnum('bank_feed_provider', ['mono', 'paystack', 'flutterwave', 'moniepoint']);
export const bankConnectionStatusEnum = pgEnum('bank_connection_status', ['active', 'reauth_required', 'expired', 'disconnected', 'pending']);
export const paymentGatewayEnum = pgEnum('payment_gateway', ['paystack', 'flutterwave', 'moniepoint']);
export const gatewayTxnStatusEnum = pgEnum('gateway_txn_status', ['pending', 'success', 'failed', 'settled', 'partial_refund', 'full_refund']);

export const consolidationMethodEnum = pgEnum('consolidation_method', ['full', 'equity', 'proportionate']);
export const intercompanyTxnTypeEnum = pgEnum('intercompany_txn_type', ['loan', 'goods', 'service', 'royalty', 'dividend', 'management_fee', 'other']);
export const intercompanyTxnStatusEnum = pgEnum('intercompany_txn_status', ['pending', 'matched', 'settled', 'eliminated']);
export const eliminationMethodEnum = pgEnum('elimination_method', ['auto', 'manual']);

export const itemTypeEnum = pgEnum('item_type', ['product', 'service']);

export const inventoryTxnTypeEnum = pgEnum('inventory_txn_type', [
  'purchase',
  'sale',
  'adjustment',
  'transfer'
]);

export const adjustmentModeEnum = pgEnum('adjustment_mode', ['quantity', 'value']);
export const adjustmentStatusEnum = pgEnum('adjustment_status', ['draft', 'pending_review', 'approved', 'posted', 'adjusted']);

export const costingMethodEnum = pgEnum('costing_method', ['fifo', 'weighted_average', 'specific_identification']);

export const stockCountStatusEnum = pgEnum('stock_count_status', ['draft', 'completed']);
export const writeoffStatusEnum = pgEnum('writeoff_status', ['draft', 'posted']);
export const landedCostStatusEnum = pgEnum('landed_cost_status', ['draft', 'allocated']);
export const landedCostAllocMethodEnum = pgEnum('landed_cost_alloc_method', ['by_value', 'by_quantity', 'by_weight', 'by_volume']);

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'converted'
]);

export const soStatusEnum = pgEnum('so_status', [
  'draft',
  'confirmed',
  'partial',
  'fulfilled',
  'cancelled'
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'void'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'bank_transfer',
  'card',
  'cheque',
  'pos',
  'ussd'
]);

export const paymentCategoryEnum = pgEnum('payment_category', [
  'sales_invoice',
  'other_income'
]);

export const creditNoteStatusEnum = pgEnum('credit_note_status', [
  'draft',
  'issued',
  'applied',
  'void'
]);

export const recurringFrequencyEnum = pgEnum('recurring_frequency', [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually'
]);

export const poStatusEnum = pgEnum('po_status', [
  'draft',
  'confirmed',
  'accepted',
  'approved',
  'sent',
  'partial',
  'received',
  'cancelled'
]);

export const billStatusEnum = pgEnum('bill_status', [
  'draft',
  'open',
  'partial',
  'paid',
  'overdue',
  'void'
]);

export const bankTxnTypeEnum = pgEnum('bank_txn_type', ['debit', 'credit']);

export const bankTxnStatusEnum = pgEnum('bank_txn_status', [
  'unreconciled',
  'reconciled',
  'excluded'
]);

export const paymentFrequencyEnum = pgEnum('payment_frequency', [
  'monthly',
  'weekly',
  'biweekly',
  'quarterly',
  'semi_annual',
  'annual'
]);

export const payrollRunStatusEnum = pgEnum('payroll_run_status', [
  'draft',
  'approved',
  'paid'
]);

export const depreciationMethodEnum = pgEnum('depreciation_method', [
  'straight_line',
  'declining_balance',
  'no_depreciation'
]);

export const fixedAssetStatusEnum = pgEnum('fixed_asset_status', [
  'active',
  'disposed',
  'fully_depreciated',
  'cwip'
]);

export const budgetPeriodEnum = pgEnum('budget_period', [
  'monthly',
  'quarterly',
  'annual'
]);

export const budgetStatusEnum = pgEnum('budget_status', [
  'draft',
  'active',
  'archived'
]);

export const taxSizeClassEnum = pgEnum('tax_size_class', [
  'small',
  'medium',
  'large'
]);

export const capitalAllowanceClassEnum = pgEnum('capital_allowance_class', [
  'industrial_building',
  'non_industrial_building',
  'plant_machinery_general',
  'plant_machinery_agric',
  'motor_vehicle',
  'furniture_fittings',
  'computer_it_equipment',
  'intangible_asset'
]);

export const taxLossStatusEnum = pgEnum('tax_loss_status', [
  'available',
  'utilised',
  'expired'
]);

export const taxComputationStatusEnum = pgEnum('tax_computation_status', [
  'draft',
  'submitted',
  'assessed'
]);

export const approvalModuleEnum = pgEnum('approval_module', [
  'bills', 'expenses', 'journals', 'payments_received', 'payments_made',
  'purchase_orders', 'fixed_assets', 'inventory_adjustments'
]);

export const expenseStatusEnum = pgEnum('expense_status', [
  'draft', 'pending_review', 'approved', 'posted', 'void'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'draft', 'pending_review', 'approved', 'posted', 'void'
]);

export const subNotificationEventEnum = pgEnum('sub_notification_event', [
  'trial_started', 'trial_ending', 'subscription_activated',
  'payment_successful', 'payment_failed',
  'renewal_reminder', 'subscription_expired',
  'plan_upgraded', 'plan_downgraded',
  'coupon_applied', 'storage_limit_reached',
  'user_limit_reached', 'feature_limit_reached',
]);

export const subNotificationChannelEnum = pgEnum('sub_notification_channel', [
  'email', 'in_app', 'sms', 'whatsapp',
]);

export const subNotificationStatusEnum = pgEnum('sub_notification_status', [
  'pending', 'sent', 'failed', 'scheduled',
]);

export const vendorCreditStatusEnum = pgEnum('vendor_credit_status', [
  'issued',
  'applied',
  'void'
]);

export const payePeriodStatusEnum = pgEnum('paye_period_status', ['draft', 'computed', 'posted', 'remitted']);

export const itfStatusEnum = pgEnum('itf_status', ['pending', 'paid', 'waived']);

export const taxExemptionStatusEnum = pgEnum('tax_exemption_status', ['active', 'expired', 'revoked']);
export const taxTypeEnum = pgEnum('tax_type_enum', ['vat', 'wht', 'cit', 'paye', 'itf', 'cgt', 'edt', 'stamp_duty', 'nhf', 'nsitf', 'all']);

export const firsReportStatusEnum = pgEnum('firs_report_status', ['draft', 'filed', 'assessed', 'paid']);
export const firsReportTypeEnum = pgEnum('firs_report_type', ['vat', 'wht', 'cit', 'paye', 'itf', 'nsitf', 'nhf', 'cgt', 'edt', 'stamp_duty', 'consolidated']);

export const ocrDocTypeEnum = pgEnum('ocr_doc_type', ['invoice', 'bill', 'receipt', 'purchase_order']);
export const ocrDocStatusEnum = pgEnum('ocr_doc_status', ['pending', 'extracting', 'ready', 'posted', 'error']);

export const contractStatusEnum = pgEnum('contract_status', [
  'draft', 'active', 'completed', 'terminated', 'on_hold',
]);

export const obligationTimingEnum = pgEnum('obligation_timing', [
  'point_in_time', 'over_time',
]);

export const recognitionMethodEnum = pgEnum('recognition_method', [
  'straight_line', 'milestone', 'percentage_of_completion',
]);

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'pending', 'recognized', 'skipped',
]);

export const leaseStatusEnum = pgEnum('lease_status', [
  'draft', 'active', 'modified', 'terminated', 'expired',
]);

export const featureFlagStateEnum = pgEnum('feature_flag_state', ['enabled', 'disabled', 'limited', 'unlimited']);

export const regionPricingEnum = pgEnum('region', ['ng', 'gh', 'ke', 'za', 'rw', 'tz', 'ug', 'zm', 'other']);

// --- CRM Enums ---

export const crmActivityTypeEnum = pgEnum('crm_activity_type', ['call', 'meeting', 'email', 'task', 'note']);
export const crmActivityStatusEnum = pgEnum('crm_activity_status', ['pending', 'completed']);
export const crmDealStatusEnum = pgEnum('crm_deal_status', ['open', 'won', 'lost']);
export const crmDealSourceEnum = pgEnum('crm_deal_source', ['referral', 'website', 'cold_call', 'social_media', 'email_campaign', 'walk_in', 'partner', 'other']);

// --- HRM Enums ---

export const hrGenderEnum = pgEnum('hr_gender', ['male', 'female', 'other']);
export const hrMaritalStatusEnum = pgEnum('hr_marital_status', ['single', 'married', 'divorced', 'widowed']);
export const hrEmploymentStatusEnum = pgEnum('hr_employment_status', ['active', 'suspended', 'terminated', 'resigned', 'retired']);
export const hrContractTypeEnum = pgEnum('hr_contract_type', ['permanent', 'contract', 'internship', 'temporary', 'probation']);
export const hrLeaveStatusEnum = pgEnum('hr_leave_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const hrAttendanceStatusEnum = pgEnum('hr_attendance_status', ['present', 'absent', 'late', 'half_day', 'on_leave']);
export const hrShiftTypeEnum = pgEnum('hr_shift_type', ['morning', 'afternoon', 'night', 'general']);
export const hrReviewStatusEnum = pgEnum('hr_review_status', ['draft', 'pending_review', 'completed', 'cancelled']);
export const hrApplicationStatusEnum = pgEnum('hr_application_status', ['new', 'screened', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn']);
export const hrJobStatusEnum = pgEnum('hr_job_status', ['draft', 'open', 'paused', 'filled', 'closed']);
export const hrTravelStatusEnum = pgEnum('hr_travel_status', ['draft', 'submitted', 'approved', 'declined', 'cancelled', 'completed']);
export const hrExpenseStatusEnum = pgEnum('hr_expense_status', ['draft', 'submitted', 'approved', 'reimbursed', 'declined']);
export const hrPriorityEnum = pgEnum('hr_priority', ['low', 'medium', 'high', 'urgent']);
export const hrApprovalStatusEnum = pgEnum('hr_approval_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const hrTicketStatusEnum = pgEnum('hr_ticket_status', ['open', 'in_progress', 'resolved', 'closed']);
export const hrSurveyStatusEnum = pgEnum('hr_survey_status', ['draft', 'active', 'closed']);
export const hrOkrTypeEnum = pgEnum('hr_okr_type', ['committed', 'aspirational']);
export const hrReviewTypeEnum = pgEnum('hr_review_type', ['self', 'manager', 'peer', '360']);
export const hrKpiFrequencyEnum = pgEnum('hr_kpi_frequency', ['weekly', 'monthly', 'quarterly', 'yearly']);
export const hrDevPlanStatusEnum = pgEnum('hr_dev_plan_status', ['not_started', 'in_progress', 'completed', 'cancelled']);
export const hrPromotionStatusEnum = pgEnum('hr_promotion_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const hrCourseLevelEnum = pgEnum('hr_course_level', ['beginner', 'intermediate', 'advanced']);
export const hrCourseStatusEnum = pgEnum('hr_course_status', ['draft', 'published', 'archived']);
export const hrLetterTypeEnum = pgEnum('hr_letter_type', ['offer_letter', 'appointment', 'confirmation', 'warning', 'termination', 'promotion', 'transfer', 'resignation_acceptance', 'experience', 'other']);
export const hrAdvanceStatusEnum = pgEnum('hr_advance_status', ['pending', 'approved', 'disbursed', 'settled', 'cancelled']);
export const hrDocStatusEnum = pgEnum('hr_doc_status', ['draft', 'active', 'archived', 'expired']);
export const hrDocAccessLevelEnum = pgEnum('hr_doc_access_level', ['public', 'restricted', 'confidential']);
export const hrDocPermissionEnum = pgEnum('hr_doc_permission', ['view', 'download', 'edit', 'admin']);
export const hrDocLinkTypeEnum = pgEnum('hr_doc_link_type', ['onboarding', 'contract', 'id', 'payroll', 'training', 'performance', 'other']);
export const hrSettlementStatusEnum = pgEnum('hr_settlement_status', ['pending', 'partial', 'settled', 'disputed']);
export const hrApprovalStepStatusEnum = pgEnum('hr_approval_step_status', ['pending', 'in_progress', 'approved', 'rejected', 'sent_back', 'escalated', 'skipped']);
export const hrWorkflowStatusEnum = pgEnum('hr_workflow_status', ['pending', 'running', 'completed', 'failed', 'cancelled']);

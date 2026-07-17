/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
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
  type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

// ==========================================
// 1. ENUMS DEFINITIONS (at the top of file)
// ==========================================

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'accountant', 'staff']);

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
  'fixed_asset'
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

export const bankFeedProviderEnum = pgEnum('bank_feed_provider', ['mono', 'paystack', 'flutterwave', 'moniepoint']);
export const bankConnectionStatusEnum = pgEnum('bank_connection_status', ['active', 'reauth_required', 'expired', 'disconnected', 'pending']);
export const paymentGatewayEnum = pgEnum('payment_gateway', ['paystack', 'flutterwave', 'moniepoint']);
export const gatewayTxnStatusEnum = pgEnum('gateway_txn_status', ['pending', 'success', 'failed', 'settled', 'partial_refund', 'full_refund']);

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

// ==========================================
// 2. SCHEMA TABLES DEFINITIONS
// ==========================================

// --- Core Auth ---

export const organisations = pgTable('organisations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  logoUrl: text('logo_url'),
  baseCurrency: text('base_currency').default('NGN').notNull(),
  fiscalYearStart: text('fiscal_year_start'),
  liveGlStartFiscalYear: integer('live_gl_start_fiscal_year'),
  legacySystemName: text('legacy_system_name'),
  vatNumber: text('vat_number'),
  rcNumber: text('rc_number'),
  website: text('website'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  fullName: text('full_name'),
  role: userRoleEnum('role').default('staff').notNull(),
  organisationId: uuid('organisation_id').references(() => organisations.id),
  isActive: boolean('is_active').default(true).notNull(),
  avatarUrl: text('avatar_url'),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Chart of Accounts (double-entry) ---

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  subType: text('sub_type'),
  parentId: uuid('parent_id').references((): AnyPgColumn => accounts.id),
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description'),
  openingBalance: bigint('opening_balance', { mode: 'number' }).default(0).notNull(),
  systemAccountRole: systemAccountRoleEnum('system_account_role').default('none').notNull(),
  vatTreatment: vatTreatmentEnum('vat_treatment').default('standard').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  entryNumber: text('entry_number').notNull(),
  date: timestamp('date').notNull(),
  description: text('description'),
  reference: text('reference'),
  source: journalSourceEnum('source').default('manual').notNull(),
  sourceId: uuid('source_id'),
  projectId: uuid('project_id').references(() => projects.id),
  status: journalStatusEnum('status').default('posted').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  lockedBy: uuid('locked_by').references(() => users.id),
  cancelledBy: uuid('cancelled_by').references(() => users.id),
  isReversed: boolean('is_reversed').default(false).notNull(),
  reversedById: uuid('reversed_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const journalLines = pgTable('journal_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  entryId: uuid('entry_id').references(() => journalEntries.id).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  debitAmount: bigint('debit_amount', { mode: 'number' }).default(0).notNull(),
  creditAmount: bigint('credit_amount', { mode: 'number' }).default(0).notNull(),
  description: text('description'),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  vatAmount: bigint('vat_amount', { mode: 'number' }).default(0),
  vatTreatment: vatTreatmentEnum('vat_treatment'),
  vatAccountId: uuid('vat_account_id').references(() => accounts.id),
  supplierVatNumber: text('supplier_vat_number'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Contacts ---

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  type: contactTypeEnum('type').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  country: text('country').default('Nigeria').notNull(),
  taxPin: text('tax_pin'),
  paymentTerms: integer('payment_terms'),
  creditLimit: bigint('credit_limit', { mode: 'number' }),
  balance: bigint('balance', { mode: 'number' }).default(0).notNull(),
  currency: text('currency').default('NGN').notNull(),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  customerCode: text('customer_code'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Items & Inventory ---

export const items = pgTable('items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  sku: text('sku'),
  name: text('name').notNull(),
  description: text('description'),
  type: itemTypeEnum('type').notNull(),
  unit: text('unit'),
  salesPrice: bigint('sales_price', { mode: 'number' }),
  purchasePrice: bigint('purchase_price', { mode: 'number' }),
  salesAccountId: uuid('sales_account_id').references(() => accounts.id),
  purchaseAccountId: uuid('purchase_account_id').references(() => accounts.id),
  inventoryAccountId: uuid('inventory_account_id').references(() => accounts.id),
  cogsAccountId: uuid('cogs_account_id').references(() => accounts.id),
  costingMethod: costingMethodEnum('costing_method').default('fifo').notNull(),
  averageCost: bigint('average_cost', { mode: 'number' }),
  lastPurchasePrice: bigint('last_purchase_price', { mode: 'number' }),
  trackInventory: boolean('track_inventory').default(false).notNull(),
  reorderPoint: integer('reorder_point'),
  reorderQuantity: integer('reorder_quantity'),
  minStockLevel: integer('min_stock_level'),
  maxStockLevel: integer('max_stock_level'),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const inventoryLots = pgTable('inventory_lots', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  quantity: numeric('quantity').notNull(),
  costPerUnit: bigint('cost_per_unit', { mode: 'number' }).notNull(),
  receivedDate: timestamp('received_date').notNull(),
  expiryDate: timestamp('expiry_date'),
  reference: text('reference'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  lotId: uuid('lot_id').references(() => inventoryLots.id),
  type: inventoryTxnTypeEnum('type').notNull(),
  quantity: numeric('quantity').notNull(),
  unitCost: bigint('unit_cost', { mode: 'number' }),
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  date: timestamp('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const inventoryAdjustments = pgTable('inventory_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reference: text('reference').notNull(),
  date: timestamp('date').notNull(),
  mode: adjustmentModeEnum('mode').notNull(),
  accountId: uuid('account_id').references(() => accounts.id),
  reason: text('reason'),
  location: text('location'),
  description: text('description'),
  status: adjustmentStatusEnum('status').default('draft').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const inventoryAdjustmentItems = pgTable('inventory_adjustment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  adjustmentId: uuid('adjustment_id').references(() => inventoryAdjustments.id).notNull(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  quantityAvailable: numeric('quantity_available').notNull(),
  newQuantity: numeric('new_quantity').notNull(),
  quantityAdjusted: numeric('quantity_adjusted').notNull(),
  currentUnitCost: bigint('current_unit_cost', { mode: 'number' }),
  newUnitCost: bigint('new_unit_cost', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const inventoryTransfers = pgTable('inventory_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reference: text('reference').notNull(),
  date: timestamp('date').notNull(),
  fromLocation: text('from_location').notNull(),
  toLocation: text('to_location').notNull(),
  description: text('description'),
  transferCost: bigint('transfer_cost', { mode: 'number' }).default(0).notNull(),
  status: text('status').default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const inventoryTransferItems = pgTable('inventory_transfer_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  transferId: uuid('transfer_id').references(() => inventoryTransfers.id).notNull(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  lotId: uuid('lot_id').references(() => inventoryLots.id),
  quantity: numeric('quantity').notNull(),
  unitCost: bigint('unit_cost', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const inventoryStockCounts = pgTable('inventory_stock_counts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reference: text('reference').notNull(),
  date: timestamp('date').notNull(),
  location: text('location'),
  description: text('description'),
  status: stockCountStatusEnum('status').default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const inventoryStockCountItems = pgTable('inventory_stock_count_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  countId: uuid('count_id').references(() => inventoryStockCounts.id).notNull(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  lotId: uuid('lot_id').references(() => inventoryLots.id),
  expectedQuantity: numeric('expected_quantity').notNull(),
  actualQuantity: numeric('actual_quantity').notNull(),
  variance: numeric('variance').notNull(),
  unitCost: bigint('unit_cost', { mode: 'number' }),
  varianceValue: bigint('variance_value', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const inventoryWriteoffs = pgTable('inventory_writeoffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reference: text('reference').notNull(),
  date: timestamp('date').notNull(),
  reason: text('reason').notNull(),
  description: text('description'),
  location: text('location'),
  accountId: uuid('account_id').references(() => accounts.id),
  status: writeoffStatusEnum('status').default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const inventoryWriteoffItems = pgTable('inventory_writeoff_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  writeoffId: uuid('writeoff_id').references(() => inventoryWriteoffs.id).notNull(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  lotId: uuid('lot_id').references(() => inventoryLots.id),
  quantity: numeric('quantity').notNull(),
  unitCost: bigint('unit_cost', { mode: 'number' }),
  totalCost: bigint('total_cost', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const landedCosts = pgTable('landed_costs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reference: text('reference').notNull(),
  date: timestamp('date').notNull(),
  vendor: text('vendor'),
  description: text('description'),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
  allocationMethod: landedCostAllocMethodEnum('allocation_method').default('by_value').notNull(),
  billId: uuid('bill_id').references(() => bills.id),
  status: landedCostStatusEnum('status').default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const landedCostAllocations = pgTable('landed_cost_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  landedCostId: uuid('landed_cost_id').references(() => landedCosts.id).notNull(),
  itemId: uuid('item_id').references(() => items.id).notNull(),
  billLineId: uuid('bill_line_id').references(() => billLines.id),
  lotId: uuid('lot_id').references(() => inventoryLots.id),
  allocatedAmount: bigint('allocated_amount', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Sales ---

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  quoteNumber: text('quote_number').notNull(),
  customerId: uuid('customer_id').references(() => contacts.id).notNull(),
  date: timestamp('date').notNull(),
  expiryDate: timestamp('expiry_date'),
  status: quoteStatusEnum('status').notNull(),
  currency: text('currency').default('NGN').notNull(),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  discount: bigint('discount', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  notes: text('notes'),
  terms: text('terms'),
  lines: jsonb('lines').default([]),
  convertedToId: uuid('converted_to_id'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  soNumber: text('so_number').notNull(),
  customerId: uuid('customer_id').references(() => contacts.id).notNull(),
  quoteId: uuid('quote_id').references(() => quotes.id),
  date: timestamp('date').notNull(),
  expectedDelivery: timestamp('expected_delivery'),
  status: soStatusEnum('status').notNull(),
  currency: text('currency').default('NGN').notNull(),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  discount: bigint('discount', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  notes: text('notes'),
  lines: jsonb('lines').default([]),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const recurringInvoices = pgTable('recurring_invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  customerId: uuid('customer_id').references(() => contacts.id).notNull(),
  frequency: recurringFrequencyEnum('frequency').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  nextRunDate: timestamp('next_run_date'),
  isActive: boolean('is_active').default(true).notNull(),
  template: jsonb('template'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  customerId: uuid('customer_id').references(() => contacts.id).notNull(),
  soId: uuid('so_id').references(() => salesOrders.id),
  date: timestamp('date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: invoiceStatusEnum('status').notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  discountAmount: bigint('discount_amount', { mode: 'number' }).default(0).notNull(),
  taxAmount: bigint('tax_amount', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  whtRate: numeric('wht_rate'),
  whtAmount: bigint('wht_amount', { mode: 'number' }).default(0).notNull(),
  amountPaid: bigint('amount_paid', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).default(0).notNull(),
  paymentTerms: integer('payment_terms'),
  notes: text('notes'),
  terms: text('terms'),
  projectId: uuid('project_id').references(() => projects.id),
  recurringId: uuid('recurring_id').references((): AnyPgColumn => recurringInvoices.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  itemId: uuid('item_id').references(() => items.id),
  description: text('description'),
  quantity: numeric('quantity').notNull(),
  unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
  discountPct: numeric('discount_pct'),
  taxRate: numeric('tax_rate'),
  taxAmount: bigint('tax_amount', { mode: 'number' }).default(0).notNull(),
  vatTreatment: text('vat_treatment').default('standard'),
  lineTotal: bigint('line_total', { mode: 'number' }).default(0).notNull(),
  accountId: uuid('account_id').references(() => accounts.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const paymentsReceived = pgTable('payments_received', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  paymentNumber: text('payment_number').notNull(),
  category: paymentCategoryEnum('category').default('sales_invoice').notNull(),
  customerId: uuid('customer_id').references(() => contacts.id),
  payerName: text('payer_name'),
  date: timestamp('date').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  reference: text('reference'),
  projectId: uuid('project_id').references(() => projects.id),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  incomeAccountId: uuid('income_account_id').references(() => accounts.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  status: paymentStatusEnum('status').default('posted').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const paymentAllocations = pgTable('payment_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentId: uuid('payment_id').references(() => paymentsReceived.id).notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const creditNotes = pgTable('credit_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  cnNumber: text('cn_number').notNull(),
  customerId: uuid('customer_id').references(() => contacts.id).notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  date: timestamp('date').notNull(),
  status: creditNoteStatusEnum('status').notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  remainingCredit: bigint('remaining_credit', { mode: 'number' }).default(0).notNull(),
  notes: text('notes'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Purchases ---

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  poNumber: text('po_number').notNull(),
  vendorId: uuid('vendor_id').references(() => contacts.id).notNull(),
  date: timestamp('date').notNull(),
  expectedDate: timestamp('expected_date'),
  status: poStatusEnum('status').notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  notes: text('notes'),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const bills = pgTable('bills', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  billNumber: text('bill_number').notNull(),
  vendorId: uuid('vendor_id').references(() => contacts.id).notNull(),
  poId: uuid('po_id').references(() => purchaseOrders.id),
  date: timestamp('date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: billStatusEnum('status').notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  taxAmount: bigint('tax_amount', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  whtRate: numeric('wht_rate'),
  whtAmount: bigint('wht_amount', { mode: 'number' }).default(0).notNull(),
  amountPaid: bigint('amount_paid', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const billLines = pgTable('bill_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  billId: uuid('bill_id').references(() => bills.id).notNull(),
  itemId: uuid('item_id').references(() => items.id),
  description: text('description'),
  quantity: numeric('quantity').notNull(),
  unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
  taxRate: numeric('tax_rate'),
  taxAmount: bigint('tax_amount', { mode: 'number' }).default(0).notNull(),
  vatTreatment: text('vat_treatment').default('standard'),
  lineTotal: bigint('line_total', { mode: 'number' }).default(0).notNull(),
  accountId: uuid('account_id').references(() => accounts.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const paymentsMade = pgTable('payments_made', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  paymentNumber: text('payment_number').notNull(),
  vendorId: uuid('vendor_id').references(() => contacts.id).notNull(),
  date: timestamp('date').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  reference: text('reference'),
  projectId: uuid('project_id').references(() => projects.id),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  status: paymentStatusEnum('status').default('posted').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const paymentMadeAllocations = pgTable('payment_made_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentId: uuid('payment_id').references(() => paymentsMade.id).notNull(),
  billId: uuid('bill_id').references(() => bills.id).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const vendorCreditStatusEnum = pgEnum('vendor_credit_status', [
  'issued',
  'applied',
  'void'
]);

export const vendorCredits = pgTable('vendor_credits', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  vcNumber: text('vc_number').notNull(),
  vendorId: uuid('vendor_id').references(() => contacts.id).notNull(),
  billId: uuid('bill_id').references(() => bills.id),
  date: timestamp('date').notNull(),
  status: vendorCreditStatusEnum('status').notNull().default('issued'),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  remainingCredit: bigint('remaining_credit', { mode: 'number' }).default(0).notNull(),
  notes: text('notes'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  expenseNumber: text('expense_number').notNull(),
  vendorId: uuid('vendor_id').references(() => contacts.id),
  date: timestamp('date').notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  taxAmount: bigint('tax_amount', { mode: 'number' }).default(0).notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  reference: text('reference'),
  description: text('description'),
  receiptUrl: text('receipt_url'),
  projectId: uuid('project_id').references(() => projects.id),
  isBillable: boolean('is_billable').default(false).notNull(),
  customerId: uuid('customer_id').references(() => contacts.id),
  recurringId: uuid('recurring_id'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  status: expenseStatusEnum('status').default('posted').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- VAT Periods ---

export const vatPeriods = pgTable('vat_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  periodLabel: text('period_label').notNull(),
  totalOutputVat: bigint('total_output_vat', { mode: 'number' }).default(0).notNull(),
  totalInputVat: bigint('total_input_vat', { mode: 'number' }).default(0).notNull(),
  netVatPayable: bigint('net_vat_payable', { mode: 'number' }).default(0).notNull(),
  excessInputBroughtForward: bigint('excess_input_brought_forward', { mode: 'number' }).default(0).notNull(),
  excessInputCarriedForward: bigint('excess_input_carried_forward', { mode: 'number' }).default(0).notNull(),
  status: vatPeriodStatusEnum('status').default('draft').notNull(),
  settlementJournalEntryId: uuid('settlement_journal_entry_id').references(() => journalEntries.id),
  filedAt: timestamp('filed_at'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const vatReturnLines = pgTable('vat_return_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  vatPeriodId: uuid('vat_period_id').references(() => vatPeriods.id).notNull(),
  lineType: vatReturnLineTypeEnum('line_type').notNull(),
  supplyCategory: text('supply_category').notNull(),
  grossAmount: bigint('gross_amount', { mode: 'number' }).default(0).notNull(),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).default('7.5').notNull(),
  vatAmount: bigint('vat_amount', { mode: 'number' }).default(0).notNull(),
  journalLineIds: uuid('journal_line_ids').array(),
  isRecoverable: boolean('is_recoverable').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Tax Configuration ---

export const taxConfigurations = pgTable('tax_configurations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  taxYear: text('tax_year').notNull(),
  sizeClass: taxSizeClassEnum('size_class'),
  incorporationDate: timestamp('incorporation_date'),
  fiscalYearEnd: text('fiscal_year_end').default('Dec 31').notNull(),
  pioneerStatus: boolean('pioneer_status').default(false).notNull(),
  pioneerStartDate: timestamp('pioneer_start_date'),
  pioneerEndDate: timestamp('pioneer_end_date'),
  minimumTaxExemptReason: text('minimum_tax_exempt_reason'),
  nitdaApplicable: boolean('nitda_applicable').default(false).notNull(),
  pptApplicable: boolean('ppt_applicable').default(false).notNull(),
  exportExemption: boolean('export_exemption').default(false).notNull(),
  agriculturalExemption: boolean('agricultural_exemption').default(false).notNull(),
  foreignEquityExemption: boolean('foreign_equity_exemption').default(false).notNull(),
  firstFourYearsExemption: boolean('first_four_years_exemption').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const taxConfigurationsRelations = relations(taxConfigurations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taxConfigurations.orgId],
    references: [organisations.id]
  })
}));

// --- Capital Allowance Schedule ---

export const capitalAllowanceSchedule = pgTable('capital_allowance_schedule', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  taxYear: text('tax_year').notNull(),
  assetName: text('asset_name').notNull(),
  assetClass: capitalAllowanceClassEnum('asset_class').notNull(),
  costPrice: bigint('cost_price', { mode: 'number' }).default(0).notNull(),
  purchaseDate: timestamp('purchase_date').notNull(),
  initialAllowanceRate: numeric('initial_allowance_rate', { precision: 5, scale: 2 }),
  initialAllowanceAmount: bigint('initial_allowance_amount', { mode: 'number' }).default(0).notNull(),
  openingWDV: bigint('opening_wdv', { mode: 'number' }).default(0).notNull(),
  annualAllowanceRate: numeric('annual_allowance_rate', { precision: 5, scale: 2 }),
  annualAllowanceAmount: bigint('annual_allowance_amount', { mode: 'number' }).default(0).notNull(),
  closingWDV: bigint('closing_wdv', { mode: 'number' }).default(0).notNull(),
  disposalProceeds: bigint('disposal_proceeds', { mode: 'number' }).default(0),
  balancingAllowance: bigint('balancing_allowance', { mode: 'number' }).default(0),
  balancingCharge: bigint('balancing_charge', { mode: 'number' }).default(0),
  isDisposed: boolean('is_disposed').default(false).notNull(),
  disposalDate: timestamp('disposal_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const capitalAllowanceScheduleRelations = relations(capitalAllowanceSchedule, ({ one }) => ({
  organisation: one(organisations, {
    fields: [capitalAllowanceSchedule.orgId],
    references: [organisations.id]
  })
}));

// --- Tax Losses ---

export const taxLosses = pgTable('tax_losses', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  taxYear: text('tax_year').notNull(),
  lossAmount: bigint('loss_amount', { mode: 'number' }).default(0).notNull(),
  utilisedAmount: bigint('utilised_amount', { mode: 'number' }).default(0).notNull(),
  availableAmount: bigint('available_amount', { mode: 'number' }).default(0).notNull(),
  status: taxLossStatusEnum('status').default('available').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const taxLossesRelations = relations(taxLosses, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taxLosses.orgId],
    references: [organisations.id]
  })
}));

// --- Tax Computations ---

export const taxComputations = pgTable('tax_computations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  taxYear: text('tax_year').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  grossTurnover: bigint('gross_turnover', { mode: 'number' }).default(0).notNull(),
  accountingPBT: bigint('accounting_pbt', { mode: 'number' }).default(0).notNull(),
  totalAddbacks: bigint('total_addbacks', { mode: 'number' }).default(0).notNull(),
  totalDeductions: bigint('total_deductions', { mode: 'number' }).default(0).notNull(),
  assessableProfit: bigint('assessable_profit', { mode: 'number' }).default(0).notNull(),
  citRate: numeric('cit_rate', { precision: 5, scale: 2 }).default('0'),
  citFromProfits: bigint('cit_from_profits', { mode: 'number' }).default(0).notNull(),
  minimumTax: bigint('minimum_tax', { mode: 'number' }).default(0).notNull(),
  citPayable: bigint('cit_payable', { mode: 'number' }).default(0).notNull(),
  edtPayable: bigint('edt_payable', { mode: 'number' }).default(0).notNull(),
  cgtPayable: bigint('cgt_payable', { mode: 'number' }).default(0).notNull(),
  nitdaLevy: bigint('nitda_levy', { mode: 'number' }).default(0).notNull(),
  deferredTaxCharge: bigint('deferred_tax_charge', { mode: 'number' }).default(0).notNull(),
  totalTaxExpense: bigint('total_tax_expense', { mode: 'number' }).default(0).notNull(),
  whtCreditsApplied: bigint('wht_credits_applied', { mode: 'number' }).default(0).notNull(),
  netCitPayable: bigint('net_cit_payable', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  status: taxComputationStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const taxComputationsRelations = relations(taxComputations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [taxComputations.orgId],
    references: [organisations.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [taxComputations.journalEntryId],
    references: [journalEntries.id]
  })
}));

// --- PAYE / Statutory Deduction Schedules ---

export const payePeriodStatusEnum = pgEnum('paye_period_status', ['draft', 'computed', 'posted', 'remitted']);

export const payeSchedules = pgTable('paye_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  periodLabel: text('period_label').notNull(),
  totalGrossPay: bigint('total_gross_pay', { mode: 'number' }).default(0).notNull(),
  totalTaxablePay: bigint('total_taxable_pay', { mode: 'number' }).default(0).notNull(),
  totalPaye: bigint('total_paye', { mode: 'number' }).default(0).notNull(),
  totalNhf: bigint('total_nhf', { mode: 'number' }).default(0).notNull(),
  totalNsitf: bigint('total_nsitf', { mode: 'number' }).default(0).notNull(),
  status: payePeriodStatusEnum('status').default('draft').notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const payeSchedulesRelations = relations(payeSchedules, ({ one }) => ({
  organisation: one(organisations, { fields: [payeSchedules.orgId], references: [organisations.id] }),
  journalEntry: one(journalEntries, { fields: [payeSchedules.journalEntryId], references: [journalEntries.id] })
}));

export const payeScheduleLines = pgTable('paye_schedule_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  payeScheduleId: uuid('paye_schedule_id').references(() => payeSchedules.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id),
  grossPay: bigint('gross_pay', { mode: 'number' }).default(0).notNull(),
  consolidatedRelief: bigint('consolidated_relief', { mode: 'number' }).default(0).notNull(),
  taxablePay: bigint('taxable_pay', { mode: 'number' }).default(0).notNull(),
  paye: bigint('paye', { mode: 'number' }).default(0).notNull(),
  nhf: bigint('nhf', { mode: 'number' }).default(0).notNull(),
  nsitf: bigint('nsitf', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- ITF Assessments ---

export const itfStatusEnum = pgEnum('itf_status', ['pending', 'paid', 'waived']);

export const itfAssessments = pgTable('itf_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assessmentYear: text('assessment_year').notNull(),
  totalPayroll: bigint('total_payroll', { mode: 'number' }).default(0).notNull(),
  contributionRate: numeric('contribution_rate', { precision: 5, scale: 2 }).default('0.01').notNull(),
  contributionAmount: bigint('contribution_amount', { mode: 'number' }).default(0).notNull(),
  paidAmount: bigint('paid_amount', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  status: itfStatusEnum('status').default('pending').notNull(),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// --- Stamp Duty Records ---

export const stampDutyRecords = pgTable('stamp_duty_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  transactionType: text('transaction_type').notNull(),
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  grossAmount: bigint('gross_amount', { mode: 'number' }).default(0).notNull(),
  stampDutyAmount: bigint('stamp_duty_amount', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Tax Exemptions ---

export const taxExemptionStatusEnum = pgEnum('tax_exemption_status', ['active', 'expired', 'revoked']);
export const taxTypeEnum = pgEnum('tax_type_enum', ['vat', 'wht', 'cit', 'paye', 'itf', 'cgt', 'edt', 'stamp_duty', 'nhf', 'nsitf', 'all']);

export const taxExemptions = pgTable('tax_exemptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  taxType: taxTypeEnum('tax_type').notNull(),
  exemptionType: text('exemption_type').notNull(),
  referenceNumber: text('reference_number'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  certificateUrl: text('certificate_url'),
  description: text('description'),
  status: taxExemptionStatusEnum('status').default('active').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// --- FIRS Reports ---

export const firsReportStatusEnum = pgEnum('firs_report_status', ['draft', 'filed', 'assessed', 'paid']);
export const firsReportTypeEnum = pgEnum('firs_report_type', ['vat', 'wht', 'cit', 'paye', 'itf', 'nsitf', 'nhf', 'cgt', 'edt', 'stamp_duty', 'consolidated']);

export const firsReports = pgTable('firs_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reportType: firsReportTypeEnum('report_type').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  periodLabel: text('period_label').notNull(),
  taxYear: text('tax_year'),
  totalLiability: bigint('total_liability', { mode: 'number' }).default(0).notNull(),
  totalPaid: bigint('total_paid', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).default(0).notNull(),
  status: firsReportStatusEnum('status').default('draft').notNull(),
  metadata: jsonb('metadata'),
  filedAt: timestamp('filed_at'),
  filedBy: uuid('filed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// --- Auto Tax Journal Tracking ---

export const autoTaxJournals = pgTable('auto_tax_journals', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  taxType: taxTypeEnum('tax_type').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id).notNull(),
  amount: bigint('amount', { mode: 'number' }).default(0).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Banking ---

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  accountNumber: text('account_number').notNull(),
  bankName: text('bank_name').notNull(),
  bankCode: text('bank_code'),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  currency: text('currency').default('NGN').notNull(),
  currentBalance: bigint('current_balance', { mode: 'number' }).default(0).notNull(),
  openingBalance: bigint('opening_balance', { mode: 'number' }).default(0).notNull(),
  openingBalanceDate: timestamp('opening_balance_date'),
  monoAccountId: text('mono_account_id'),
  monoAccountStatus: text('mono_account_status').default('pending'),
  lastSyncedAt: timestamp('last_synced_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const bankTransactions = pgTable('bank_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id).notNull(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  date: timestamp('date').notNull(),
  description: text('description').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  type: bankTxnTypeEnum('type').notNull(),
  balanceAfter: bigint('balance_after', { mode: 'number' }),
  reference: text('reference'),
  monoTransactionId: text('mono_transaction_id'),
  status: bankTxnStatusEnum('status').default('unreconciled').notNull(),
  journalLineId: uuid('journal_line_id').references(() => journalLines.id),
  relatedJournalEntryId: uuid('related_journal_entry_id').references(() => journalEntries.id),
  matchConfidence: numeric('match_confidence', { precision: 5, scale: 2 }),
  matchMethod: text('match_method'),
  reconciledAt: timestamp('reconciled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const bankTransfers = pgTable('bank_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  transferNumber: text('transfer_number').notNull(),
  fromBankAccountId: uuid('from_bank_account_id').references(() => bankAccounts.id).notNull(),
  toBankAccountId: uuid('to_bank_account_id').references(() => bankAccounts.id).notNull(),
  date: timestamp('date').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: text('currency').default('NGN').notNull(),
  fxRate: numeric('fx_rate', { precision: 18, scale: 8 }),
  description: text('description'),
  reference: text('reference'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  status: text('status').default('active').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  budget: bigint('budget', { mode: 'number' }).default(0).notNull(),
  customerId: uuid('customer_id').references(() => contacts.id),
  customerName: text('customer_name'),
  billingMethod: text('billing_method').default('Fixed Price').notNull(),
  customFields: jsonb('custom_fields').default({}),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const bankRules = pgTable('bank_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  conditions: jsonb('conditions'),
  actions: jsonb('actions'),
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Reconciliation Adjustments ---

export const reconciliationAdjustments = pgTable('reconciliation_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id).notNull(),
  adjustmentType: text('adjustment_type').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  description: text('description').notNull(),
  reference: text('reference'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Bank Connections (OAuth-based provider connections) ---

export const bankConnections = pgTable('bank_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id).notNull(),
  provider: bankFeedProviderEnum('provider').notNull(),
  providerAccountId: text('provider_account_id'),
  providerAccountName: text('provider_account_name'),
  status: bankConnectionStatusEnum('status').default('pending').notNull(),
  authToken: text('auth_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  lastSyncedAt: timestamp('last_synced_at'),
  meta: jsonb('meta').default({}),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Payment Gateway Transactions ---

export const paymentGatewayTransactions = pgTable('payment_gateway_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  provider: paymentGatewayEnum('provider').notNull(),
  gatewayTransactionId: text('gateway_transaction_id').notNull(),
  reference: text('reference').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  fee: bigint('fee', { mode: 'number' }).default(0).notNull(),
  currency: text('currency').default('NGN').notNull(),
  status: gatewayTxnStatusEnum('status').default('pending').notNull(),
  customerEmail: text('customer_email'),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  description: text('description'),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
  matchedTransactionId: uuid('matched_transaction_id').references(() => bankTransactions.id),
  paymentMethod: text('payment_method'),
  channel: text('channel'),
  rawData: jsonb('raw_data').default({}),
  settledAt: timestamp('settled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Closed Periods ---

export const closedPeriods = pgTable('closed_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  closedAt: timestamp('closed_at').defaultNow().notNull(),
  closedBy: uuid('closed_by').references(() => users.id).notNull()
});

// --- Legacy / Migration Financial Statements ---

export const legacyIncomeStatements = pgTable('legacy_income_statements', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  periodLabel: text('period_label').notNull(),
  currency: text('currency').default('NGN').notNull(),
  data: jsonb('data').notNull(),
  isLocked: boolean('is_locked').default(true).notNull(),
  enteredBy: uuid('entered_by').references(() => users.id).notNull(),
  enteredAt: timestamp('entered_at').defaultNow().notNull()
}, (table) => ({
  legacyISOrgFyIdx: index('idx_legacy_is_org_fy').on(table.orgId, table.fiscalYear),
}));

export const legacyCashFlowStatements = pgTable('legacy_cash_flow_statements', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  periodLabel: text('period_label').notNull(),
  currency: text('currency').default('NGN').notNull(),
  data: jsonb('data').notNull(),
  isLocked: boolean('is_locked').default(true).notNull(),
  enteredBy: uuid('entered_by').references(() => users.id).notNull(),
  enteredAt: timestamp('entered_at').defaultNow().notNull()
}, (table) => ({
  legacyCFOrgFyIdx: index('idx_legacy_cf_org_fy').on(table.orgId, table.fiscalYear),
}));

export const legacyStatementsOfChangesInEquity = pgTable('legacy_statements_of_changes_in_equity', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  periodLabel: text('period_label').notNull(),
  currency: text('currency').default('NGN').notNull(),
  data: jsonb('data').notNull(),
  isLocked: boolean('is_locked').default(true).notNull(),
  enteredBy: uuid('entered_by').references(() => users.id).notNull(),
  enteredAt: timestamp('entered_at').defaultNow().notNull()
}, (table) => ({
  legacySocieOrgFyIdx: index('idx_legacy_socie_org_fy').on(table.orgId, table.fiscalYear),
}));

export const closedPeriodsRelations = relations(closedPeriods, ({ one }) => ({
  organisation: one(organisations, {
    fields: [closedPeriods.orgId],
    references: [organisations.id]
  }),
  closer: one(users, {
    fields: [closedPeriods.closedBy],
    references: [users.id]
  })
}));

// --- Payroll ---

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  staffId: text('staff_id').notNull(),
  firstName: text('first_name').notNull(),
  middleName: text('middle_name'),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  department: text('department'),
  designation: text('designation'),
  dateOfBirth: timestamp('date_of_birth'),
  dateHired: timestamp('date_hired'),
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  grossSalary: bigint('gross_salary', { mode: 'number' }).default(0).notNull(),
  paymentFrequency: paymentFrequencyEnum('payment_frequency').default('monthly').notNull(),
  pensionPin: text('pension_pin'),
  nhfNumber: text('nhf_number'),
  taxId: text('tax_id'),
  isActive: boolean('is_active').default(true).notNull(),
  pensionablePortionPct: integer('pensionable_portion_pct').default(80).notNull(),
  pensionRatePct: integer('pension_rate_pct').default(8).notNull(),
  nhisApplicable: boolean('nhis_applicable').default(false).notNull(),
  nhfApplicable: boolean('nhf_applicable').default(true).notNull(),
  annualRent: bigint('annual_rent', { mode: 'number' }).default(0).notNull(),
  annualMortgageInterest: bigint('annual_mortgage_interest', { mode: 'number' }).default(0).notNull(),
  annualLifeAssurance: bigint('annual_life_assurance', { mode: 'number' }).default(0).notNull(),
  basicSalaryPct: integer('basic_salary_pct').default(50).notNull(),
  housingPct: integer('housing_pct').default(20).notNull(),
  transportPct: integer('transport_pct').default(10).notNull(),
  utilitiesPct: integer('utilities_pct').default(10).notNull(),
  mealsPct: integer('meals_pct').default(5).notNull(),
  othersPct: integer('others_pct').default(5).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  runNumber: text('run_number').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  payDate: timestamp('pay_date').notNull(),
  status: payrollRunStatusEnum('status').default('draft').notNull(),
  totalGross: bigint('total_gross', { mode: 'number' }).default(0).notNull(),
  totalPaye: bigint('total_paye', { mode: 'number' }).default(0).notNull(),
  totalPension: bigint('total_pension', { mode: 'number' }).default(0).notNull(),
  totalNhf: bigint('total_nhf', { mode: 'number' }).default(0).notNull(),
  totalNet: bigint('total_net', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
  accruedSalaryAccountId: uuid('accrued_salary_account_id').references(() => accounts.id),
  processedBy: uuid('processed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const payrollLines = pgTable('payroll_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => payrollRuns.id).notNull(),
  employeeId: uuid('employee_id').references(() => employees.id).notNull(),
  grossPay: bigint('gross_pay', { mode: 'number' }).default(0).notNull(),
  basic: bigint('basic', { mode: 'number' }).default(0).notNull(),
  housing: bigint('housing', { mode: 'number' }).default(0).notNull(),
  transport: bigint('transport', { mode: 'number' }).default(0).notNull(),
  otherAllowances: bigint('other_allowances', { mode: 'number' }).default(0).notNull(),
  paye: bigint('paye', { mode: 'number' }).default(0).notNull(),
  pensionEmployee: bigint('pension_employee', { mode: 'number' }).default(0).notNull(),
  pensionEmployer: bigint('pension_employer', { mode: 'number' }).default(0).notNull(),
  nhf: bigint('nhf', { mode: 'number' }).default(0).notNull(),
  otherDeductions: bigint('other_deductions', { mode: 'number' }).default(0).notNull(),
  nhis: bigint('nhis', { mode: 'number' }).default(0).notNull(),
  nhisEmployer: bigint('nhis_employer', { mode: 'number' }).default(0).notNull(),
  internalDeductions: jsonb('internal_deductions').default([]).notNull(),
  netPay: bigint('net_pay', { mode: 'number' }).default(0).notNull(),
  taxRelief: bigint('tax_relief', { mode: 'number' }).default(0).notNull(),
  annualGross: bigint('annual_gross', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Fixed Assets ---

export const fixedAssets = pgTable('fixed_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assetNumber: text('asset_number').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  assetClassId: uuid('asset_class_id').references(() => assetClasses.id),
  purchaseDate: timestamp('purchase_date').notNull(),
  purchaseCost: bigint('purchase_cost', { mode: 'number' }).notNull(),
  accumulatedDepreciation: bigint('accumulated_depreciation', { mode: 'number' }).default(0).notNull(),
  bookValue: bigint('book_value', { mode: 'number' }).notNull(),
  depreciationMethod: depreciationMethodEnum('depreciation_method').notNull(),
  usefulLifeMonths: integer('useful_life_months').notNull(),
  residualValue: bigint('residual_value', { mode: 'number' }).default(0).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  location: text('location'),
  department: text('department'),
  revaluationAmount: bigint('revaluation_amount', { mode: 'number' }).default(0).notNull(),
  revaluationSurplusAccountId: uuid('revaluation_surplus_account_id').references(() => accounts.id),
  impairmentLoss: bigint('impairment_loss', { mode: 'number' }).default(0).notNull(),
  lastDepreciationDate: timestamp('last_depreciation_date'),
  nextDepreciationDate: timestamp('next_depreciation_date'),
  capitalizationDate: timestamp('capitalization_date'),
  cwipSourceId: uuid('cwip_source_id'),
  disposalDate: timestamp('disposal_date'),
  disposalAmount: bigint('disposal_amount', { mode: 'number' }),
  disposalAccountId: uuid('disposal_account_id').references(() => accounts.id),
  status: fixedAssetStatusEnum('status').default('active').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  postedBy: uuid('posted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const assetClasses = pgTable('asset_classes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  description: text('description'),
  defaultUsefulLifeMonths: integer('default_useful_life_months').default(60),
  defaultDepreciationMethod: depreciationMethodEnum('default_depreciation_method').default('straight_line'),
  defaultResidualValuePct: numeric('default_residual_value_pct', { precision: 5, scale: 2 }).default('0'),
  glAssetAccountId: uuid('gl_asset_account_id').references(() => accounts.id),
  glDepreciationExpenseAccountId: uuid('gl_depreciation_expense_account_id').references(() => accounts.id),
  glAccumDeprAccountId: uuid('gl_accum_depr_account_id').references(() => accounts.id),
  glRevaluationReserveAccountId: uuid('gl_revaluation_reserve_account_id').references(() => accounts.id),
  glDisposalProceedsAccountId: uuid('gl_disposal_proceeds_account_id').references(() => accounts.id),
  glDisposalLossAccountId: uuid('gl_disposal_loss_account_id').references(() => accounts.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const assetComponents = pgTable('asset_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  cost: bigint('cost', { mode: 'number' }).notNull(),
  usefulLifeMonths: integer('useful_life_months').notNull(),
  residualValue: bigint('residual_value', { mode: 'number' }).default(0).notNull(),
  depreciationMethod: depreciationMethodEnum('depreciation_method').default('straight_line'),
  accumulatedDepreciation: bigint('accumulated_depreciation', { mode: 'number' }).default(0).notNull(),
  bookValue: bigint('book_value', { mode: 'number' }).notNull(),
  glAssetAccountId: uuid('gl_asset_account_id').references(() => accounts.id),
  glAccumDeprAccountId: uuid('gl_accum_depr_account_id').references(() => accounts.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const revaluationEntries = pgTable('revaluation_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  componentId: uuid('component_id').references(() => assetComponents.id),
  revaluationDate: timestamp('revaluation_date').notNull(),
  revaluationType: text('revaluation_type').notNull(),
  oldCarryingAmount: bigint('old_carrying_amount', { mode: 'number' }).notNull(),
  newCarryingAmount: bigint('new_carrying_amount', { mode: 'number' }).notNull(),
  revaluationAmount: bigint('revaluation_amount', { mode: 'number' }).notNull(),
  revaluationSurplus: bigint('revaluation_surplus', { mode: 'number' }).default(0).notNull(),
  revaluationLoss: bigint('revaluation_loss', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const impairmentEntries = pgTable('impairment_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  componentId: uuid('component_id').references(() => assetComponents.id),
  impairmentDate: timestamp('impairment_date').notNull(),
  carryingAmount: bigint('carrying_amount', { mode: 'number' }).notNull(),
  recoverableAmount: bigint('recoverable_amount', { mode: 'number' }).notNull(),
  impairmentLoss: bigint('impairment_loss', { mode: 'number' }).notNull(),
  impairmentSource: text('impairment_source'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const maintenanceRecords = pgTable('maintenance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  componentId: uuid('component_id').references(() => assetComponents.id),
  maintenanceDate: timestamp('maintenance_date').notNull(),
  maintenanceType: text('maintenance_type').notNull(),
  description: text('description').notNull(),
  cost: bigint('cost', { mode: 'number' }).notNull(),
  vendor: text('vendor'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const assetTransfers = pgTable('asset_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  transferDate: timestamp('transfer_date').notNull(),
  fromLocation: text('from_location'),
  toLocation: text('to_location'),
  fromDepartment: text('from_department'),
  toDepartment: text('to_department'),
  reason: text('reason'),
  authorizedBy: uuid('authorized_by').references(() => users.id),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const depreciationEntries = pgTable('depreciation_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  periodDate: timestamp('period_date').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id).notNull(),
  entryNumber: text('entry_number'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// --- Accounting Posting Rules ---

export const accountingRules = pgTable('accounting_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  source: text('source').notNull(),
  eventType: text('event_type'),
  accountRole: text('account_role'),
  accountId: uuid('account_id').references(() => accounts.id),
  priority: integer('priority').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  rulesOrgSourceIdx: index('idx_rules_org_source').on(table.orgId, table.source),
}));

// --- Documents & Config ---

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  name: text('name').notNull(),
  fiscalYear: integer('fiscal_year').notNull(),
  period: budgetPeriodEnum('period').notNull(),
  status: budgetStatusEnum('status').default('draft').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const budgetLines = pgTable('budget_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  budgetId: uuid('budget_id').references(() => budgets.id).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  period: integer('period').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  description: text('description'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  correlationId: uuid('correlation_id'),
  hash: text('hash'),
  previousHash: text('previous_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  orgCreatedIdx: index('idx_audit_log_org_created').on(table.orgId, table.createdAt),
  orgEntityIdx: index('idx_audit_log_org_entity').on(table.orgId, table.entityType, table.entityId),
  entityLookupIdx: index('idx_audit_log_entity_lookup').on(table.orgId, table.entityType, table.entityId, table.createdAt),
  userIdx: index('idx_audit_log_user').on(table.orgId, table.userId),
  correlationIdx: index('idx_audit_log_correlation').on(table.orgId, table.correlationId),
  hashIdx: index('idx_audit_log_hash').on(table.hash),
}));

// --- Approval Workflow ---

export const approvalWorkflows = pgTable('approval_workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  module: approvalModuleEnum('module').notNull(),
  level: integer('level').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  workflowOrgModuleIdx: index('idx_workflow_org_module').on(table.orgId, table.module),
  workflowOrgModuleUnique: index('idx_workflow_org_module_unique').on(table.orgId, table.module),
}));

export const approvalHistory = pgTable('approval_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  module: approvalModuleEnum('module').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id).notNull(),
  comment: text('comment'),
  oldStatus: text('old_status'),
  newStatus: text('new_status'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  approvalHistoryOrgIdx: index('idx_approval_history_org').on(table.orgId, table.module, table.entityId),
  approvalHistoryEntityIdx: index('idx_approval_history_entity').on(table.entityId),
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one }) => ({
  org: one(organisations, { fields: [approvalWorkflows.orgId], references: [organisations.id] }),
}));

export const approvalHistoryRelations = relations(approvalHistory, ({ one }) => ({
  org: one(organisations, { fields: [approvalHistory.orgId], references: [organisations.id] }),
  performer: one(users, { fields: [approvalHistory.performedBy], references: [users.id] }),
}));

// --- OCR Document Processing ---

export const ocrDocTypeEnum = pgEnum('ocr_doc_type', ['invoice', 'bill', 'receipt', 'purchase_order']);
export const ocrDocStatusEnum = pgEnum('ocr_doc_status', ['pending', 'extracting', 'ready', 'posted', 'error']);

export const ocrDocuments = pgTable('ocr_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type'),
  fileSize: integer('file_size'),
  docType: ocrDocTypeEnum('doc_type'),
  status: ocrDocStatusEnum('status').default('pending').notNull(),
  extractedData: jsonb('extracted_data'),
  suggestedJournal: jsonb('suggested_journal'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  confirmedBy: uuid('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at'),
  errorMessage: text('error_message'),
  uploadedBy: uuid('uploaded_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const ocrDocumentsRelations = relations(ocrDocuments, ({ one }) => ({
  organisation: one(organisations, {
    fields: [ocrDocuments.orgId],
    references: [organisations.id]
  }),
  uploader: one(users, {
    fields: [ocrDocuments.uploadedBy],
    references: [users.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [ocrDocuments.journalEntryId],
    references: [journalEntries.id]
  }),
}));

export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  convOrgIdx: index('idx_conv_org').on(table.orgId),
}));

export const chatConversationParticipants = pgTable('chat_conversation_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => chatConversations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
}, (table) => ({
  convPartConvIdx: index('idx_conv_part_conv').on(table.conversationId),
  convPartUserIdx: index('idx_conv_part_user').on(table.userId),
  convPartUnique: index('idx_conv_part_unique').on(table.conversationId, table.userId),
}));

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  conversationId: uuid('conversation_id').references(() => chatConversations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  msgConvIdx: index('idx_chat_msg_conv').on(table.conversationId, table.createdAt),
}));

export const chatReadMarkers = pgTable('chat_read_markers', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => chatConversations.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  lastReadAt: timestamp('last_read_at').defaultNow().notNull(),
}, (table) => ({
  readUnique: index('idx_chat_read_unique').on(table.conversationId, table.userId),
}));

export const emailSettings = pgTable('email_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull().unique(),
  protocol: text('protocol').default('smtp').notNull(),
  hostname: text('hostname'),
  port: integer('port').default(587),
  username: text('username'),
  email: text('email'),
  password: text('password'),
  sendCopyTo: text('send_copy_to'),
  replyTo: text('reply_to'),
  useDifferentReplyTo: boolean('use_different_reply_to').default(false).notNull(),
  doNotVerifyTls: boolean('do_not_verify_tls').default(false).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Report Section Mappings (dynamic account-to-IFRS-line-item mapping) ──
export const reportSectionMappings = pgTable('report_section_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  reportType: text('report_type').notNull(), // 'balance_sheet', 'income_statement', 'cash_flow'
  sectionKey: text('section_key').notNull(), // e.g. 'currentAssets.cashAndBank', 'revenue.operatingRevenue'
  label: text('label').notNull(), // display label for the line item
  accountCode: text('account_code'), // optional: specific account code
  accountPrefix: text('account_prefix'), // optional: code prefix (e.g. '100' for all 100xxx)
  signMultiplier: integer('sign_multiplier').default(1).notNull(), // 1 or -1 for netting
  includeSubAccounts: boolean('include_sub_accounts').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialNotes = pgTable('financial_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  noteNumber: text('note_number').notNull(), // e.g. '1', '2', '3'
  title: text('title').notNull(), // e.g. 'Significant Accounting Policies'
  content: text('content'), // editable markdown/HTML content
  autoGenerated: boolean('auto_generated').default(true).notNull(),
  sourceReport: text('source_report'), // which report this note relates to
  reportDate: timestamp('report_date'), // as-of date for the note data
  noteData: jsonb('note_data'), // structured data for auto-generated notes
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const currencyRates = pgTable('currency_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  baseCurrency: text('base_currency').notNull(),
  quoteCurrency: text('quote_currency').notNull(),
  rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
  source: text('source'),
  effectiveDate: timestamp('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ── IFRS 15 Revenue Recognition ──

export const contractStatusEnum = pgEnum('contract_status', [
  'draft',
  'active',
  'completed',
  'cancelled',
  'modified',
]);

export const obligationTimingEnum = pgEnum('obligation_timing', [
  'point_in_time',
  'over_time',
]);

export const recognitionMethodEnum = pgEnum('recognition_method', [
  'straight_line',
  'milestone',
  'percentage_of_completion',
  'custom',
]);

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'pending',
  'recognized',
  'skipped',
]);

export const revenueContracts = pgTable('revenue_contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  contractNumber: text('contract_number').notNull(),
  customerId: uuid('customer_id').references(() => contacts.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  description: text('description'),
  status: contractStatusEnum('status').default('draft').notNull(),
  totalContractValue: bigint('total_contract_value', { mode: 'number' }).default(0).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  billingFrequency: text('billing_frequency'), // monthly, quarterly, annual, milestone
  paymentTerms: integer('payment_terms'),
  currency: text('currency').default('NGN').notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const performanceObligations = pgTable('performance_obligations', {
  id: uuid('id').defaultRandom().primaryKey(),
  contractId: uuid('contract_id').references(() => revenueContracts.id).notNull(),
  description: text('description').notNull(),
  timing: obligationTimingEnum('timing').notNull(),
  amount: bigint('amount', { mode: 'number' }).default(0).notNull(),
  recognizedAmount: bigint('recognized_amount', { mode: 'number' }).default(0).notNull(),
  remainingAmount: bigint('remaining_amount', { mode: 'number' }).default(0).notNull(),
  recognitionMethod: recognitionMethodEnum('recognition_method').default('straight_line').notNull(),
  revenueAccountId: uuid('revenue_account_id').references(() => accounts.id).notNull(),
  deferredRevenueAccountId: uuid('deferred_revenue_account_id').references(() => accounts.id),
  contractAssetAccountId: uuid('contract_asset_account_id').references(() => accounts.id),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  milestoneCriteria: text('milestone_criteria'),
  completionPercentage: numeric('completion_percentage'),
  sortOrder: integer('sort_order').default(0).notNull(),
  status: contractStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const revenueSchedules = pgTable('revenue_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  obligationId: uuid('obligation_id').references(() => performanceObligations.id).notNull(),
  scheduledDate: timestamp('scheduled_date').notNull(),
  amount: bigint('amount', { mode: 'number' }).default(0).notNull(),
  recognizedAmount: bigint('recognized_amount', { mode: 'number' }).default(0).notNull(),
  status: scheduleStatusEnum('status').default('pending').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const revenueRecognitionEntries = pgTable('revenue_recognition_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  scheduleId: uuid('schedule_id').references(() => revenueSchedules.id).notNull(),
  obligationId: uuid('obligation_id').references(() => performanceObligations.id).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  recognizedDate: timestamp('recognized_date').notNull(),
  method: recognitionMethodEnum('method').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ── IFRS 16 Lease Accounting ──

export const leaseStatusEnum = pgEnum('lease_status', [
  'draft',
  'active',
  'modified',
  'terminated',
  'expired'
]);

export const leases = pgTable('leases', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  leaseNumber: text('lease_number').notNull(),
  description: text('description'),
  lessorName: text('lessor_name').notNull(),
  assetCategory: text('asset_category').notNull(), // buildings, motor_vehicles, equipment, other
  rouAssetAccountId: uuid('rou_asset_account_id').references(() => accounts.id).notNull(),
  accumDepreciationAccountId: uuid('accum_depreciation_account_id').references(() => accounts.id).notNull(),
  depreciationExpenseAccountId: uuid('depreciation_expense_account_id').references(() => accounts.id).notNull(),
  leaseLiabilityAccountId: uuid('lease_liability_account_id').references(() => accounts.id),
  currentLiabilityAccountId: uuid('current_liability_account_id').references(() => accounts.id),
  interestExpenseAccountId: uuid('interest_expense_account_id').references(() => accounts.id),
  bankAccountId: uuid('bank_account_id').references(() => accounts.id),
  commencementDate: timestamp('commencement_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  leaseTermMonths: integer('lease_term_months').notNull(),
  paymentAmount: bigint('payment_amount', { mode: 'number' }).notNull(),
  paymentFrequency: paymentFrequencyEnum('payment_frequency').default('monthly').notNull(),
  totalPayments: integer('total_payments').notNull(),
  incrementalBorrowingRate: numeric('incremental_borrowing_rate', { precision: 5, scale: 2 }).notNull(), // percentage e.g. 12.00
  presentValue: bigint('present_value', { mode: 'number' }).notNull(),
  rouAssetInitial: bigint('rou_asset_initial', { mode: 'number' }).notNull(), // initial recognition amount
  initialDirectCosts: bigint('initial_direct_costs', { mode: 'number' }).default(0).notNull(),
  depreciationMethod: depreciationMethodEnum('depreciation_method').default('straight_line').notNull(),
  residualValue: bigint('residual_value', { mode: 'number' }).default(0).notNull(),
  status: leaseStatusEnum('status').default('draft').notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const leasePaymentSchedules = pgTable('lease_payment_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  leaseId: uuid('lease_id').references(() => leases.id).notNull(),
  periodNumber: integer('period_number').notNull(),
  dueDate: timestamp('due_date').notNull(),
  paymentAmount: bigint('payment_amount', { mode: 'number' }).notNull(),
  interestAmount: bigint('interest_amount', { mode: 'number' }).default(0).notNull(),
  principalAmount: bigint('principal_amount', { mode: 'number' }).default(0).notNull(),
  outstandingBalance: bigint('outstanding_balance', { mode: 'number' }).notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const leaseJournalEntries = pgTable('lease_journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  leaseId: uuid('lease_id').references(() => leases.id).notNull(),
  periodNumber: integer('period_number').notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id).notNull(),
  entryType: text('entry_type').notNull(), // 'commencement', 'payment', 'depreciation', 'modification', 'termination', 'year_end_reclassification'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// ── IFRS 9 Expected Credit Loss ──

export const eclParameters = pgTable('ecl_parameters', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  bucketLabel: text('bucket_label').notNull(), // 'current', '1-30', '31-60', '61-90', '90+'
  minDays: integer('min_days').default(0).notNull(),
  maxDays: integer('max_days').default(0).notNull(),
  lossRate: numeric('loss_rate', { precision: 6, scale: 4 }).notNull(), // e.g. 0.0100 for 1%
  stage: text('stage').default('1').notNull(), // '1', '2', '3'
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const eclComputations = pgTable('ecl_computations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organisations.id).notNull(),
  computationDate: timestamp('computation_date').notNull(),
  asOfDate: timestamp('as_of_date').notNull(),
  totalReceivables: bigint('total_receivables', { mode: 'number' }).default(0).notNull(),
  totalProvision: bigint('total_provision', { mode: 'number' }).default(0).notNull(),
  previousProvision: bigint('previous_provision', { mode: 'number' }).default(0).notNull(),
  adjustmentAmount: bigint('adjustment_amount', { mode: 'number' }).default(0).notNull(), // positive = additional charge, negative = reversal
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  details: jsonb('details'), // array of per-bucket and per-customer breakdown
  status: text('status').default('computed').notNull(), // 'computed', 'posted'
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 3. RELATIONS DEFINITIONS
// ==========================================

export const organisationsRelations = relations(organisations, ({ many }) => ({
  users: many(users),
  accounts: many(accounts),
  contacts: many(contacts),
  items: many(items),
  quotes: many(quotes),
  salesOrders: many(salesOrders),
  invoices: many(invoices),
  paymentsReceived: many(paymentsReceived),
  creditNotes: many(creditNotes),
  recurringInvoices: many(recurringInvoices),
  purchaseOrders: many(purchaseOrders),
  bills: many(bills),
  paymentsMade: many(paymentsMade),
  vendorCredits: many(vendorCredits),
  expenses: many(expenses),
  bankAccounts: many(bankAccounts),
  bankTransactions: many(bankTransactions),
  bankRules: many(bankRules),
  bankConnections: many(bankConnections),
  paymentGatewayTransactions: many(paymentGatewayTransactions),
  employees: many(employees),
  payrollRuns: many(payrollRuns),
  fixedAssets: many(fixedAssets),
  documents: many(documents),
  ocrDocuments: many(ocrDocuments),
  budgets: many(budgets),
  auditLog: many(auditLog),
  currencyRates: many(currencyRates)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id]
  }),
  sessions: many(sessions),
  queriesCreated: many(journalEntries, { relationName: 'createdBy' }),
  queriesReversed: many(journalEntries, { relationName: 'reversedById' }),
  quotesCreated: many(quotes),
  soCreated: many(salesOrders),
  invoicesCreated: many(invoices),
  paymentsRecvCreated: many(paymentsReceived),
  creditNotesCreated: many(creditNotes),
  recurringInvoicesCreated: many(recurringInvoices),
  poCreated: many(purchaseOrders),
  billsCreated: many(bills),
  paymentsMadeCreated: many(paymentsMade),
  vendorCreditsCreated: many(vendorCredits),
  expensesCreated: many(expenses),
  payrollProcessed: many(payrollRuns),
  documentsUploaded: many(documents),
  budgetsCreated: many(budgets),
  actionsPerformed: many(auditLog)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [accounts.orgId],
    references: [organisations.id]
  }),
  parentAccount: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: 'accountsHierarchy'
  }),
  subAccounts: many(accounts, { relationName: 'accountsHierarchy' }),
  journalLines: many(journalLines),
  itemsSales: many(items, { relationName: 'salesAccountId' }),
  itemsPurchase: many(items, { relationName: 'purchaseAccountId' }),
  itemsInventory: many(items, { relationName: 'inventoryAccountId' }),
  invoiceLines: many(invoiceLines),
  paymentsReceived: many(paymentsReceived),
  billLines: many(billLines),
  paymentsMade: many(paymentsMade),
  expenses: many(expenses),
  bankAccounts: many(bankAccounts),
  fixedAssets: many(fixedAssets),
  budgetLines: many(budgetLines)
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [journalEntries.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [journalEntries.createdBy],
    references: [users.id],
    relationName: 'createdBy'
  }),
  reverser: one(users, {
    fields: [journalEntries.reversedById],
    references: [users.id],
    relationName: 'reversedById'
  }),
  lines: many(journalLines),
  invoices: many(invoices),
  creditNotes: many(creditNotes),
  bills: many(bills),
  vendorCredits: many(vendorCredits),
  expenses: many(expenses),
  payrollRuns: many(payrollRuns),
  depreciationEntries: many(depreciationEntries),
  paymentsMade: many(paymentsMade)
}));

export const journalLinesRelations = relations(journalLines, ({ one, many }) => ({
  entry: one(journalEntries, {
    fields: [journalLines.entryId],
    references: [journalEntries.id]
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id]
  }),
  bankTransactions: many(bankTransactions)
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [contacts.orgId],
    references: [organisations.id]
  }),
  quotes: many(quotes),
  salesOrders: many(salesOrders),
  recurringInvoices: many(recurringInvoices),
  invoices: many(invoices),
  paymentsReceived: many(paymentsReceived),
  creditNotes: many(creditNotes),
  purchaseOrders: many(purchaseOrders),
  bills: many(bills),
  paymentsMade: many(paymentsMade),
  vendorCredits: many(vendorCredits),
  vendorExpenses: many(expenses, { relationName: 'vendorId' }),
  customerExpenses: many(expenses, { relationName: 'customerId' })
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [items.orgId],
    references: [organisations.id]
  }),
  salesAccount: one(accounts, {
    fields: [items.salesAccountId],
    references: [accounts.id],
    relationName: 'salesAccountId'
  }),
  purchaseAccount: one(accounts, {
    fields: [items.purchaseAccountId],
    references: [accounts.id],
    relationName: 'purchaseAccountId'
  }),
  inventoryAccount: one(accounts, {
    fields: [items.inventoryAccountId],
    references: [accounts.id],
    relationName: 'inventoryAccountId'
  }),
  inventoryLots: many(inventoryLots),
  inventoryTransactions: many(inventoryTransactions),
  inventoryTransfers: many(inventoryTransfers),
  inventoryTransferItems: many(inventoryTransferItems),
  inventoryStockCounts: many(inventoryStockCounts),
  inventoryStockCountItems: many(inventoryStockCountItems),
  inventoryWriteoffs: many(inventoryWriteoffs),
  inventoryWriteoffItems: many(inventoryWriteoffItems),
  landedCosts: many(landedCosts),
  landedCostAllocations: many(landedCostAllocations),
  invoiceLines: many(invoiceLines),
  billLines: many(billLines)
}));

export const inventoryLotsRelations = relations(inventoryLots, ({ one, many }) => ({
  item: one(items, {
    fields: [inventoryLots.itemId],
    references: [items.id]
  }),
  organisation: one(organisations, {
    fields: [inventoryLots.orgId],
    references: [organisations.id]
  }),
  inventoryTransactions: many(inventoryTransactions)
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  item: one(items, {
    fields: [inventoryTransactions.itemId],
    references: [items.id]
  }),
  organisation: one(organisations, {
    fields: [inventoryTransactions.orgId],
    references: [organisations.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryTransactions.lotId],
    references: [inventoryLots.id]
  })
}));

export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inventoryTransfers.orgId],
    references: [organisations.id]
  }),
  items: many(inventoryTransferItems),
  createdByUser: one(users, {
    fields: [inventoryTransfers.createdBy],
    references: [users.id]
  })
}));

export const inventoryTransferItemsRelations = relations(inventoryTransferItems, ({ one }) => ({
  transfer: one(inventoryTransfers, {
    fields: [inventoryTransferItems.transferId],
    references: [inventoryTransfers.id]
  }),
  item: one(items, {
    fields: [inventoryTransferItems.itemId],
    references: [items.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryTransferItems.lotId],
    references: [inventoryLots.id]
  })
}));

export const inventoryStockCountsRelations = relations(inventoryStockCounts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inventoryStockCounts.orgId],
    references: [organisations.id]
  }),
  items: many(inventoryStockCountItems),
  createdByUser: one(users, {
    fields: [inventoryStockCounts.createdBy],
    references: [users.id]
  })
}));

export const inventoryStockCountItemsRelations = relations(inventoryStockCountItems, ({ one }) => ({
  count: one(inventoryStockCounts, {
    fields: [inventoryStockCountItems.countId],
    references: [inventoryStockCounts.id]
  }),
  item: one(items, {
    fields: [inventoryStockCountItems.itemId],
    references: [items.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryStockCountItems.lotId],
    references: [inventoryLots.id]
  })
}));

export const inventoryWriteoffsRelations = relations(inventoryWriteoffs, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [inventoryWriteoffs.orgId],
    references: [organisations.id]
  }),
  items: many(inventoryWriteoffItems),
  account: one(accounts, {
    fields: [inventoryWriteoffs.accountId],
    references: [accounts.id]
  }),
  createdByUser: one(users, {
    fields: [inventoryWriteoffs.createdBy],
    references: [users.id]
  })
}));

export const inventoryWriteoffItemsRelations = relations(inventoryWriteoffItems, ({ one }) => ({
  writeoff: one(inventoryWriteoffs, {
    fields: [inventoryWriteoffItems.writeoffId],
    references: [inventoryWriteoffs.id]
  }),
  item: one(items, {
    fields: [inventoryWriteoffItems.itemId],
    references: [items.id]
  }),
  lot: one(inventoryLots, {
    fields: [inventoryWriteoffItems.lotId],
    references: [inventoryLots.id]
  })
}));

export const landedCostsRelations = relations(landedCosts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [landedCosts.orgId],
    references: [organisations.id]
  }),
  bill: one(bills, {
    fields: [landedCosts.billId],
    references: [bills.id]
  }),
  allocations: many(landedCostAllocations),
  createdByUser: one(users, {
    fields: [landedCosts.createdBy],
    references: [users.id]
  })
}));

export const landedCostAllocationsRelations = relations(landedCostAllocations, ({ one }) => ({
  landedCost: one(landedCosts, {
    fields: [landedCostAllocations.landedCostId],
    references: [landedCosts.id]
  }),
  item: one(items, {
    fields: [landedCostAllocations.itemId],
    references: [items.id]
  }),
  billLine: one(billLines, {
    fields: [landedCostAllocations.billLineId],
    references: [billLines.id]
  }),
  lot: one(inventoryLots, {
    fields: [landedCostAllocations.lotId],
    references: [inventoryLots.id]
  })
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [quotes.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [quotes.customerId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [quotes.createdBy],
    references: [users.id]
  }),
  salesOrders: many(salesOrders)
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [salesOrders.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [salesOrders.customerId],
    references: [contacts.id]
  }),
  quote: one(quotes, {
    fields: [salesOrders.quoteId],
    references: [quotes.id]
  }),
  creator: one(users, {
    fields: [salesOrders.createdBy],
    references: [users.id]
  }),
  invoices: many(invoices)
}));

export const recurringInvoicesRelations = relations(recurringInvoices, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [recurringInvoices.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [recurringInvoices.customerId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [recurringInvoices.createdBy],
    references: [users.id]
  }),
  invoices: many(invoices)
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [invoices.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [invoices.customerId],
    references: [contacts.id]
  }),
  salesOrder: one(salesOrders, {
    fields: [invoices.soId],
    references: [salesOrders.id]
  }),
  recurringInvoice: one(recurringInvoices, {
    fields: [invoices.recurringId],
    references: [recurringInvoices.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [invoices.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [invoices.createdBy],
    references: [users.id]
  }),
  lines: many(invoiceLines),
  paymentAllocations: many(paymentAllocations),
  creditNotes: many(creditNotes)
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id]
  }),
  item: one(items, {
    fields: [invoiceLines.itemId],
    references: [items.id]
  }),
  account: one(accounts, {
    fields: [invoiceLines.accountId],
    references: [accounts.id]
  })
}));

export const paymentsReceivedRelations = relations(paymentsReceived, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [paymentsReceived.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [paymentsReceived.customerId],
    references: [contacts.id]
  }),
  account: one(accounts, {
    fields: [paymentsReceived.accountId],
    references: [accounts.id]
  }),
  creator: one(users, {
    fields: [paymentsReceived.createdBy],
    references: [users.id]
  }),
  paymentAllocations: many(paymentAllocations)
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(paymentsReceived, {
    fields: [paymentAllocations.paymentId],
    references: [paymentsReceived.id]
  }),
  invoice: one(invoices, {
    fields: [paymentAllocations.invoiceId],
    references: [invoices.id]
  })
}));

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  organisation: one(organisations, {
    fields: [creditNotes.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [creditNotes.customerId],
    references: [contacts.id]
  }),
  invoice: one(invoices, {
    fields: [creditNotes.invoiceId],
    references: [invoices.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [creditNotes.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [creditNotes.createdBy],
    references: [users.id]
  })
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [purchaseOrders.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [purchaseOrders.vendorId],
    references: [contacts.id]
  }),
  creator: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id]
  }),
  bills: many(bills)
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [bills.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [bills.vendorId],
    references: [contacts.id]
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [bills.poId],
    references: [purchaseOrders.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [bills.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [bills.createdBy],
    references: [users.id]
  }),
  lines: many(billLines),
  paymentMadeAllocations: many(paymentMadeAllocations),
  vendorCredits: many(vendorCredits)
}));

export const billLinesRelations = relations(billLines, ({ one }) => ({
  bill: one(bills, {
    fields: [billLines.billId],
    references: [bills.id]
  }),
  item: one(items, {
    fields: [billLines.itemId],
    references: [items.id]
  }),
  account: one(accounts, {
    fields: [billLines.accountId],
    references: [accounts.id]
  })
}));

export const paymentsMadeRelations = relations(paymentsMade, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [paymentsMade.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [paymentsMade.vendorId],
    references: [contacts.id]
  }),
  account: one(accounts, {
    fields: [paymentsMade.accountId],
    references: [accounts.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [paymentsMade.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [paymentsMade.createdBy],
    references: [users.id]
  }),
  paymentAllocations: many(paymentMadeAllocations)
}));

export const paymentMadeAllocationsRelations = relations(paymentMadeAllocations, ({ one }) => ({
  payment: one(paymentsMade, {
    fields: [paymentMadeAllocations.paymentId],
    references: [paymentsMade.id]
  }),
  bill: one(bills, {
    fields: [paymentMadeAllocations.billId],
    references: [bills.id]
  })
}));

export const vendorCreditsRelations = relations(vendorCredits, ({ one }) => ({
  organisation: one(organisations, {
    fields: [vendorCredits.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [vendorCredits.vendorId],
    references: [contacts.id]
  }),
  bill: one(bills, {
    fields: [vendorCredits.billId],
    references: [bills.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [vendorCredits.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [vendorCredits.createdBy],
    references: [users.id]
  })
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  organisation: one(organisations, {
    fields: [expenses.orgId],
    references: [organisations.id]
  }),
  vendor: one(contacts, {
    fields: [expenses.vendorId],
    references: [contacts.id],
    relationName: 'vendorId'
  }),
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.id]
  }),
  customer: one(contacts, {
    fields: [expenses.customerId],
    references: [contacts.id],
    relationName: 'customerId'
  }),
  journalEntry: one(journalEntries, {
    fields: [expenses.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [expenses.createdBy],
    references: [users.id]
  })
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [bankAccounts.orgId],
    references: [organisations.id]
  }),
  account: one(accounts, {
    fields: [bankAccounts.accountId],
    references: [accounts.id]
  }),
  transactions: many(bankTransactions)
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  bankAccount: one(bankAccounts, {
    fields: [bankTransactions.bankAccountId],
    references: [bankAccounts.id]
  }),
  organisation: one(organisations, {
    fields: [bankTransactions.orgId],
    references: [organisations.id]
  }),
  journalLine: one(journalLines, {
    fields: [bankTransactions.journalLineId],
    references: [journalLines.id]
  })
}));

export const bankRulesRelations = relations(bankRules, ({ one }) => ({
  organisation: one(organisations, {
    fields: [bankRules.orgId],
    references: [organisations.id]
  })
}));

export const bankConnectionsRelations = relations(bankConnections, ({ one }) => ({
  organisation: one(organisations, {
    fields: [bankConnections.orgId],
    references: [organisations.id]
  }),
  bankAccount: one(bankAccounts, {
    fields: [bankConnections.bankAccountId],
    references: [bankAccounts.id]
  }),
}));

export const paymentGatewayTransactionsRelations = relations(paymentGatewayTransactions, ({ one }) => ({
  organisation: one(organisations, {
    fields: [paymentGatewayTransactions.orgId],
    references: [organisations.id]
  }),
  bankAccount: one(bankAccounts, {
    fields: [paymentGatewayTransactions.bankAccountId],
    references: [bankAccounts.id]
  }),
  matchedTransaction: one(bankTransactions, {
    fields: [paymentGatewayTransactions.matchedTransactionId],
    references: [bankTransactions.id]
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [employees.orgId],
    references: [organisations.id]
  }),
  payrollLines: many(payrollLines)
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [payrollRuns.orgId],
    references: [organisations.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [payrollRuns.journalEntryId],
    references: [journalEntries.id]
  }),
  processedByUser: one(users, {
    fields: [payrollRuns.processedBy],
    references: [users.id]
  }),
  lines: many(payrollLines)
}));

export const payrollLinesRelations = relations(payrollLines, ({ one }) => ({
  run: one(payrollRuns, {
    fields: [payrollLines.runId],
    references: [payrollRuns.id]
  }),
  employee: one(employees, {
    fields: [payrollLines.employeeId],
    references: [employees.id]
  })
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [fixedAssets.orgId],
    references: [organisations.id]
  }),
  account: one(accounts, {
    fields: [fixedAssets.accountId],
    references: [accounts.id]
  }),
  assetClass: one(assetClasses, {
    fields: [fixedAssets.assetClassId],
    references: [assetClasses.id]
  }),
  revaluationSurplusAccount: one(accounts, {
    fields: [fixedAssets.revaluationSurplusAccountId],
    references: [accounts.id],
    relationName: 'faRevaluationSurplusAccount'
  }),
  disposalAccount: one(accounts, {
    fields: [fixedAssets.disposalAccountId],
    references: [accounts.id],
    relationName: 'faDisposalAccount'
  }),
  cwipSource: one(fixedAssets, {
    fields: [fixedAssets.cwipSourceId],
    references: [fixedAssets.id],
    relationName: 'cwipSource'
  }),
  cwipDerived: many(fixedAssets, { relationName: 'cwipSource' }),
  depreciationEntries: many(depreciationEntries),
  components: many(assetComponents),
  revaluations: many(revaluationEntries),
  impairments: many(impairmentEntries),
  maintenanceRecords: many(maintenanceRecords),
  transfers: many(assetTransfers)
}));

export const depreciationEntriesRelations = relations(depreciationEntries, ({ one }) => ({
  asset: one(fixedAssets, {
    fields: [depreciationEntries.assetId],
    references: [fixedAssets.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [depreciationEntries.journalEntryId],
    references: [journalEntries.id]
  })
}));

export const assetClassesRelations = relations(assetClasses, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetClasses.orgId],
    references: [organisations.id]
  }),
  glAssetAccount: one(accounts, {
    fields: [assetClasses.glAssetAccountId],
    references: [accounts.id],
    relationName: 'acGlAssetAccount'
  }),
  glDepreciationExpenseAccount: one(accounts, {
    fields: [assetClasses.glDepreciationExpenseAccountId],
    references: [accounts.id],
    relationName: 'acGlDeprExpenseAccount'
  }),
  glAccumDeprAccount: one(accounts, {
    fields: [assetClasses.glAccumDeprAccountId],
    references: [accounts.id],
    relationName: 'acGlAccumDeprAccount'
  }),
  glRevaluationReserveAccount: one(accounts, {
    fields: [assetClasses.glRevaluationReserveAccountId],
    references: [accounts.id],
    relationName: 'acGlRevalReserveAccount'
  }),
  glDisposalProceedsAccount: one(accounts, {
    fields: [assetClasses.glDisposalProceedsAccountId],
    references: [accounts.id],
    relationName: 'acGlDisposalProceedsAccount'
  }),
  glDisposalLossAccount: one(accounts, {
    fields: [assetClasses.glDisposalLossAccountId],
    references: [accounts.id],
    relationName: 'acGlDisposalLossAccount'
  }),
  assets: many(fixedAssets)
}));

export const assetComponentsRelations = relations(assetComponents, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [assetComponents.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [assetComponents.assetId],
    references: [fixedAssets.id]
  }),
  glAssetAccount: one(accounts, {
    fields: [assetComponents.glAssetAccountId],
    references: [accounts.id],
    relationName: 'acompGlAssetAccount'
  }),
  glAccumDeprAccount: one(accounts, {
    fields: [assetComponents.glAccumDeprAccountId],
    references: [accounts.id],
    relationName: 'acompGlAccumDeprAccount'
  }),
  revaluations: many(revaluationEntries),
  impairments: many(impairmentEntries),
  maintenanceRecords: many(maintenanceRecords)
}));

export const revaluationEntriesRelations = relations(revaluationEntries, ({ one }) => ({
  organisation: one(organisations, {
    fields: [revaluationEntries.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [revaluationEntries.assetId],
    references: [fixedAssets.id]
  }),
  component: one(assetComponents, {
    fields: [revaluationEntries.componentId],
    references: [assetComponents.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [revaluationEntries.journalEntryId],
    references: [journalEntries.id]
  }),
  createdByUser: one(users, {
    fields: [revaluationEntries.createdBy],
    references: [users.id]
  })
}));

export const impairmentEntriesRelations = relations(impairmentEntries, ({ one }) => ({
  organisation: one(organisations, {
    fields: [impairmentEntries.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [impairmentEntries.assetId],
    references: [fixedAssets.id]
  }),
  component: one(assetComponents, {
    fields: [impairmentEntries.componentId],
    references: [assetComponents.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [impairmentEntries.journalEntryId],
    references: [journalEntries.id]
  }),
  createdByUser: one(users, {
    fields: [impairmentEntries.createdBy],
    references: [users.id]
  })
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  organisation: one(organisations, {
    fields: [maintenanceRecords.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [maintenanceRecords.assetId],
    references: [fixedAssets.id]
  }),
  component: one(assetComponents, {
    fields: [maintenanceRecords.componentId],
    references: [assetComponents.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [maintenanceRecords.journalEntryId],
    references: [journalEntries.id]
  }),
  createdByUser: one(users, {
    fields: [maintenanceRecords.createdBy],
    references: [users.id]
  })
}));

export const assetTransfersRelations = relations(assetTransfers, ({ one }) => ({
  organisation: one(organisations, {
    fields: [assetTransfers.orgId],
    references: [organisations.id]
  }),
  asset: one(fixedAssets, {
    fields: [assetTransfers.assetId],
    references: [fixedAssets.id]
  }),
  authorizedByUser: one(users, {
    fields: [assetTransfers.authorizedBy],
    references: [users.id],
    relationName: 'atAuthorizedBy'
  }),
  createdByUser: one(users, {
    fields: [assetTransfers.createdBy],
    references: [users.id],
    relationName: 'atCreatedBy'
  })
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [documents.orgId],
    references: [organisations.id]
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id]
  })
}));

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [budgets.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [budgets.createdBy],
    references: [users.id]
  }),
  lines: many(budgetLines)
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetLines.budgetId],
    references: [budgets.id]
  }),
  account: one(accounts, {
    fields: [budgetLines.accountId],
    references: [accounts.id]
  })
}));

export const accountingRulesRelations = relations(accountingRules, ({ one }) => ({
  organisation: one(organisations, {
    fields: [accountingRules.orgId],
    references: [organisations.id]
  }),
  account: one(accounts, {
    fields: [accountingRules.accountId],
    references: [accounts.id]
  })
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organisation: one(organisations, {
    fields: [auditLog.orgId],
    references: [organisations.id]
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id]
  })
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [chatConversations.orgId],
    references: [organisations.id]
  }),
  participants: many(chatConversationParticipants),
  messages: many(chatMessages),
}));

export const chatConversationParticipantsRelations = relations(chatConversationParticipants, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatConversationParticipants.conversationId],
    references: [chatConversations.id]
  }),
  user: one(users, {
    fields: [chatConversationParticipants.userId],
    references: [users.id]
  }),
}));

export const chatReadMarkersRelations = relations(chatReadMarkers, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatReadMarkers.conversationId],
    references: [chatConversations.id]
  }),
  user: one(users, {
    fields: [chatReadMarkers.userId],
    references: [users.id]
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  organisation: one(organisations, {
    fields: [chatMessages.orgId],
    references: [organisations.id]
  }),
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id]
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id]
  }),
}));

export const currencyRatesRelations = relations(currencyRates, ({ one }) => ({
  organisation: one(organisations, {
    fields: [currencyRates.orgId],
    references: [organisations.id]
  })
}));

// ── IFRS 15 Revenue Recognition Relations ──

export const revenueContractsRelations = relations(revenueContracts, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [revenueContracts.orgId],
    references: [organisations.id]
  }),
  customer: one(contacts, {
    fields: [revenueContracts.customerId],
    references: [contacts.id]
  }),
  project: one(projects, {
    fields: [revenueContracts.projectId],
    references: [projects.id]
  }),
  creator: one(users, {
    fields: [revenueContracts.createdBy],
    references: [users.id]
  }),
  performanceObligations: many(performanceObligations),
}));

export const performanceObligationsRelations = relations(performanceObligations, ({ one, many }) => ({
  contract: one(revenueContracts, {
    fields: [performanceObligations.contractId],
    references: [revenueContracts.id]
  }),
  revenueAccount: one(accounts, {
    fields: [performanceObligations.revenueAccountId],
    references: [accounts.id]
  }),
  deferredRevenueAccount: one(accounts, {
    fields: [performanceObligations.deferredRevenueAccountId],
    references: [accounts.id]
  }),
  contractAssetAccount: one(accounts, {
    fields: [performanceObligations.contractAssetAccountId],
    references: [accounts.id]
  }),
  schedules: many(revenueSchedules),
  recognitionEntries: many(revenueRecognitionEntries),
}));

export const revenueSchedulesRelations = relations(revenueSchedules, ({ one, many }) => ({
  obligation: one(performanceObligations, {
    fields: [revenueSchedules.obligationId],
    references: [performanceObligations.id]
  }),
  recognitionEntries: many(revenueRecognitionEntries),
}));

export const revenueRecognitionEntriesRelations = relations(revenueRecognitionEntries, ({ one }) => ({
  schedule: one(revenueSchedules, {
    fields: [revenueRecognitionEntries.scheduleId],
    references: [revenueSchedules.id]
  }),
  obligation: one(performanceObligations, {
    fields: [revenueRecognitionEntries.obligationId],
    references: [performanceObligations.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [revenueRecognitionEntries.journalEntryId],
    references: [journalEntries.id]
  }),
  creator: one(users, {
    fields: [revenueRecognitionEntries.createdBy],
    references: [users.id]
  }),
}));

// ── IFRS 16 Lease Accounting Relations ──

export const leasesRelations = relations(leases, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [leases.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [leases.createdBy],
    references: [users.id]
  }),
  rouAssetAccount: one(accounts, {
    fields: [leases.rouAssetAccountId],
    references: [accounts.id]
  }),
  accumDepreciationAccount: one(accounts, {
    fields: [leases.accumDepreciationAccountId],
    references: [accounts.id]
  }),
  depreciationExpenseAccount: one(accounts, {
    fields: [leases.depreciationExpenseAccountId],
    references: [accounts.id]
  }),
  leaseLiabilityAccount: one(accounts, {
    fields: [leases.leaseLiabilityAccountId],
    references: [accounts.id]
  }),
  paymentSchedules: many(leasePaymentSchedules),
  journalEntries: many(leaseJournalEntries),
}));

export const leasePaymentSchedulesRelations = relations(leasePaymentSchedules, ({ one }) => ({
  lease: one(leases, {
    fields: [leasePaymentSchedules.leaseId],
    references: [leases.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [leasePaymentSchedules.journalEntryId],
    references: [journalEntries.id]
  }),
}));

export const leaseJournalEntriesRelations = relations(leaseJournalEntries, ({ one }) => ({
  lease: one(leases, {
    fields: [leaseJournalEntries.leaseId],
    references: [leases.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [leaseJournalEntries.journalEntryId],
    references: [journalEntries.id]
  }),
}));

// ── IFRS 9 ECL Relations ──

export const eclParametersRelations = relations(eclParameters, ({ one }) => ({
  organisation: one(organisations, {
    fields: [eclParameters.orgId],
    references: [organisations.id]
  }),
}));

export const eclComputationsRelations = relations(eclComputations, ({ one }) => ({
  organisation: one(organisations, {
    fields: [eclComputations.orgId],
    references: [organisations.id]
  }),
  creator: one(users, {
    fields: [eclComputations.createdBy],
    references: [users.id]
  }),
  journalEntry: one(journalEntries, {
    fields: [eclComputations.journalEntryId],
    references: [journalEntries.id]
  }),
}));

// ==========================================
// 4. DATABASE INITIALIZATION & INSTANCE
// ==========================================

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, {
  schema: {
    organisations,
    users,
    sessions,
    accounts,
    journalEntries,
    journalLines,
    contacts,
    items,
    inventoryAdjustmentItems,
    inventoryAdjustments,
    inventoryLots,
    inventoryStockCountItems,
    inventoryStockCounts,
    inventoryTransactions,
    inventoryTransferItems,
    inventoryTransfers,
    inventoryWriteoffItems,
    inventoryWriteoffs,
    landedCostAllocations,
    landedCosts,
    quotes,
    salesOrders,
    recurringInvoices,
    invoices,
    invoiceLines,
    paymentsReceived,
    paymentAllocations,
    creditNotes,
    purchaseOrders,
    bills,
    billLines,
    paymentsMade,
    paymentMadeAllocations,
    vendorCredits,
    expenses,
    projects,
    bankAccounts,
    bankTransactions,
    bankRules,
    bankConnections,
    paymentGatewayTransactions,
    employees,
    payrollRuns,
    payrollLines,
    fixedAssets,
    depreciationEntries,
    assetClasses,
    assetComponents,
    revaluationEntries,
    impairmentEntries,
    maintenanceRecords,
    assetTransfers,
    documents,
    budgets,
    budgetLines,
    auditLog,
    accountingRules,
    ocrDocuments,
    chatConversations,
    chatConversationParticipants,
    chatMessages,
    chatReadMarkers,
    currencyRates,
    closedPeriods,
    vatPeriods,
    vatReturnLines,
    taxConfigurations,
    capitalAllowanceSchedule,
    taxLosses,
    taxComputations,
    legacyIncomeStatements,
    legacyCashFlowStatements,
    legacyStatementsOfChangesInEquity,

    // Relations
    organisationsRelations,
    usersRelations,
    sessionsRelations,
    accountsRelations,
    journalEntriesRelations,
    journalLinesRelations,
    contactsRelations,
    itemsRelations,
    inventoryLotsRelations,
    inventoryStockCountItemsRelations,
    inventoryStockCountsRelations,
    inventoryTransactionsRelations,
    inventoryTransferItemsRelations,
    inventoryTransfersRelations,
    inventoryWriteoffItemsRelations,
    inventoryWriteoffsRelations,
    landedCostAllocationsRelations,
    landedCostsRelations,
    quotesRelations,
    salesOrdersRelations,
    recurringInvoicesRelations,
    invoicesRelations,
    invoiceLinesRelations,
    paymentsReceivedRelations,
    paymentAllocationsRelations,
    creditNotesRelations,
    purchaseOrdersRelations,
    billsRelations,
    billLinesRelations,
    paymentsMadeRelations,
    paymentMadeAllocationsRelations,
    vendorCreditsRelations,
    expensesRelations,
    bankAccountsRelations,
    bankTransactionsRelations,
    bankRulesRelations,
    bankConnectionsRelations,
    paymentGatewayTransactionsRelations,
    employeesRelations,
    payrollRunsRelations,
    payrollLinesRelations,
    fixedAssetsRelations,
    depreciationEntriesRelations,
    assetClassesRelations,
    assetComponentsRelations,
    revaluationEntriesRelations,
    impairmentEntriesRelations,
    maintenanceRecordsRelations,
    assetTransfersRelations,
    documentsRelations,
    budgetsRelations,
    budgetLinesRelations,
    auditLogRelations,
    accountingRulesRelations,
    ocrDocumentsRelations,
    chatConversationsRelations,
    chatConversationParticipantsRelations,
    chatMessagesRelations,
    chatReadMarkersRelations,
    currencyRatesRelations,
    closedPeriodsRelations,
    taxConfigurationsRelations,
    capitalAllowanceScheduleRelations,
    taxLossesRelations,
    taxComputationsRelations,
    revenueContractsRelations,
    performanceObligationsRelations,
    revenueSchedulesRelations,
    revenueRecognitionEntriesRelations,
    leasesRelations,
    leasePaymentSchedulesRelations,
    leaseJournalEntriesRelations,
    eclParametersRelations,
    eclComputationsRelations,
  }
});

export type DrizzleDB = typeof db;

// ==========================================
// 5. SCHEMA OBJECT EXPORT GROUPING ALL TABLES
// ==========================================

export const schema = {
  organisations,
  users,
  sessions,
  accounts,
  journalEntries,
  journalLines,
  contacts,
  items,
  inventoryLots,
  inventoryStockCountItems,
  inventoryStockCounts,
  inventoryTransactions,
  inventoryTransferItems,
  inventoryTransfers,
  inventoryWriteoffItems,
  inventoryWriteoffs,
  landedCostAllocations,
  landedCosts,
  quotes,
  salesOrders,
  recurringInvoices,
  invoices,
  invoiceLines,
  paymentsReceived,
  paymentAllocations,
  creditNotes,
  purchaseOrders,
  bills,
  billLines,
  paymentsMade,
  paymentMadeAllocations,
  vendorCredits,
  expenses,
  projects,
  bankAccounts,
  bankTransactions,
  bankRules,
  bankConnections,
  paymentGatewayTransactions,
  employees,
    payrollRuns,
  payrollLines,
  fixedAssets,
  depreciationEntries,
  assetClasses,
  assetComponents,
  revaluationEntries,
  impairmentEntries,
  maintenanceRecords,
  assetTransfers,
  documents,
  budgets,
  budgetLines,
  auditLog,
  accountingRules,
  chatConversations,
  chatConversationParticipants,
  chatMessages,
  chatReadMarkers,
  currencyRates,
  closedPeriods,
  taxConfigurations,
  capitalAllowanceSchedule,
  taxLosses,
  taxComputations,
  legacyIncomeStatements,
  legacyCashFlowStatements,
  legacyStatementsOfChangesInEquity,
  emailSettings,
  reportSectionMappings,
  financialNotes,
  revenueContracts,
  performanceObligations,
  revenueSchedules,
  revenueRecognitionEntries,
  leases,
  leasePaymentSchedules,
  leaseJournalEntries,
   eclParameters,
  eclComputations,
  approvalWorkflows,
  approvalHistory,
  ocrDocuments,
};


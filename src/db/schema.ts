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
  'opening_balance'
]);

export const contactTypeEnum = pgEnum('contact_type', ['customer', 'vendor', 'both']);

export const itemTypeEnum = pgEnum('item_type', ['product', 'service']);

export const inventoryTxnTypeEnum = pgEnum('inventory_txn_type', [
  'purchase',
  'sale',
  'adjustment',
  'transfer'
]);

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
  'biweekly'
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
  'fully_depreciated'
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
  createdBy: uuid('created_by').references(() => users.id).notNull(),
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
  trackInventory: boolean('track_inventory').default(false).notNull(),
  reorderPoint: integer('reorder_point'),
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
  amountPaid: bigint('amount_paid', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).default(0).notNull(),
  paymentTerms: integer('payment_terms'),
  notes: text('notes'),
  terms: text('terms'),
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
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  incomeAccountId: uuid('income_account_id').references(() => accounts.id),
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
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
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
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  notes: text('notes'),
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
  amountPaid: bigint('amount_paid', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).default(0).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
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
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  reference: text('reference'),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
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
  subtotal: bigint('subtotal', { mode: 'number' }).default(0).notNull(),
  tax: bigint('tax', { mode: 'number' }).default(0).notNull(),
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
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
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  reference: text('reference'),
  description: text('description'),
  receiptUrl: text('receipt_url'),
  isBillable: boolean('is_billable').default(false).notNull(),
  customerId: uuid('customer_id').references(() => contacts.id),
  recurringId: uuid('recurring_id'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
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
  monoAccountId: text('mono_account_id'),
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
  purchaseDate: timestamp('purchase_date').notNull(),
  purchaseCost: bigint('purchase_cost', { mode: 'number' }).notNull(),
  accumulatedDepreciation: bigint('accumulated_depreciation', { mode: 'number' }).default(0).notNull(),
  bookValue: bigint('book_value', { mode: 'number' }).notNull(),
  depreciationMethod: depreciationMethodEnum('depreciation_method').notNull(),
  usefulLifeMonths: integer('useful_life_months').notNull(),
  residualValue: bigint('residual_value', { mode: 'number' }).default(0).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  disposalDate: timestamp('disposal_date'),
  disposalAmount: bigint('disposal_amount', { mode: 'number' }),
  status: fixedAssetStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const depreciationEntries = pgTable('depreciation_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => fixedAssets.id).notNull(),
  periodDate: timestamp('period_date').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

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
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull()
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
  employees: many(employees),
  payrollRuns: many(payrollRuns),
  fixedAssets: many(fixedAssets),
  documents: many(documents),
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
  depreciationEntries: many(depreciationEntries)
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
  depreciationEntries: many(depreciationEntries)
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

export const currencyRatesRelations = relations(currencyRates, ({ one }) => ({
  organisation: one(organisations, {
    fields: [currencyRates.orgId],
    references: [organisations.id]
  })
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
    inventoryLots,
    inventoryTransactions,
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
    bankAccounts,
    bankTransactions,
    bankRules,
    employees,
    payrollRuns,
    payrollLines,
    fixedAssets,
    depreciationEntries,
    documents,
    budgets,
    budgetLines,
    auditLog,
    currencyRates,

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
    inventoryTransactionsRelations,
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
    employeesRelations,
    payrollRunsRelations,
    payrollLinesRelations,
    fixedAssetsRelations,
    depreciationEntriesRelations,
    documentsRelations,
    budgetsRelations,
    budgetLinesRelations,
    auditLogRelations,
    currencyRatesRelations
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
  inventoryTransactions,
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
  bankAccounts,
  bankTransactions,
  bankRules,
  employees,
  payrollRuns,
  payrollLines,
  fixedAssets,
  depreciationEntries,
  documents,
  budgets,
  budgetLines,
  auditLog,
  currencyRates
};


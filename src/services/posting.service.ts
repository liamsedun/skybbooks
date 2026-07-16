/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, and, sql } from 'drizzle-orm';
import { db, accounts, journalEntries, accountingRules } from '../db/schema';
import { AppError } from '../lib/errors';
import { createJournalEntry, type CreateJournalEntryInput, type JournalLineInput } from './ledger.service';

// ==========================================
// 1. TYPES
// ==========================================

export type PostToGLParams = {
  orgId: string;
  date: Date;
  description: string;
  reference?: string;
  source: CreateJournalEntryInput['source'];
  sourceId?: string;
  projectId?: string;
  createdBy: string;
  lines: JournalLineInput[];
  currency?: string;
  fxRate?: number;
};

/**
 * Describes the expected DR/CR structure for a transaction type's posting template.
 * Used for documentation, validation hints, and frontend display.
 */
export type PostingTemplateLine = {
  side: 'debit' | 'credit';
  accountRole?: string;
  description: string;
};

export type PostingTemplate = {
  source: string;
  name: string;
  description: string;
  lines: PostingTemplateLine[];
};

/**
 * Registry of standard posting templates for all transaction types.
 * Each template documents which accounts are DR'd and CR'd.
 */
export const POSTING_TEMPLATES: PostingTemplate[] = [
  {
    source: 'invoice',
    name: 'Sales Invoice',
    description: 'DR Accounts Receivable, CR Revenue (by line), CR VAT Payable, CR WHT Payable',
    lines: [
      { side: 'debit', accountRole: 'accounts_receivable', description: 'Total invoice amount' },
      { side: 'credit', accountRole: 'none', description: 'Revenue per invoice line (fixed account from item)' },
      { side: 'credit', accountRole: 'vat_payable', description: 'VAT on taxable lines' },
    ],
  },
  {
    source: 'bill',
    name: 'Vendor Bill',
    description: 'DR Expense (by line), DR VAT Receivable, CR Accounts Payable, CR WHT Payable',
    lines: [
      { side: 'debit', accountRole: 'none', description: 'Expense per bill line (fixed account from item)' },
      { side: 'debit', accountRole: 'vat_receivable', description: 'Input VAT on taxable lines' },
      { side: 'credit', accountRole: 'accounts_payable', description: 'Total bill amount' },
    ],
  },
  {
    source: 'payment',
    name: 'Payment Received / Made',
    description: 'DR Bank, CR AR (sales) or DR Bank, CR Income (other income); DR AP, CR Bank (payments made)',
    lines: [
      { side: 'debit', accountRole: 'bank', description: 'Amount received' },
      { side: 'credit', accountRole: 'accounts_receivable', description: 'Invoice payment allocation' },
    ],
  },
  {
    source: 'payroll',
    name: 'Payroll Run',
    description: 'DR Salary/Wage Expense, DR PAYE Expense, DR NHIS Employer, CR Salary Clearing, CR PAYE Payable, CR Pension Payable, CR NHIS Payable',
    lines: [
      { side: 'debit', accountRole: 'none', description: 'Salary/wage expense (fixed account from org config)' },
      { side: 'credit', accountRole: 'payroll_clearing', description: 'Net salary clearing' },
      { side: 'credit', accountRole: 'paye_payable', description: 'PAYE withholding' },
    ],
  },
  {
    source: 'bank_feed',
    name: 'Bank Feed Match',
    description: 'DR/CR between Bank and matched GL account per feed transaction',
    lines: [
      { side: 'debit', accountRole: 'bank', description: 'Bank feed amount (receipt)' },
      { side: 'credit', accountRole: 'none', description: 'Matched GL account (expense/income/liability)' },
    ],
  },
  {
    source: 'opening_balance',
    name: 'Opening Balance',
    description: 'DR Asset/Expense accounts, CR Liability/Equity/Revenue accounts, balanced with Retained Earnings',
    lines: [
      { side: 'debit', accountRole: 'none', description: 'Asset/expense opening balances' },
      { side: 'credit', accountRole: 'none', description: 'Liability/equity/revenue opening balances' },
    ],
  },
  {
    source: 'opening_stock',
    name: 'Opening Stock',
    description: 'DR Inventory, CR Retained Earnings',
    lines: [
      { side: 'debit', accountRole: 'inventory', description: 'Opening stock value' },
      { side: 'credit', accountRole: 'retained_earnings', description: 'Contra entry' },
    ],
  },
  {
    source: 'inventory_adjustment',
    name: 'Inventory Adjustment',
    description: 'DR/CR Inventory ↔ P&L adjustment account (increase or decrease)',
    lines: [
      { side: 'debit', accountRole: 'inventory', description: 'Increase in inventory value' },
      { side: 'credit', accountRole: 'none', description: 'Offset to adjustment P&L account' },
    ],
  },
  {
    source: 'transfer',
    name: 'Bank Transfer',
    description: 'DR Destination Bank, CR Source Bank',
    lines: [
      { side: 'debit', accountRole: 'bank', description: 'Destination bank increase' },
      { side: 'credit', accountRole: 'bank', description: 'Source bank decrease' },
    ],
  },
  {
    source: 'vat_settlement',
    name: 'VAT Settlement',
    description: 'DR/CR between VAT Payable, VAT Receivable, and Bank',
    lines: [
      { side: 'debit', accountRole: 'vat_payable', description: 'Output VAT liability reduction' },
      { side: 'credit', accountRole: 'bank', description: 'Payment to tax authority' },
    ],
  },
  {
    source: 'tax_provision',
    name: 'Tax Provision',
    description: 'DR CIT Expense, CR CIT Payable + deferred tax adjustments',
    lines: [
      { side: 'debit', accountRole: 'none', description: 'Income tax expense' },
      { side: 'credit', accountRole: 'none', description: 'Income tax payable / deferred tax liability' },
    ],
  },
  {
    source: 'loan',
    name: 'Loan (Borrowing)',
    description: 'DR Bank, CR Loan Payable',
    lines: [
      { side: 'debit', accountRole: 'bank', description: 'Loan proceeds received' },
      { side: 'credit', accountRole: 'none', description: 'Loan payable (liability to lender)' },
    ],
  },
  {
    source: 'owner_capital',
    name: 'Owner Capital Contribution',
    description: 'DR Bank, CR Share Capital / Owners Equity',
    lines: [
      { side: 'debit', accountRole: 'bank', description: 'Capital contribution amount' },
      { side: 'credit', accountRole: 'retained_earnings', description: 'Equity increase from owner capital' },
    ],
  },
  {
    source: 'owner_drawings',
    name: 'Owner Drawings',
    description: 'DR Drawings / Retained Earnings, CR Bank',
    lines: [
      { side: 'debit', accountRole: 'retained_earnings', description: 'Drawings reduction of equity' },
      { side: 'credit', accountRole: 'bank', description: 'Cash withdrawn by owner' },
    ],
  },
  {
    source: 'manual',
    name: 'Manual Journal',
    description: 'User-defined DR/CR lines',
    lines: [
      { side: 'debit', accountRole: 'none', description: 'User-defined debit account(s)' },
      { side: 'credit', accountRole: 'none', description: 'User-defined credit account(s)' },
    ],
  },
];

export function getPostingTemplate(source: string): PostingTemplate | undefined {
  return POSTING_TEMPLATES.find(t => t.source === source);
}

export type AccountingRule = {
  id: string;
  orgId: string;
  name: string;
  source: string;
  eventType?: string | null;
  accountRole?: string | null;
  accountId?: string | null;
  priority: number;
  isActive: boolean;
};

// ==========================================
// 2. DUPLICATE POSTING PREVENTION
// ==========================================

/**
 * Checks if a journal entry already exists for the given source + sourceId.
 * Throws 409 if a duplicate is found.
 */
async function checkDuplicate(
  orgId: string,
  source: string,
  sourceId: string | undefined,
  tx?: any
): Promise<void> {
  if (!sourceId) return;

  const client = tx || db;
  const [existing] = await client
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        eq(journalEntries.source, source as any),
        eq(journalEntries.sourceId, sourceId),
        eq(journalEntries.isReversed, false)
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError(
      `Journal entry already exists for ${source} ${sourceId} (JE: ${existing.id}).`,
      409
    );
  }
}

// ==========================================
// 3. BALANCE VALIDATION
// ==========================================

/**
 * Validates that journal lines are balanced (total debits === total credits)
 * and each line has valid amounts.
 */
function validateBalanced(lines: JournalLineInput[]): void {
  if (!lines || lines.length < 2) {
    throw new AppError('A valid journal entry must contain at least 2 lines.', 400);
  }

  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of lines) {
    const debit = line.debit || 0;
    const credit = line.credit || 0;

    if (debit < 0 || credit < 0) {
      throw new AppError('Debit and credit amounts must be non-negative integers representing Kobo.', 400);
    }
    if (debit > 0 && credit > 0) {
      throw new AppError('A single journal line cannot contain both a debit and a credit amount.', 400);
    }
    if (debit === 0 && credit === 0) {
      throw new AppError('Each journal line must specify either a non-zero debit or credit amount.', 400);
    }

    totalDebits += debit;
    totalCredits += credit;
  }

  if (totalDebits !== totalCredits) {
    throw new AppError(
      `Journal entry is out of balance. Total debits (${totalDebits} kobo) must exactly match total credits (${totalCredits} kobo).`,
      400
    );
  }
}

// ==========================================
// 4. ACCOUNT RESOLUTION
// ==========================================

/**
 * Resolves an account ID by system role for a given org.
 * Checks configurable posting rules first, then falls back to system_account_role.
 */
export async function resolveAccountByRole(
  orgId: string,
  role: string,
  source?: string,
  tx?: any
): Promise<string> {
  const client = tx || db;

  // 1. Check configurable posting rules first
  if (source) {
    const rules = await client
      .select()
      .from(accountingRules)
      .where(
        and(
          eq(accountingRules.orgId, orgId),
          eq(accountingRules.source, source),
          eq(accountingRules.accountRole, role),
          eq(accountingRules.isActive, true)
        )
      )
      .orderBy(accountingRules.priority)
      .limit(1);

    if (rules.length > 0 && rules[0].accountId) {
      return rules[0].accountId;
    }
  }

  // 2. Fall back to system_account_role on accounts table
  const [acct] = await client
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.orgId, orgId),
        eq(accounts.systemAccountRole, role as any),
        eq(accounts.isActive, true)
      )
    )
    .limit(1);

  if (acct) return acct.id;

  throw new AppError(
    `No account found for role "${role}" in this organisation. Please configure one in Chart of Accounts.`,
    400
  );
}

/**
 * Resolves all lines in place, replacing accountRole-based markers with real account IDs.
 */
export async function resolveAccounts(
  orgId: string,
  lines: JournalLineInput[],
  source?: string,
  tx?: any
): Promise<JournalLineInput[]> {
  const resolved: JournalLineInput[] = [];

  for (const line of lines) {
    const role = (line as any).accountRole as string | undefined;
    if (role) {
      const realId = await resolveAccountByRole(orgId, role, source, tx);
      resolved.push({
        accountId: realId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        currency: line.currency,
        fxRate: line.fxRate,
      });
    } else {
      resolved.push(line);
    }
  }

  return resolved;
}

// ==========================================
// 5. CONFIGURABLE POSTING RULES
// ==========================================

/**
 * Get all active posting rules for an org, optionally filtered by source.
 */
export async function getPostingRules(
  orgId: string,
  source?: string
): Promise<AccountingRule[]> {
  const conditions: any[] = [eq(accountingRules.orgId, orgId), eq(accountingRules.isActive, true)];
  if (source) conditions.push(eq(accountingRules.source, source));

  const rules = await db
    .select()
    .from(accountingRules)
    .where(and(...conditions))
    .orderBy(accountingRules.priority);

  return rules.map(r => ({
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    source: r.source,
    eventType: r.eventType,
    accountRole: r.accountRole,
    accountId: r.accountId,
    priority: r.priority,
    isActive: r.isActive,
  }));
}

/**
 * Create or update a posting rule.
 */
export async function setPostingRule(
  orgId: string,
  rule: {
    name: string;
    source: string;
    eventType?: string;
    accountRole?: string;
    accountId?: string;
    priority?: number;
  }
): Promise<AccountingRule> {
  const [created] = await db
    .insert(accountingRules)
    .values({
      orgId,
      name: rule.name,
      source: rule.source,
      eventType: rule.eventType || null,
      accountRole: rule.accountRole || null,
      accountId: rule.accountId || null,
      priority: rule.priority || 0,
    })
    .returning();

  return {
    id: created.id,
    orgId: created.orgId,
    name: created.name,
    source: created.source,
    eventType: created.eventType,
    accountRole: created.accountRole,
    accountId: created.accountId,
    priority: created.priority,
    isActive: created.isActive,
  };
}

// ==========================================
// 6. CORE POSTING ENGINE
// ==========================================

/**
 * Central posting engine — the single entry point for all journal creation.
 *
 * Features:
 * - Duplicate posting prevention (checks source + sourceId)
 * - Balance validation
 * - Account role resolution (configurable rules → system roles)
 * - Transaction rollback on failure
 *
 * ALL modules must call this function instead of createJournalEntry() directly.
 */
export async function postToGL(
  params: PostToGLParams,
  tx?: any
): Promise<any> {
  const { orgId, date, description, reference, source, sourceId, projectId, createdBy, lines, currency, fxRate } = params;

  // 1. Check for duplicate posting (inside or outside transaction)
  await checkDuplicate(orgId, source, sourceId, tx);

  // 2. Validate balance
  validateBalanced(lines);

  // 3. Resolve account roles to real account IDs
  const resolvedLines = await resolveAccounts(orgId, lines, source, tx);

  // 4. Check closed period (handled inside createJournalEntry)
  // 5. Create the journal entry
  return await createJournalEntry(
    {
      orgId,
      date,
      description,
      reference,
      source,
      sourceId,
      projectId,
      createdBy,
      lines: resolvedLines,
      currency,
      fxRate,
    },
    tx
  );
}

/**
 * Convenience wrapper: creates a simple 2-line journal entry (one DR, one CR)
 * with automatic account role resolution.
 */
export async function postSimpleEntry(
  params: PostToGLParams & {
    debitAccountRole?: string;
    debitAccountId?: string;
    creditAccountRole?: string;
    creditAccountId?: string;
    amount: number;
    debitDescription?: string;
    creditDescription?: string;
  },
  tx?: any
): Promise<any> {
  const { debitAccountRole, debitAccountId, creditAccountRole, creditAccountId, amount, debitDescription, creditDescription, ...rest } = params;

  const lines: JournalLineInput[] = [];

  if (debitAccountRole || debitAccountId) {
    lines.push({
      accountId: debitAccountId || '',
      accountRole: debitAccountRole as any,
      debit: amount,
      description: debitDescription || rest.description,
    });
  }

  if (creditAccountRole || creditAccountId) {
    lines.push({
      accountId: creditAccountId || '',
      accountRole: creditAccountRole as any,
      credit: amount,
      description: creditDescription || rest.description,
    });
  }

  return await postToGL({ ...rest, lines }, tx);
}

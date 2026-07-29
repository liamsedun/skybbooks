/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { syncHrSchema } from './hr-schema-sync';

export async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.log('[Migration] No DATABASE_URL found, skipping startup migration.');
    return;
  }
  
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL, 
    max: 1,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined
  });
  
  const db = drizzle(pool);
  
  try {
    console.log('[Migration] Verifying database connection and syncing schema...');
    // Validate database connection
    await db.execute('SELECT 1');

    // Create system_account_role enum and add column to accounts table
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE system_account_role AS ENUM (
          'accounts_receivable', 'accounts_payable', 'vat_payable', 'vat_receivable',
          'retained_earnings', 'cogs', 'inventory', 'bank', 'payroll_clearing',
          'paye_payable', 'pension_payable', 'none'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // Add new enum values for existing databases (safe to run even if already present)
    await db.execute(sql`ALTER TYPE system_account_role ADD VALUE IF NOT EXISTS 'wht_receivable'`);
    await db.execute(sql`ALTER TYPE system_account_role ADD VALUE IF NOT EXISTS 'wht_payable'`);

    await db.execute(sql`
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS system_account_role system_account_role DEFAULT 'none' NOT NULL
    `);
    // Assign system roles to standard seeded accounts by code
    await db.execute(sql`UPDATE accounts SET system_account_role = 'accounts_receivable' WHERE code = '101100' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'vat_receivable' WHERE code = '101600' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'inventory' WHERE code IN ('102000','102400') AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'bank' WHERE code IN ('100200','100300') AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'accounts_payable' WHERE code = '300100' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'vat_payable' WHERE code = '301300' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'payroll_clearing' WHERE code = '301500' AND system_account_role != 'payroll_clearing'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'pension_payable' WHERE code = '301600' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'retained_earnings' WHERE code = '502000' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'cogs' WHERE code = '700000' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'wht_receivable' WHERE code = '101500' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'wht_payable' WHERE code = '301400' AND system_account_role = 'none'`);

    // Add payroll-specific accounts (301501 PAYE Payable, 306000 NHIS Payable) if missing
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '301501', 'PAYE Payable', 'liability', 'Current Liabilities',
             'PITA – Employee income tax deducted at source. Remit to State IRS by 10th.', true, true, 'paye_payable'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '301501')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '306000', 'NHIS Payable', 'liability', 'Current Liabilities',
             'NHIS Act – Employee health insurance contributions. Remit to NHIS.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '306000')
    `);

    // Reassign old payroll PAYE lines from 301500 (old PAYE Payable) to 301501 (new PAYE Payable).
    // 301500 is now repurposed as Employee Accrued Salary (Clearing) — old otherDeductions
    // (incl. NHIS) stay on 301500 since they are clearing items.
    await db.execute(sql`
      UPDATE journal_lines jl
      SET account_id = target_acct.id
      FROM journal_entries je, accounts source_acct, accounts target_acct
      WHERE jl.entry_id = je.id
        AND je.source = 'payroll'
        AND jl.account_id = source_acct.id
        AND source_acct.code = '301500'
        AND target_acct.org_id = je.org_id
        AND target_acct.code = '301501'
        AND jl.description ILIKE '%PAYE%'
    `);
    // Rename existing 301500 accounts to Employee Accrued Salary (Clearing)
    await db.execute(sql`UPDATE accounts SET name = 'Employee Accrued Salary (Clearing)', system_account_role = 'payroll_clearing' WHERE code = '301500' AND system_account_role != 'payroll_clearing'`);
    // Rename 800300 from NHF Employer Contribution to NHIS Employer Contribution
    await db.execute(sql`UPDATE accounts SET name = 'NHIS Employer Contribution', description = 'NHIS Act – 10% of basic salary employer health insurance contribution.' WHERE code = '800300'`);
    // Add 800301 PAYE Expense account if missing
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '800301', 'PAYE Expense', 'expense', 'Staff Costs',
             'Pay-As-You-Earn income tax expense on employee salaries.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '800301')
    `);
    // Add nhis_employer column to payroll_lines
    await db.execute(sql`ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS nhis_employer bigint DEFAULT 0 NOT NULL`);

    // Add 207000 Bank Clearing Suspense account for synced bank transactions awaiting reconciliation
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '207000', 'Bank Clearing Suspense', 'asset', 'Current Assets',
             'Temporary clearing account for synced bank transactions awaiting reconciliation.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '207000')
    `);
    // Add related_journal_entry_id column to bank_transactions for tracking sync-created JEs
    await db.execute(sql`ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS related_journal_entry_id uuid REFERENCES journal_entries(id)`);

    // Add WHT columns to invoices and bills
    await db.execute(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wht_rate numeric`);
    await db.execute(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS wht_amount bigint DEFAULT 0 NOT NULL`);
    await db.execute(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS wht_rate numeric`);
    await db.execute(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS wht_amount bigint DEFAULT 0 NOT NULL`);

    // Ensure vendor_credits table has the exact schema needed (drop stale one if it lacks columns)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE vendor_credit_status AS ENUM ('issued', 'applied', 'void');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`DROP TABLE IF EXISTS vendor_credits CASCADE`);
    await db.execute(sql`
      CREATE TABLE vendor_credits (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        vc_number text NOT NULL,
        vendor_id uuid REFERENCES contacts(id) NOT NULL,
        bill_id uuid REFERENCES bills(id),
        date timestamp NOT NULL,
        status vendor_credit_status DEFAULT 'issued' NOT NULL,
        subtotal bigint DEFAULT 0 NOT NULL,
        tax bigint DEFAULT 0 NOT NULL,
        total bigint DEFAULT 0 NOT NULL,
        remaining_credit bigint DEFAULT 0 NOT NULL,
        notes text,
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    // Ensure settings column exists on organisations
    await db.execute(`ALTER TABLE organisations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb NOT NULL`);
    // Ensure avatar_url column exists on users
    await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`);
    // Add 'admin' to user_role enum if not present (PG doesn't support ADD VALUE IF NOT EXISTS)
    await db.execute(`
      DO $$ BEGIN
        ALTER TYPE user_role ADD VALUE 'admin';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // Fix voided bills: set total/subtotal/tax_amount to 0 so they don't skew totals
    const voidFix = await db.execute(`UPDATE bills SET total = 0, subtotal = 0, tax_amount = 0 WHERE status = 'void' AND total != 0`);
    if (voidFix.rowCount && voidFix.rowCount > 0) {
      console.log(`[Migration] Fixed ${voidFix.rowCount} voided bill(s) with non-zero totals.`);
    }
    // Clean up inventory transactions and lots orphaned by voided bills
    const voidTxnCleanup = await db.execute(
      `DELETE FROM inventory_transactions WHERE reference_type = 'bill' AND reference_id IN (SELECT id FROM bills WHERE status = 'void')`
    );
    if (voidTxnCleanup.rowCount && voidTxnCleanup.rowCount > 0) {
      console.log(`[Migration] Removed ${voidTxnCleanup.rowCount} inventory transaction(s) from voided bills.`);
    }
    const voidLotCleanup = await db.execute(
      `DELETE FROM inventory_lots WHERE reference IN (SELECT bill_number FROM bills WHERE status = 'void')`
    );
    if (voidLotCleanup.rowCount && voidLotCleanup.rowCount > 0) {
      console.log(`[Migration] Removed ${voidLotCleanup.rowCount} inventory lot(s) from voided bills.`);
    }
    // Add opening_balance to journal_source enum
    await db.execute(`
      DO $$ BEGIN
        ALTER TYPE journal_source ADD VALUE 'opening_balance';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // Add opening_balance column to accounts
    await db.execute(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance bigint DEFAULT 0 NOT NULL`);
    // Add no_depreciation to depreciation_method enum
    await db.execute(`
      DO $$ BEGIN
        ALTER TYPE depreciation_method ADD VALUE 'no_depreciation';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // Clear opening balances on P&L accounts (expense/revenue) — opening balances only valid for balance sheet accounts
    // NOTE: "type" is an enum (accountTypeEnum), must cast to text for LOWER()
    const plFix = await db.execute(`UPDATE accounts SET opening_balance = 0 WHERE LOWER("type"::text) IN ('expense', 'revenue') AND opening_balance != 0`);
    if (plFix.rowCount && plFix.rowCount > 0) {
      console.log(`[Migration] Cleared opening balances on ${plFix.rowCount} P&L account(s).`);
    }
    // Diagnostic: check account 700000 state
    const acct700k = await db.execute(`SELECT id, code, name, "type", opening_balance FROM accounts WHERE code = '700000'`);
    console.log('[Migration] Account 700000:', JSON.stringify(acct700k.rows));
    // Diagnostic: count journal lines for account 700000 by source
    const lines700k = await db.execute(`SELECT je.source, COUNT(jl.*) as line_count, SUM(jl.debit_amount) as total_debit, SUM(jl.credit_amount) as total_credit FROM journal_lines jl JOIN journal_entries je ON jl.entry_id = je.id JOIN accounts a ON jl.account_id = a.id WHERE a.code = '700000' GROUP BY je.source`);
    console.log('[Migration] Lines for 700000:', JSON.stringify(lines700k.rows));
    // Direct hard cleanup for account 700000 (Cost of Sales) — bypasses enum comparisons entirely
    const cosForce = await db.execute(`UPDATE accounts SET opening_balance = 0 WHERE code = '700000'`);
    if (cosForce.rowCount && cosForce.rowCount > 0) {
      console.log(`[Migration] Force-zeroed opening_balance for account 700000.`);
    }
    const cosLineDel = await db.execute(`DELETE FROM journal_lines WHERE account_id = (SELECT id FROM accounts WHERE code = '700000' LIMIT 1)`);
    if (cosLineDel.rowCount && cosLineDel.rowCount > 0) {
      console.log(`[Migration] Deleted ${cosLineDel.rowCount} journal line(s) for account 700000.`);
    }
    // Delete ALL journal lines for P&L accounts related to opening balance entries
    const lineDel = await db.execute(`DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source = 'opening_balance') AND account_id IN (SELECT id FROM accounts WHERE LOWER("type"::text) IN ('expense', 'revenue'))`);
    if (lineDel.rowCount && lineDel.rowCount > 0) {
      console.log(`[Migration] Deleted ${lineDel.rowCount} P&L opening balance journal line(s).`);
    }
    // Delete orphaned opening balance entries with no remaining lines
    const entryDel = await db.execute(`DELETE FROM journal_entries WHERE source = 'opening_balance' AND id NOT IN (SELECT DISTINCT entry_id FROM journal_lines)`);
    if (entryDel.rowCount && entryDel.rowCount > 0) {
      console.log(`[Migration] Deleted ${entryDel.rowCount} orphaned opening balance journal entr(ies).`);
    }
    // Ensure middle_name column exists on employees (added after initial schema)
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS middle_name text`);
    // Add new payroll calculation columns
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pensionable_portion_pct integer DEFAULT 80 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS pension_rate_pct integer DEFAULT 8 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS nhis_applicable boolean DEFAULT false NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS nhf_applicable boolean DEFAULT true NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_rent bigint DEFAULT 0 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_mortgage_interest bigint DEFAULT 0 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_life_assurance bigint DEFAULT 0 NOT NULL`);
    // Add nhis and internal_deductions to payroll_lines
    await db.execute(`ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS nhis bigint DEFAULT 0 NOT NULL`);
    await db.execute(`ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS internal_deductions jsonb DEFAULT '[]'::jsonb NOT NULL`);
    // Add salary breakdown percentage columns to employees
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_salary_pct integer DEFAULT 50 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS housing_pct integer DEFAULT 20 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS transport_pct integer DEFAULT 10 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS utilities_pct integer DEFAULT 10 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS meals_pct integer DEFAULT 5 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS others_pct integer DEFAULT 5 NOT NULL`);
    await db.execute(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS address text`);
    // Deactivate existing SUSPENSE accounts (feature removed)
    await db.execute(`UPDATE accounts SET is_active = false, is_system = false WHERE code = 'SUSPENSE'`);
    // Ensure Trade Creditors / Accounts Payable (300100) exists for all orgs
    await db.execute(sql`
      INSERT INTO accounts (org_id, code, name, type, sub_type, description, is_system, is_active, opening_balance)
      SELECT o.id, '300100', 'Trade Creditors / Accounts Payable', 'liability', 'Current Liabilities', 'IFRS 9 / IAS 1 – Outstanding supplier invoices.', true, true, 0
      FROM organisations o
      WHERE NOT EXISTS (
        SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '300100'
      )
    `);
    // Move existing bill journal lines from 300000 (Trade & Other Payables) to 300100 (Trade Creditors / Accounts Payable)
    await db.execute(sql`
      UPDATE journal_lines jl
      SET account_id = target.id
      FROM accounts target, accounts source, journal_entries je
      WHERE source.org_id = target.org_id
        AND source.code = '300000'
        AND target.code = '300100'
        AND jl.account_id = source.id
        AND je.id = jl.entry_id
        AND je.source = 'bill'
    `);
    // Ensure closed_periods table exists (accounting period closure tracking)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS closed_periods (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        closed_at timestamp DEFAULT now() NOT NULL,
        closed_by uuid REFERENCES users(id) NOT NULL
      );
    `);
    // Add bank_account_id to payroll_runs for user-selected disbursement bank account
    await db.execute(`ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES bank_accounts(id)`);
    // Add accrued_salary_account_id to payroll_runs for accrual-based net pay parking
    await db.execute(`ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS accrued_salary_account_id uuid REFERENCES accounts(id)`);
    // Add 'opening_stock' to journal_source enum for inventory opening stock journal entries
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE journal_source ADD VALUE 'opening_stock';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // Add customer_code to contacts for auto-generated CS-XXXX identifiers
    await db.execute(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_code text`);
    // Merge duplicate customers by name within each org (prevented by POST /customers now)
    const dupes = await db.execute(`
      SELECT c1.org_id, c1.name, c1.id as keep_id, c2.id as dup_id, c2.balance as dup_balance, c2.customer_code as dup_code
      FROM contacts c1
      JOIN contacts c2 ON c1.org_id = c2.org_id AND c1.name = c2.name AND c1.type = 'customer' AND c2.type = 'customer'
      WHERE c1.customer_code < c2.customer_code
    `);
    if (dupes.rows.length > 0) {
      console.log(`[Migration] Found ${dupes.rows.length} duplicate customer pair(s). Merging...`);
      for (const row of dupes.rows) {
        const keepId = row.keep_id;
        const dupId = row.dup_id;
        const dupBalance = Number(row.dup_balance || 0);
        // Add duplicate balance to the kept customer
        if (dupBalance !== 0) {
          await db.execute(sql`UPDATE contacts SET balance = COALESCE(balance, 0) + ${dupBalance} WHERE id = ${keepId}`);
        }
        // Reassign invoices pointing to the duplicate
        await db.execute(sql`UPDATE invoices SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        await db.execute(sql`UPDATE payments_received SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        await db.execute(sql`UPDATE credit_notes SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        await db.execute(sql`UPDATE quotes SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        await db.execute(sql`UPDATE sales_orders SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        await db.execute(sql`UPDATE recurring_invoices SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        await db.execute(sql`UPDATE expenses SET customer_id = ${keepId} WHERE customer_id = ${dupId}`);
        // Delete the duplicate
        await db.execute(sql`DELETE FROM contacts WHERE id = ${dupId}`);
        console.log(`  Merged "${row.name}" (${row.dup_code}) into existing customer.`);
      }
      console.log(`[Migration] Duplicate customer merge complete.`);
    }
    // Recalculate invoices amount_paid/balance_due from actual payment allocations
    // (fixes corruption caused by updateInvoice previously resetting amountPaid to 0 on edit)
    const fixedInvoices = await db.execute(`
      UPDATE invoices SET
        amount_paid = COALESCE(allocs.paid, 0),
        balance_due = invoices.total - COALESCE(allocs.paid, 0),
        status = CASE
          WHEN invoices.status IN ('draft', 'void') THEN invoices.status
          WHEN invoices.total - COALESCE(allocs.paid, 0) <= 0 THEN 'paid'
          WHEN COALESCE(allocs.paid, 0) > 0 THEN 'partial'
          ELSE invoices.status
        END
      FROM (
        SELECT invoice_id, SUM(amount) as paid
        FROM payment_allocations
        GROUP BY invoice_id
      ) allocs
      WHERE invoices.id = allocs.invoice_id
        AND (invoices.amount_paid != COALESCE(allocs.paid, 0) OR invoices.balance_due != invoices.total - COALESCE(allocs.paid, 0))
    `);
    if (fixedInvoices.rowCount && fixedInvoices.rowCount > 0) {
      console.log(`[Migration] Fixed ${fixedInvoices.rowCount} invoice(s) with mismatched amount_paid/balance_due.`);
    }
    // Add new PO status values for approval flow
    await db.execute(sql`ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'confirmed'`);
    await db.execute(sql`ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'accepted'`);
    await db.execute(sql`ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'approved'`);
    console.log('[Migration] Added PO approval statuses (confirmed, accepted, approved).');

    // Add journal_entry_id to payments_made (missing column in production)
    await db.execute(`ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id)`);
    console.log('[Migration] Added journal_entry_id column to payments_made.');

    // Add journal_entry_id to payments_received (missing column in production)
    await db.execute(`ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id)`);
    console.log('[Migration] Added journal_entry_id column to payments_received.');

    // Add opening_balance_date to bank_accounts
    await db.execute(`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance_date timestamp`);
    console.log('[Migration] Added opening_balance_date column to bank_accounts.');

    // Add opening_balance to bank_accounts with copy from current_balance
    await db.execute(`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance bigint DEFAULT 0 NOT NULL`);
    await db.execute(`UPDATE bank_accounts SET opening_balance = current_balance WHERE opening_balance = 0`);
    console.log('[Migration] Added opening_balance column to bank_accounts (seeded from current_balance).');

    // Add fx_rate columns to tables that were missing them
    const fxTables = ['payments_made', 'expenses', 'purchase_orders', 'credit_notes', 'vendor_credits'];
    for (const table of fxTables) {
      const colExists = await db.execute(`
        SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'fx_rate'
      `);
      if ((colExists.rows || []).length === 0) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN fx_rate numeric(18, 8)`);
        console.log(`[Migration] Added fx_rate column to ${table}.`);
      }
    }
    // Also add currency to credit_notes and vendor_credits if missing
    for (const table of ['credit_notes', 'vendor_credits']) {
      const colExists = await db.execute(`
        SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'currency'
      `);
      if ((colExists.rows || []).length === 0) {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN currency text DEFAULT 'NGN' NOT NULL`);
        console.log(`[Migration] Added currency column to ${table}.`);
      }
    }

    // Add transfer to journal_source enum
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'transfer'`);
    console.log('[Migration] Added transfer to journal_source enum.');

    // Create bank_transfers table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_transfers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid REFERENCES organisations(id) NOT NULL,
        transfer_number text NOT NULL,
        from_bank_account_id uuid REFERENCES bank_accounts(id) NOT NULL,
        to_bank_account_id uuid REFERENCES bank_accounts(id) NOT NULL,
        date timestamp NOT NULL,
        amount bigint NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        fx_rate numeric(18,8),
        description text,
        reference text,
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created bank_transfers table.');

    // Backfill bank_transfers from existing transfer journal entries
    await db.execute(sql`
      INSERT INTO bank_transfers (org_id, transfer_number, from_bank_account_id, to_bank_account_id, date, amount, currency, description, journal_entry_id, created_by)
      SELECT
        je.org_id,
        je.entry_number,
        from_ba.id AS from_bank_account_id,
        to_ba.id AS to_bank_account_id,
        je.date,
        jl_credit.credit_amount AS amount,
        'NGN' AS currency,
        je.description,
        je.id AS journal_entry_id,
        je.created_by
      FROM journal_entries je
      INNER JOIN journal_lines jl_credit
        ON jl_credit.entry_id = je.id
       AND jl_credit.debit_amount = 0
       AND jl_credit.credit_amount > 0
      INNER JOIN journal_lines jl_debit
        ON jl_debit.entry_id = je.id
       AND jl_debit.debit_amount > 0
       AND jl_debit.credit_amount = 0
      INNER JOIN bank_accounts from_ba
        ON from_ba.account_id = jl_credit.account_id
      INNER JOIN bank_accounts to_ba
        ON to_ba.account_id = jl_debit.account_id
      WHERE je.source = 'transfer'
        AND NOT EXISTS (
          SELECT 1 FROM bank_transfers bt WHERE bt.journal_entry_id = je.id
        )
    `);
    console.log('[Migration] Backfilled bank_transfers from existing transfer journal entries.');

    // Create projects table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid REFERENCES organisations(id) NOT NULL,
        name text NOT NULL,
        code text,
        description text,
        status text DEFAULT 'active' NOT NULL,
        start_date timestamp,
        end_date timestamp,
        budget bigint DEFAULT 0 NOT NULL,
        custom_fields jsonb DEFAULT '{}',
        created_by uuid,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created projects table.');

    // Add project_id FK columns to transaction tables
    await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE vendor_credits ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)`);
    // Add to journal_entries separately (different column structure)
    await db.execute(sql`
      ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id)
    `);
    console.log('[Migration] Added project_id columns to all transaction tables and journal_entries.');

    // Backfill project_id on journal entries from source transactions
    await db.execute(sql`
      UPDATE journal_entries je
      SET project_id = src.project_id
      FROM (
        SELECT id AS source_id, project_id FROM invoices WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM bills WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM expenses WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM payments_received WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM payments_made WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM credit_notes WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM vendor_credits WHERE project_id IS NOT NULL
        UNION ALL
        SELECT id, project_id FROM purchase_orders WHERE project_id IS NOT NULL
      ) src
      WHERE je.source_id = src.source_id
        AND je.project_id IS NULL
        AND src.project_id IS NOT NULL
    `);
    console.log('[Migration] Backfilled project_id on journal entries from source transactions.');

    // Add customer_id, customer_name, billing_method columns to projects table
    await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES contacts(id)`);
    await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_name text DEFAULT ''`);
    await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS billing_method text DEFAULT 'Fixed Price' NOT NULL`);
    console.log('[Migration] Added customer_id, customer_name, billing_method to projects table.');

    // Create depreciation_entries table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS depreciation_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid REFERENCES fixed_assets(id) NOT NULL,
        period_date timestamp NOT NULL,
        amount bigint NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created depreciation_entries table.');

    // Backfill project_id on existing journal entries from source tables
    await db.execute(sql`
      UPDATE journal_entries je SET project_id = e.project_id
      FROM expenses e
      WHERE je.source = 'manual' AND je.source_id = e.id AND e.project_id IS NOT NULL AND je.project_id IS NULL
    `);
    await db.execute(sql`
      UPDATE journal_entries je SET project_id = b.project_id
      FROM bills b
      WHERE je.source = 'bill' AND je.source_id = b.id AND b.project_id IS NOT NULL AND je.project_id IS NULL
    `);
    await db.execute(sql`
      UPDATE journal_entries je SET project_id = pr.project_id
      FROM payments_received pr
      WHERE je.source = 'payment' AND je.source_id = pr.id AND pr.project_id IS NOT NULL AND je.project_id IS NULL
    `);
    await db.execute(sql`
      UPDATE journal_entries je SET project_id = pm.project_id
      FROM payments_made pm
      WHERE je.source = 'payment' AND je.source_id = pm.id AND pm.project_id IS NOT NULL AND je.project_id IS NULL
    `);
    // Also backfill from invoices (for completeness)
    await db.execute(sql`
      UPDATE journal_entries je SET project_id = i.project_id
      FROM invoices i
      WHERE je.source = 'invoice' AND je.source_id = i.id AND i.project_id IS NOT NULL AND je.project_id IS NULL
    `);
    console.log('[Migration] Backfilled project_id on journal entries from source tables.');

    // Add entry_number to depreciation_entries
    await db.execute(sql`ALTER TABLE depreciation_entries ADD COLUMN IF NOT EXISTS entry_number text`);
    console.log('[Migration] Added entry_number to depreciation_entries.');

    // Backfill payroll_lines.basic where it was stored as 0 (bug: item.calc.basic was undefined; fixed now)
    const fb = await db.execute(sql`UPDATE payroll_lines SET basic = ROUND(gross_pay * 0.5) WHERE basic = 0 AND gross_pay > 0`);
    if (fb.rowCount && fb.rowCount > 0) console.log(`[Migration] Backfilled ${fb.rowCount} payroll_line(s) basic = 50% of gross_pay.`);

    // Create inventory_adjustments tables and enums
    await db.execute(sql`DO $$ BEGIN CREATE TYPE adjustment_mode AS ENUM ('quantity', 'value'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await db.execute(sql`DO $$ BEGIN CREATE TYPE adjustment_status AS ENUM ('draft', 'adjusted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        reference text NOT NULL,
        date timestamp NOT NULL,
        mode adjustment_mode NOT NULL,
        account_id uuid REFERENCES accounts(id),
        reason text,
        location text,
        description text,
        status adjustment_status DEFAULT 'draft' NOT NULL,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_adjustment_items (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        adjustment_id uuid REFERENCES inventory_adjustments(id) NOT NULL,
        item_id uuid REFERENCES items(id) NOT NULL,
        quantity_available numeric NOT NULL,
        new_quantity numeric NOT NULL,
        quantity_adjusted numeric NOT NULL,
        current_unit_cost bigint,
        new_unit_cost bigint,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Inventory adjustments tables created.');

    // Normalise expense account subType values for IFRS income statement grouping
    const subTypeFix = await db.execute(sql`
      UPDATE accounts SET sub_type = 
        CASE sub_type
          WHEN 'Cost of Sales' THEN 'cost_of_sales'
          WHEN 'Administrative Expenses' THEN 'administrative'
          WHEN 'Selling & Distribution' THEN 'selling_distribution'
          WHEN 'Staff Costs' THEN 'staff_costs'
          WHEN 'Finance Costs' THEN 'finance_costs'
          WHEN 'Tax Expense' THEN 'tax_expense'
          WHEN 'Other Operating Expenses' THEN 'other_operating'
          ELSE sub_type
        END
      WHERE "type"::text = 'expense' AND sub_type IS NOT NULL
        AND sub_type IN ('Cost of Sales','Administrative Expenses','Selling & Distribution','Staff Costs','Finance Costs','Tax Expense','Other Operating Expenses')
    `);
    if (subTypeFix.rowCount && subTypeFix.rowCount > 0) {
      console.log(`[Migration] Normalised ${subTypeFix.rowCount} expense account subType values for IFRS income statement.`);
    }

    // Add vat_settlement to journal_source enum
    await db.execute(sql`
      ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'vat_settlement'
    `);

    // ── VAT Engine Migrations ──
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vat_treatment') THEN
          CREATE TYPE vat_treatment AS ENUM ('standard','zero_rated','exempt','blocked','reverse_charge','outside_scope','system');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vat_period_status') THEN
          CREATE TYPE vat_period_status AS ENUM ('draft','reviewed','filed','paid');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vat_return_line_type') THEN
          CREATE TYPE vat_return_line_type AS ENUM ('output','input','adjustment');
        END IF;
      END $$;
    `);
    await db.execute(sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vat_treatment vat_treatment DEFAULT 'standard' NOT NULL`);
    await db.execute(sql`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS vat_amount bigint DEFAULT 0`);
    await db.execute(sql`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS vat_treatment vat_treatment`);
    await db.execute(sql`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS vat_account_id uuid REFERENCES accounts(id)`);
    await db.execute(sql`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS supplier_vat_number text`);
    await db.execute(sql`ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS vat_treatment text DEFAULT 'standard'`);
    await db.execute(sql`ALTER TABLE bill_lines ADD COLUMN IF NOT EXISTS vat_treatment text DEFAULT 'standard'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vat_periods (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        period_label text NOT NULL,
        total_output_vat bigint DEFAULT 0 NOT NULL,
        total_input_vat bigint DEFAULT 0 NOT NULL,
        net_vat_payable bigint DEFAULT 0 NOT NULL,
        excess_input_brought_forward bigint DEFAULT 0 NOT NULL,
        excess_input_carried_forward bigint DEFAULT 0 NOT NULL,
        status vat_period_status DEFAULT 'draft' NOT NULL,
        settlement_journal_entry_id uuid REFERENCES journal_entries(id),
        filed_at timestamp,
        paid_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vat_return_lines (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        vat_period_id uuid REFERENCES vat_periods(id) NOT NULL,
        line_type vat_return_line_type NOT NULL,
        supply_category text NOT NULL,
        gross_amount bigint DEFAULT 0 NOT NULL,
        vat_rate numeric(5,2) DEFAULT 7.5 NOT NULL,
        vat_amount bigint DEFAULT 0 NOT NULL,
        journal_line_ids uuid[] DEFAULT '{}',
        is_recoverable boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    // Seed new VAT accounts for each org
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role, vat_treatment)
      SELECT gen_random_uuid(), o.id, '101650', 'VAT Refund Receivable', 'asset', 'Current Assets', 'VATA – Excess input VAT claimed as refund from FIRS.', true, true, 'none', 'system'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '101650')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role, vat_treatment)
      SELECT gen_random_uuid(), o.id, '812200', 'Irrecoverable VAT Expense', 'expense', 'administrative', 'VATA – Input VAT on exempt/blocked supplies charged to P&L.', true, true, 'none', 'system'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '812200')
    `);
    // Add user_agent column to audit_log if not exists
    await db.execute(sql`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent text`);
    // Create indexes on audit_log for faster queries
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log (org_id, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_org_entity ON audit_log (org_id, entity_type, entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_entity_lookup ON audit_log (org_id, entity_type, entity_id, created_at DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (org_id, user_id)`);

    // Add mono_account_status column to bank_accounts for Mono Connect health tracking
    await db.execute(sql`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS mono_account_status text DEFAULT 'pending'`);
    console.log('[Migration] Added mono_account_status column to bank_accounts.');

    // ── Nigerian Tax Engine Migrations ──

    // Add tax_provision to journal_source enum
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'tax_provision'`);

    // Create tax_size_class, capital_allowance_class, tax_loss_status, tax_computation_status enums
    const taxEnums = [
      ['tax_size_class', ['small', 'medium', 'large']],
      ['capital_allowance_class', ['industrial_building','non_industrial_building','plant_machinery_general','plant_machinery_agric','motor_vehicle','furniture_fittings','computer_it_equipment','intangible_asset']],
      ['tax_loss_status', ['available', 'utilised', 'expired']],
      ['tax_computation_status', ['draft', 'submitted', 'assessed']],
    ];
    for (const [enumName, values] of taxEnums) {
      const vals = (values as string[]).map(v => `'${v}'`).join(', ');
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE ${sql.raw(enumName as string)} AS ENUM (${sql.raw(vals)});
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    // Create tax_configurations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_configurations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        tax_year text NOT NULL,
        size_class tax_size_class,
        incorporation_date timestamp,
        fiscal_year_end text DEFAULT 'Dec 31' NOT NULL,
        pioneer_status boolean DEFAULT false NOT NULL,
        pioneer_start_date timestamp,
        pioneer_end_date timestamp,
        minimum_tax_exempt_reason text,
        nitda_applicable boolean DEFAULT false NOT NULL,
        ppt_applicable boolean DEFAULT false NOT NULL,
        export_exemption boolean DEFAULT false NOT NULL,
        agricultural_exemption boolean DEFAULT false NOT NULL,
        foreign_equity_exemption boolean DEFAULT false NOT NULL,
        first_four_years_exemption boolean DEFAULT false NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created tax_configurations table.');

    // Create capital_allowance_schedule table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS capital_allowance_schedule (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        tax_year text NOT NULL,
        asset_name text NOT NULL,
        asset_class capital_allowance_class NOT NULL,
        cost_price bigint DEFAULT 0 NOT NULL,
        purchase_date timestamp NOT NULL,
        initial_allowance_rate numeric(5,2),
        initial_allowance_amount bigint DEFAULT 0 NOT NULL,
        opening_wdv bigint DEFAULT 0 NOT NULL,
        annual_allowance_rate numeric(5,2),
        annual_allowance_amount bigint DEFAULT 0 NOT NULL,
        closing_wdv bigint DEFAULT 0 NOT NULL,
        disposal_proceeds bigint DEFAULT 0,
        balancing_allowance bigint DEFAULT 0,
        balancing_charge bigint DEFAULT 0,
        is_disposed boolean DEFAULT false NOT NULL,
        disposal_date timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created capital_allowance_schedule table.');

    // Create tax_losses table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_losses (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        tax_year text NOT NULL,
        loss_amount bigint DEFAULT 0 NOT NULL,
        utilised_amount bigint DEFAULT 0 NOT NULL,
        available_amount bigint DEFAULT 0 NOT NULL,
        status tax_loss_status DEFAULT 'available' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created tax_losses table.');

    // Create tax_computations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_computations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        tax_year text NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        gross_turnover bigint DEFAULT 0 NOT NULL,
        accounting_pbt bigint DEFAULT 0 NOT NULL,
        total_addbacks bigint DEFAULT 0 NOT NULL,
        total_deductions bigint DEFAULT 0 NOT NULL,
        assessable_profit bigint DEFAULT 0 NOT NULL,
        cit_rate numeric(5,2) DEFAULT 0,
        cit_from_profits bigint DEFAULT 0 NOT NULL,
        minimum_tax bigint DEFAULT 0 NOT NULL,
        cit_payable bigint DEFAULT 0 NOT NULL,
        edt_payable bigint DEFAULT 0 NOT NULL,
        cgt_payable bigint DEFAULT 0 NOT NULL,
        nitda_levy bigint DEFAULT 0 NOT NULL,
        deferred_tax_charge bigint DEFAULT 0 NOT NULL,
        total_tax_expense bigint DEFAULT 0 NOT NULL,
        wht_credits_applied bigint DEFAULT 0 NOT NULL,
        net_cit_payable bigint DEFAULT 0 NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        status tax_computation_status DEFAULT 'draft' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created tax_computations table.');

    // Seed missing tax accounts for each org
    // 301450 - Capital Gains Tax Payable
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '301450', 'Capital Gains Tax Payable', 'liability', 'Current Liabilities',
             'CGTA – Tax on chargeable gains from asset disposals. Remit to FIRS.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '301450')
    `);
    // 950600 - NITDA Levy Expense
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '950600', 'NITDA Levy Expense', 'expense', 'tax_expense',
             'NITDA Act – 1% of PBT for IT sector companies. Deductible for CIT.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '950600')
    `);
    console.log('[Migration] Seeded tax accounts 301450 (CGT Payable) and 950600 (NITDA Levy Expense).');

    // Create legacy / migration financial statements tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS legacy_income_statements (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        fiscal_year integer NOT NULL,
        period_label text NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        data jsonb NOT NULL,
        is_locked boolean DEFAULT true NOT NULL,
        entered_by uuid REFERENCES users(id) NOT NULL,
        entered_at timestamp DEFAULT now() NOT NULL
      )
    `);
    // Create indexes (IF NOT EXISTS via DO block to avoid duplicate index errors)
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legacy_is_org_fy') THEN
          CREATE INDEX idx_legacy_is_org_fy ON legacy_income_statements(org_id, fiscal_year);
        END IF;
      END $$;
    `);
    console.log('[Migration] Created legacy_income_statements table.');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS legacy_cash_flow_statements (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        fiscal_year integer NOT NULL,
        period_label text NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        data jsonb NOT NULL,
        is_locked boolean DEFAULT true NOT NULL,
        entered_by uuid REFERENCES users(id) NOT NULL,
        entered_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legacy_cf_org_fy') THEN
          CREATE INDEX idx_legacy_cf_org_fy ON legacy_cash_flow_statements(org_id, fiscal_year);
        END IF;
      END $$;
    `);
    console.log('[Migration] Created legacy_cash_flow_statements table.');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS legacy_statements_of_changes_in_equity (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        fiscal_year integer NOT NULL,
        period_label text NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        data jsonb NOT NULL,
        is_locked boolean DEFAULT true NOT NULL,
        entered_by uuid REFERENCES users(id) NOT NULL,
        entered_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_legacy_socie_org_fy') THEN
          CREATE INDEX idx_legacy_socie_org_fy ON legacy_statements_of_changes_in_equity(org_id, fiscal_year);
        END IF;
      END $$;
    `);
    console.log('[Migration] Created legacy_statements_of_changes_in_equity table.');

    // Add live_gl_start_fiscal_year and legacy_system_name columns to organisations
    await db.execute(sql`
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS live_gl_start_fiscal_year integer
    `);
    await db.execute(sql`
      ALTER TABLE organisations ADD COLUMN IF NOT EXISTS legacy_system_name text
    `);
    console.log('[Migration] Added live_gl_start_fiscal_year and legacy_system_name columns to organisations.');

    // Clean up old payroll reversal entry pairs (original + reversal) that accumulated
    // before unapprove was changed to hard-delete JEs instead of creating reversals.
    try {
      const pairs = await db.execute(sql`
        SELECT rev.id AS rev_id, orig.id AS orig_id
        FROM journal_entries rev
        JOIN journal_entries orig
          ON orig.entry_number = COALESCE(rev.reference, substring(rev.description FROM 'Reversal of ([^ ]+)'))
          AND rev.org_id = orig.org_id
        WHERE rev.source = 'payroll'
          AND rev.description LIKE 'Reversal of%'
          AND orig.source = 'payroll'
      `);
      if (pairs.rows.length > 0) {
        const allIds = pairs.rows.flatMap((r: any) => [r.rev_id, r.orig_id]);
        const idsParam = sql.join(allIds.map((id: string) => sql`${id}::uuid`), sql`, `);
        const lineDel = await db.execute(sql`DELETE FROM journal_lines WHERE entry_id IN (${idsParam})`);
        const entryDel = await db.execute(sql`DELETE FROM journal_entries WHERE id IN (${idsParam})`);
        console.log(`[Migration] Cleaned up ${pairs.rows.length} payroll reversal pair(s): ${lineDel.rowCount} line(s), ${entryDel.rowCount} entry(ies) deleted.`);
      } else {
        console.log('[Migration] No old payroll reversal pairs found.');
      }
    } catch (cleanupErr) {
      console.error('[Migration] Payroll reversal cleanup error (non-fatal):', cleanupErr);
    }

    // ── Chat Conversations & Messages Tables ──
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        title text,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conv_org ON chat_conversations (org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_conversation_participants (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        conversation_id uuid REFERENCES chat_conversations(id) NOT NULL,
        user_id uuid REFERENCES users(id) NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conv_part_conv ON chat_conversation_participants (conversation_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conv_part_user ON chat_conversation_participants (user_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_part_unique ON chat_conversation_participants (conversation_id, user_id)`);

    // Add conversation_id to chat_messages if the column does not exist yet
    await db.execute(sql`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES chat_conversations(id)`);
    await db.execute(sql`DROP INDEX IF EXISTS idx_chat_org_created`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages (conversation_id, created_at DESC)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_read_markers (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        conversation_id uuid REFERENCES chat_conversations(id) NOT NULL,
        user_id uuid REFERENCES users(id) NOT NULL,
        last_read_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_read_unique ON chat_read_markers (conversation_id, user_id)`);
    console.log('[Migration] Created chat conversations and updated messages table.');

    // Email settings for org SMTP configuration
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_settings (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL UNIQUE,
        protocol text DEFAULT 'smtp' NOT NULL,
        hostname text,
        port integer DEFAULT 587,
        username text,
        email text,
        password text,
        send_copy_to text,
        reply_to text,
        use_different_reply_to boolean DEFAULT false NOT NULL,
        do_not_verify_tls boolean DEFAULT false NOT NULL,
        updated_by uuid REFERENCES users(id),
        updated_at timestamp DEFAULT now() NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Migration] Created email_settings table.');

    // ── GL Legacy Data Migration ──
    // Convert any remaining accounts.opening_balance values to JEs
    const orgsWithOB = await db.execute(sql`
      SELECT DISTINCT org_id FROM accounts WHERE opening_balance != 0 AND org_id IS NOT NULL
    `);
    for (const row of (orgsWithOB.rows || [])) {
      const orgId = row.org_id;
      const existingJE = await db.execute(sql`
        SELECT id FROM journal_entries WHERE org_id = ${orgId}::uuid AND source = 'opening_balance' LIMIT 1
      `);
      if ((existingJE.rows || []).length === 0) {
        // Create a consolidated JE for all opening balances
        const obAccounts = await db.execute(sql`
          SELECT id, opening_balance FROM accounts WHERE org_id = ${orgId}::uuid AND opening_balance != 0
        `);
        if ((obAccounts.rows || []).length > 0) {
          // We can't call createJournalEntry here (service dependency), so use raw SQL
          const lines = (obAccounts.rows || []).map((a: any) => ({
            accountId: a.id,
            balance: Number(a.opening_balance),
          }));
          let totalDebits = 0, totalCredits = 0;
          const jeLines: { account_id: string; debit_amount: number; credit_amount: number }[] = [];
          for (const l of lines) {
            if (l.balance > 0) { jeLines.push({ account_id: l.accountId, debit_amount: l.balance, credit_amount: 0 }); totalDebits += l.balance; }
            else { jeLines.push({ account_id: l.accountId, debit_amount: 0, credit_amount: Math.abs(l.balance) }); totalCredits += Math.abs(l.balance); }
          }
          // Balance with retained earnings
          const reResult = await db.execute(sql`
            SELECT id FROM accounts WHERE org_id = ${orgId}::uuid AND system_account_role = 'retained_earnings' LIMIT 1
          `);
          const reRow = (reResult.rows?.[0] || {}) as any;
          if (reRow.id) {
            const diff = totalDebits - totalCredits;
            if (diff > 0) jeLines.push({ account_id: reRow.id, debit_amount: 0, credit_amount: diff });
            else if (diff < 0) jeLines.push({ account_id: reRow.id, debit_amount: Math.abs(diff), credit_amount: 0 });
            const entryNum = `MIG-OB-${Date.now()}`;
            await db.execute(sql`
              INSERT INTO journal_entries (org_id, entry_number, date, description, source, created_by)
              VALUES (${orgId}::uuid, ${entryNum}, '1970-01-01', 'Legacy opening balance migration', 'opening_balance', (SELECT id FROM users WHERE org_id = ${orgId}::uuid LIMIT 1))
            `);
            const jeResult = await db.execute(sql`SELECT LASTVAL() AS id`);
            const jeRow = jeResult.rows?.[0];
            const jeId = jeRow?.id;
            if (jeId) {
              for (const jl of jeLines) {
                await db.execute(sql`
                  INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount)
                  VALUES (${jeId}::uuid, ${jl.account_id}::uuid, ${jl.debit_amount}, ${jl.credit_amount})
                `);
              }
              // Zero out the migrated opening balances
              await db.execute(sql`UPDATE accounts SET opening_balance = 0 WHERE org_id = ${orgId}::uuid AND opening_balance != 0`);
              console.log(`[Migration] Converted ${jeLines.length} legacy opening balance lines to JE for org ${orgId}`);
            }
          }
        }
      }
    }

    // Convert legacy contacts.balance values to JEs (customer AR / vendor AP)
    const orgsWithContactBal = await db.execute(sql`
      SELECT DISTINCT org_id FROM contacts WHERE balance != 0 AND org_id IS NOT NULL
    `);
    for (const row of (orgsWithContactBal.rows || [])) {
      const orgId = row.org_id;
      const arResult = await db.execute(sql`
        SELECT id FROM accounts WHERE org_id = ${orgId}::uuid AND system_account_role = 'accounts_receivable' LIMIT 1
      `);
      const arAcct = arResult.rows?.[0];
      const apResult = await db.execute(sql`
        SELECT id FROM accounts WHERE org_id = ${orgId}::uuid AND system_account_role = 'accounts_payable' LIMIT 1
      `);
      const apAcct = apResult.rows?.[0];
      const reResult2 = await db.execute(sql`
        SELECT id FROM accounts WHERE org_id = ${orgId}::uuid AND system_account_role = 'retained_earnings' LIMIT 1
      `);
      const reAcct = reResult2.rows?.[0];
      if (!arAcct || !apAcct || !reAcct) continue;

      const contactsWithBal = await db.execute(sql`
        SELECT id, balance, type FROM contacts WHERE org_id = ${orgId}::uuid AND balance != 0
      `);
      for (const c of (contactsWithBal.rows || [])) {
        // Skip if an opening balance JE already exists for this contact
        const existingJE = await db.execute(sql`
          SELECT id FROM journal_entries WHERE org_id = ${orgId}::uuid AND source = 'opening_balance' AND source_id = ${c.id}::uuid LIMIT 1
        `);
        if ((existingJE.rows || []).length > 0) continue;

        const bal = Number(c.balance);
        if (bal === 0) continue;
        const entryNum = `MIG-OB-${Date.now()}-${String(Math.random()).slice(2, 8)}`;
        if (c.type === 'customer' && bal > 0) {
          await db.execute(sql`
            INSERT INTO journal_entries (org_id, entry_number, date, description, source, source_id, created_by)
            VALUES (${orgId}::uuid, ${entryNum}, '1970-01-01', 'Legacy customer opening balance', 'opening_balance', ${c.id}::uuid, (SELECT id FROM users WHERE org_id = ${orgId}::uuid LIMIT 1))
          `);
          const jeResult2 = await db.execute(sql`SELECT LASTVAL() AS id`);
          const jeRow = jeResult2.rows?.[0];
          if (jeRow?.id) {
            await db.execute(sql`INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount) VALUES (${jeRow.id}::uuid, ${arAcct.id}::uuid, ${bal}, 0)`);
            await db.execute(sql`INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount) VALUES (${jeRow.id}::uuid, ${reAcct.id}::uuid, 0, ${bal})`);
            await db.execute(sql`UPDATE contacts SET balance = 0 WHERE id = ${c.id}::uuid`);
            console.log(`[Migration] Converted customer ${c.id} opening balance of ${bal} kobo to JE`);
          }
        } else if (c.type === 'vendor' && bal > 0) {
          await db.execute(sql`
            INSERT INTO journal_entries (org_id, entry_number, date, description, source, source_id, created_by)
            VALUES (${orgId}::uuid, ${entryNum}, '1970-01-01', 'Legacy vendor opening balance', 'opening_balance', ${c.id}::uuid, (SELECT id FROM users WHERE org_id = ${orgId}::uuid LIMIT 1))
          `);
          const jeResult3 = await db.execute(sql`SELECT LASTVAL() AS id`);
          const jeRow = jeResult3.rows?.[0];
          if (jeRow?.id) {
            await db.execute(sql`INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount) VALUES (${jeRow.id}::uuid, ${apAcct.id}::uuid, 0, ${bal})`);
            await db.execute(sql`INSERT INTO journal_lines (entry_id, account_id, debit_amount, credit_amount) VALUES (${jeRow.id}::uuid, ${reAcct.id}::uuid, ${bal}, 0)`);
            await db.execute(sql`UPDATE contacts SET balance = 0 WHERE id = ${c.id}::uuid`);
            console.log(`[Migration] Converted vendor ${c.id} opening balance of ${bal} kobo to JE`);
          }
        }
      }
    }

    // ── Accounting Posting Rules Table ──
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS accounting_rules (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        name text NOT NULL,
        source text NOT NULL,
        event_type text,
        account_role text,
        account_id uuid REFERENCES accounts(id),
        priority integer DEFAULT 0 NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rules_org_source ON accounting_rules (org_id, source)`);
    // Add inventory_adjustment to journal_source enum
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'inventory_adjustment'`);
    console.log('[Migration] Added inventory_adjustment to journal_source enum.');

    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'loan'`);
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'owner_capital'`);
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'owner_drawings'`);
    console.log('[Migration] Added loan, owner_capital, owner_drawings to journal_source enum.');

    // ── Journal Status Workflow ──
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE journal_status AS ENUM (
          'draft', 'pending_review', 'approved', 'posted', 'locked', 'reversed', 'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS status journal_status DEFAULT 'posted' NOT NULL`);
    await db.execute(sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES users(id)`);
    // Backfill: mark reversed entries with status='reversed' where is_reversed=true
    await db.execute(sql`UPDATE journal_entries SET status = 'reversed' WHERE is_reversed = true AND status = 'posted'`);
    console.log('[Migration] Added journal_status enum, status column, and approver/post/lock/cancel-by columns.');

    console.log('[Migration] Created accounting_rules table.');

    // ── Report Section Mappings Table ──
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS report_section_mappings (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        report_type text NOT NULL,
        section_key text NOT NULL,
        label text NOT NULL,
        account_code text,
        account_prefix text,
        sign_multiplier integer DEFAULT 1 NOT NULL,
        include_sub_accounts boolean DEFAULT true NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_report_mappings_org ON report_section_mappings (org_id, report_type)`);
    console.log('[Migration] Created report_section_mappings table.');

    // ── Financial Notes Table ──
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS financial_notes (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        note_number text NOT NULL,
        title text NOT NULL,
        content text,
        auto_generated boolean DEFAULT true NOT NULL,
        source_report text,
        report_date timestamp,
        note_data jsonb,
        sort_order integer DEFAULT 0 NOT NULL,
        created_by uuid REFERENCES users(id),
        updated_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_financial_notes_org ON financial_notes (org_id, note_number)`);
    console.log('[Migration] Created financial_notes table.');

    // ── IFRS 15 Revenue Recognition ──
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE contract_status AS ENUM ('draft', 'active', 'completed', 'cancelled', 'modified');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE obligation_timing AS ENUM ('point_in_time', 'over_time');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE recognition_method AS ENUM ('straight_line', 'milestone', 'percentage_of_completion', 'custom');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE schedule_status AS ENUM ('pending', 'recognized', 'skipped');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS revenue_contracts (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        contract_number text NOT NULL,
        customer_id uuid REFERENCES contacts(id) NOT NULL,
        project_id uuid REFERENCES projects(id),
        description text,
        status contract_status DEFAULT 'draft' NOT NULL,
        total_contract_value bigint DEFAULT 0 NOT NULL,
        start_date timestamp NOT NULL,
        end_date timestamp,
        billing_frequency text,
        payment_terms integer,
        currency text DEFAULT 'NGN' NOT NULL,
        notes text,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_contracts_org ON revenue_contracts (org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_contracts_customer ON revenue_contracts (org_id, customer_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS performance_obligations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        contract_id uuid REFERENCES revenue_contracts(id) NOT NULL,
        description text NOT NULL,
        timing obligation_timing NOT NULL,
        amount bigint DEFAULT 0 NOT NULL,
        recognized_amount bigint DEFAULT 0 NOT NULL,
        remaining_amount bigint DEFAULT 0 NOT NULL,
        recognition_method recognition_method DEFAULT 'straight_line' NOT NULL,
        revenue_account_id uuid REFERENCES accounts(id) NOT NULL,
        deferred_revenue_account_id uuid REFERENCES accounts(id),
        contract_asset_account_id uuid REFERENCES accounts(id),
        start_date timestamp,
        end_date timestamp,
        milestone_criteria text,
        completion_percentage numeric,
        sort_order integer DEFAULT 0 NOT NULL,
        status contract_status DEFAULT 'draft' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_perf_obligations_contract ON performance_obligations (contract_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS revenue_schedules (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        obligation_id uuid REFERENCES performance_obligations(id) NOT NULL,
        scheduled_date timestamp NOT NULL,
        amount bigint DEFAULT 0 NOT NULL,
        recognized_amount bigint DEFAULT 0 NOT NULL,
        status schedule_status DEFAULT 'pending' NOT NULL,
        description text,
        sort_order integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_schedules_obligation ON revenue_schedules (obligation_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS revenue_recognition_entries (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        schedule_id uuid REFERENCES revenue_schedules(id) NOT NULL,
        obligation_id uuid REFERENCES performance_obligations(id) NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        amount bigint NOT NULL,
        recognized_date timestamp NOT NULL,
        method recognition_method NOT NULL,
        description text,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_recog_schedule ON revenue_recognition_entries (schedule_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_recog_obligation ON revenue_recognition_entries (obligation_id)`);

    // Seed 101050 Unbilled Receivables / Contract Assets account for each org
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '101050', 'Unbilled Receivables / Contract Assets', 'asset', 'Current Assets',
             'IFRS 15 – Revenue recognized but not yet invoiced. Right to consideration subject to conditions (contract asset).', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '101050')
    `);
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'revenue_recognition'`);
    console.log('[Migration] Created IFRS 15 revenue recognition tables and seeded contract asset account.');

    // ── IFRS 16 Lease Accounting ──
    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'lease'`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leases (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        lease_number text NOT NULL,
        description text,
        lessor_name text NOT NULL,
        asset_category text NOT NULL,
        rou_asset_account_id uuid REFERENCES accounts(id) NOT NULL,
        accum_depreciation_account_id uuid REFERENCES accounts(id) NOT NULL,
        depreciation_expense_account_id uuid REFERENCES accounts(id) NOT NULL,
        lease_liability_account_id uuid REFERENCES accounts(id),
        current_liability_account_id uuid REFERENCES accounts(id),
        interest_expense_account_id uuid REFERENCES accounts(id),
        bank_account_id uuid REFERENCES accounts(id),
        commencement_date timestamp NOT NULL,
        end_date timestamp NOT NULL,
        lease_term_months integer NOT NULL,
        payment_amount bigint NOT NULL,
        lease_payment_frequency text DEFAULT 'monthly' NOT NULL,
        total_payments integer NOT NULL,
        incremental_borrowing_rate numeric(5,2) NOT NULL,
        present_value bigint NOT NULL,
        rou_asset_initial bigint NOT NULL,
        initial_direct_costs bigint DEFAULT 0 NOT NULL,
        depreciation_method text DEFAULT 'straight_line' NOT NULL,
        residual_value bigint DEFAULT 0 NOT NULL,
        status text DEFAULT 'draft' NOT NULL,
        notes text,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_leases_org ON leases (org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_leases_status ON leases (status)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lease_payment_schedules (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        lease_id uuid REFERENCES leases(id) NOT NULL,
        period_number integer NOT NULL,
        due_date timestamp NOT NULL,
        payment_amount bigint NOT NULL,
        interest_amount bigint DEFAULT 0 NOT NULL,
        principal_amount bigint DEFAULT 0 NOT NULL,
        outstanding_balance bigint NOT NULL,
        is_paid boolean DEFAULT false NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lease_sched_lease ON lease_payment_schedules (lease_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lease_journal_entries (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        lease_id uuid REFERENCES leases(id) NOT NULL,
        period_number integer NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id) NOT NULL,
        entry_type text NOT NULL,
        description text,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_lease_je_lease ON lease_journal_entries (lease_id)`);

    // Seed lease liability accounts (current and non-current) if not already present
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '304000', 'Lease Liabilities – Current', 'liability', 'Current Liabilities',
             'IFRS 16 – Current portion of lease liabilities due within 12 months.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '304000')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '401000', 'Lease Liabilities – Non-current', 'liability', 'Non-current Liabilities',
             'IFRS 16 – Non-current portion of lease liabilities due beyond 12 months.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '401000')
    `);
    // Seed interest expense account
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '910300', 'Interest Expense – Lease Liabilities', 'expense', 'Finance Costs',
             'IFRS 16 – Interest expense on lease liabilities (unwinding of discount).', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '910300')
    `);
    // Seed ROU asset and depreciation accounts
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '201100', 'ROU – Buildings', 'asset', 'Property, Plant & Equipment',
             'IFRS 16 – Right-of-use asset for building leases.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '201100')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '201101', 'Accum. Depr. – ROU Buildings', 'asset', 'Property, Plant & Equipment',
             'IFRS 16 – Accumulated depreciation on right-of-use building assets.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '201101')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '201200', 'ROU – Motor Vehicles', 'asset', 'Property, Plant & Equipment',
             'IFRS 16 – Right-of-use asset for motor vehicle leases.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '201200')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '201201', 'Accum. Depr. – ROU Vehicles', 'asset', 'Property, Plant & Equipment',
             'IFRS 16 – Accumulated depreciation on right-of-use vehicle assets.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '201201')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '810900', 'Depreciation – ROU Assets', 'expense', 'Depreciation & Amortisation',
             'IFRS 16 – Depreciation expense on right-of-use assets.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '810900')
    `);

    console.log('[Migration] Created IFRS 16 lease accounting tables and seeded default accounts.');

    // ── IFRS 9 Expected Credit Loss ──

    await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'ecl_provision'`);
    await db.execute(sql`ALTER TYPE system_account_role ADD VALUE IF NOT EXISTS 'allowance_for_doubtful_debts'`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ecl_parameters (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        bucket_label text NOT NULL,
        min_days integer DEFAULT 0 NOT NULL,
        max_days integer DEFAULT 0 NOT NULL,
        loss_rate numeric(6,4) NOT NULL,
        stage text DEFAULT '1' NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ecl_params_org ON ecl_parameters (org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ecl_computations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        computation_date timestamp NOT NULL,
        as_of_date timestamp NOT NULL,
        total_receivables bigint DEFAULT 0 NOT NULL,
        total_provision bigint DEFAULT 0 NOT NULL,
        previous_provision bigint DEFAULT 0 NOT NULL,
        adjustment_amount bigint DEFAULT 0 NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        details jsonb,
        status text DEFAULT 'computed' NOT NULL,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ecl_computations_org ON ecl_computations (org_id)`);

    // Seed default ECL parameters for each org (standard provision matrix rates)
    const orgsForEcl = await db.execute(sql`SELECT id FROM organisations`);
    const orgRows = (orgsForEcl as any).rows || [];
    for (const org of orgRows) {
      const existingParams = await db.execute(sql`SELECT id FROM ecl_parameters WHERE org_id = ${org.id}::uuid LIMIT 1`);
      if (!((existingParams as any).rows?.length)) {
        const defaultBuckets = [
          { label: 'current', min: -9999, max: 0, rate: 0.0050, stage: '1', sort: 1 },    // 0.5% - not yet due
          { label: '1-30', min: 1, max: 30, rate: 0.0100, stage: '1', sort: 2 },           // 1% - 1-30 days overdue
          { label: '31-60', min: 31, max: 60, rate: 0.0250, stage: '2', sort: 3 },         // 2.5% - 31-60 days
          { label: '61-90', min: 61, max: 90, rate: 0.0500, stage: '2', sort: 4 },         // 5% - 61-90 days
          { label: '90+', min: 91, max: 999999, rate: 0.1500, stage: '3', sort: 5 },       // 15% - over 90 days
        ];
        for (const b of defaultBuckets) {
          await db.execute(sql`
            INSERT INTO ecl_parameters (org_id, bucket_label, min_days, max_days, loss_rate, stage, sort_order)
            VALUES (${org.id}::uuid, ${b.label}, ${b.min}, ${b.max}, ${b.rate}, ${b.stage}, ${b.sort})
          `);
        }
      }
    }

    console.log('[Migration] Created IFRS 9 ECL tables and seeded default provision matrix.');

    // -------------------------------------------------------------------------
    // IFRS Fixed Asset Enhancements — Tables & Columns
    // -------------------------------------------------------------------------

    // Add 'cwip' to fixed_asset_status enum
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE fixed_asset_status ADD VALUE 'cwip';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Asset Classes table (must be created before fixed_assets columns reference it)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS asset_classes (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        name text NOT NULL,
        code text,
        description text,
        default_useful_life_months integer DEFAULT 60,
        default_depreciation_method depreciation_method DEFAULT 'straight_line',
        default_residual_value_pct numeric(5,2) DEFAULT '0',
        gl_asset_account_id uuid REFERENCES accounts(id),
        gl_depreciation_expense_account_id uuid REFERENCES accounts(id),
        gl_accum_depr_account_id uuid REFERENCES accounts(id),
        gl_revaluation_reserve_account_id uuid REFERENCES accounts(id),
        gl_disposal_proceeds_account_id uuid REFERENCES accounts(id),
        gl_disposal_loss_account_id uuid REFERENCES accounts(id),
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asset_classes_org ON asset_classes (org_id)`);

    // Add new columns to fixed_assets (IF NOT EXISTS for idempotency)
    const faCols = [
      'ADD COLUMN IF NOT EXISTS asset_class_id uuid REFERENCES asset_classes(id)',
      'ADD COLUMN IF NOT EXISTS location text',
      'ADD COLUMN IF NOT EXISTS department text',
      'ADD COLUMN IF NOT EXISTS revaluation_amount bigint DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS revaluation_surplus_account_id uuid REFERENCES accounts(id)',
      'ADD COLUMN IF NOT EXISTS impairment_loss bigint DEFAULT 0',
      'ADD COLUMN IF NOT EXISTS last_depreciation_date timestamp',
      'ADD COLUMN IF NOT EXISTS next_depreciation_date timestamp',
      'ADD COLUMN IF NOT EXISTS capitalization_date timestamp',
      'ADD COLUMN IF NOT EXISTS cwip_source_id uuid REFERENCES fixed_assets(id)',
      'ADD COLUMN IF NOT EXISTS disposal_account_id uuid REFERENCES accounts(id)',
    ];
    for (const col of faCols) {
      await db.execute(sql`ALTER TABLE fixed_assets ${sql.raw(col)}`);
    }

    // Asset Components table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS asset_components (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        asset_id uuid REFERENCES fixed_assets(id) NOT NULL,
        name text NOT NULL,
        description text,
        cost bigint NOT NULL,
        useful_life_months integer NOT NULL,
        residual_value bigint DEFAULT 0,
        depreciation_method depreciation_method DEFAULT 'straight_line',
        accumulated_depreciation bigint DEFAULT 0 NOT NULL,
        book_value bigint NOT NULL,
        gl_asset_account_id uuid REFERENCES accounts(id),
        gl_accum_depr_account_id uuid REFERENCES accounts(id),
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asset_components_asset ON asset_components (asset_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asset_components_org ON asset_components (org_id)`);

    // Revaluation Entries table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS revaluation_entries (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        asset_id uuid REFERENCES fixed_assets(id) NOT NULL,
        component_id uuid REFERENCES asset_components(id),
        revaluation_date timestamp NOT NULL,
        revaluation_type text NOT NULL,
        old_carrying_amount bigint NOT NULL,
        new_carrying_amount bigint NOT NULL,
        revaluation_amount bigint NOT NULL,
        revaluation_surplus bigint DEFAULT 0 NOT NULL,
        revaluation_loss bigint DEFAULT 0 NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        notes text,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_revaluation_entries_asset ON revaluation_entries (asset_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_revaluation_entries_org ON revaluation_entries (org_id)`);

    // Impairment Entries table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS impairment_entries (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        asset_id uuid REFERENCES fixed_assets(id) NOT NULL,
        component_id uuid REFERENCES asset_components(id),
        impairment_date timestamp NOT NULL,
        carrying_amount bigint NOT NULL,
        recoverable_amount bigint NOT NULL,
        impairment_loss bigint NOT NULL,
        impairment_source text,
        journal_entry_id uuid REFERENCES journal_entries(id),
        notes text,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_impairment_entries_asset ON impairment_entries (asset_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_impairment_entries_org ON impairment_entries (org_id)`);

    // Maintenance Records table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        asset_id uuid REFERENCES fixed_assets(id) NOT NULL,
        component_id uuid REFERENCES asset_components(id),
        maintenance_date timestamp NOT NULL,
        maintenance_type text NOT NULL,
        description text NOT NULL,
        cost bigint NOT NULL,
        vendor text,
        journal_entry_id uuid REFERENCES journal_entries(id),
        notes text,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_maintenance_records_asset ON maintenance_records (asset_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_maintenance_records_org ON maintenance_records (org_id)`);

    // Asset Transfers table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS asset_transfers (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        asset_id uuid REFERENCES fixed_assets(id) NOT NULL,
        transfer_date timestamp NOT NULL,
        from_location text,
        to_location text,
        from_department text,
        to_department text,
        reason text,
        authorized_by uuid REFERENCES users(id),
        notes text,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asset_transfers_asset ON asset_transfers (asset_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asset_transfers_org ON asset_transfers (org_id)`);

    console.log('[Migration] Fixed Asset Enhancement tables and columns created.');

    // Add Fixed Asset journal source if not present
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE journal_source ADD VALUE 'fixed_asset';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Seed default asset classes for existing orgs
    const orgsForFa = await db.execute(sql`SELECT id FROM organisations`);
    const orgRowsFa = (orgsForFa as any).rows || [];
    for (const org of orgRowsFa) {
      const existingClasses = await db.execute(sql`SELECT id FROM asset_classes WHERE org_id = ${org.id}::uuid LIMIT 1`);
      if (!((existingClasses as any).rows?.length)) {
        const classes = [
          { name: 'Land', code: '200100', life: 0, method: 'no_depreciation', assetCode: '200100' },
          { name: 'Buildings', code: '200200', life: 240, method: 'straight_line', assetCode: '200200', deprExpenseCode: '810700', accumCode: '200201' },
          { name: 'Plant & Machinery', code: '200300', life: 120, method: 'straight_line', assetCode: '200300', deprExpenseCode: '810700', accumCode: '200301' },
          { name: 'Motor Vehicles', code: '200400', life: 60, method: 'declining_balance', assetCode: '200400', deprExpenseCode: '810700', accumCode: '200401' },
          { name: 'Furniture & Fittings', code: '200500', life: 60, method: 'straight_line', assetCode: '200500', deprExpenseCode: '810700', accumCode: '200501' },
          { name: 'Computer & IT Equipment', code: '200600', life: 36, method: 'straight_line', assetCode: '200600', deprExpenseCode: '810700', accumCode: '200601' },
          { name: 'Generator & Power Equipment', code: '200700', life: 120, method: 'straight_line', assetCode: '200700', deprExpenseCode: '810700', accumCode: '200701' },
          { name: 'Capital Work In Progress', code: '200800', life: 0, method: 'no_depreciation', assetCode: '200800' },
        ];
        for (const cls of classes) {
          const accRes = await db.execute(sql`SELECT id FROM accounts WHERE org_id = ${org.id}::uuid AND code = ${cls.assetCode} LIMIT 1`);
          const accRow = (accRes as any).rows?.[0];
          let deprExpId: string | null = null;
          let accumId: string | null = null;
          if (cls.code !== '200100' && cls.code !== '200800') {
            const deprRes = await db.execute(sql`SELECT id FROM accounts WHERE org_id = ${org.id}::uuid AND code = ${cls.deprExpenseCode} LIMIT 1`);
            deprExpId = (deprRes as any).rows?.[0]?.id || null;
            const accumRes = await db.execute(sql`SELECT id FROM accounts WHERE org_id = ${org.id}::uuid AND code = ${cls.accumCode} LIMIT 1`);
            accumId = (accumRes as any).rows?.[0]?.id || null;
          }
          await db.execute(sql`
            INSERT INTO asset_classes (org_id, name, code, default_useful_life_months, default_depreciation_method, gl_asset_account_id, gl_depreciation_expense_account_id, gl_accum_depr_account_id)
            VALUES (${org.id}::uuid, ${cls.name}, ${cls.code}, ${cls.life}, ${cls.method}::depreciation_method, ${accRow?.id || null}::uuid, ${deprExpId}::uuid, ${accumId}::uuid)
          `);
        }
      }
    }
    console.log('[Migration] Seeded default asset classes for existing organisations.');

    // -------------------------------------------------------------------------
    // Inventory Accounting Enhancement — Tables & Columns
    // -------------------------------------------------------------------------

    // Add costing_method enum
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE costing_method AS ENUM ('fifo', 'weighted_average', 'specific_identification');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Add stock_count_status, writeoff_status, landed_cost_status, landed_cost_alloc_method enums
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE stock_count_status AS ENUM ('draft', 'completed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE writeoff_status AS ENUM ('draft', 'posted');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE landed_cost_status AS ENUM ('draft', 'allocated');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE landed_cost_alloc_method AS ENUM ('by_value', 'by_quantity', 'by_weight', 'by_volume');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Add columns to items
    const itemCols = [
      'ADD COLUMN IF NOT EXISTS costing_method costing_method DEFAULT \'fifo\'',
      'ADD COLUMN IF NOT EXISTS cogs_account_id uuid REFERENCES accounts(id)',
      'ADD COLUMN IF NOT EXISTS average_cost bigint',
      'ADD COLUMN IF NOT EXISTS last_purchase_price bigint',
      'ADD COLUMN IF NOT EXISTS reorder_quantity integer',
      'ADD COLUMN IF NOT EXISTS min_stock_level integer',
      'ADD COLUMN IF NOT EXISTS max_stock_level integer',
      'ADD COLUMN IF NOT EXISTS location text',
    ];
    for (const col of itemCols) {
      await db.execute(sql`ALTER TABLE items ${sql.raw(col)}`);
    }

    // Inventory Transfers
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_transfers (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        reference text NOT NULL,
        date timestamp NOT NULL,
        from_location text NOT NULL,
        to_location text NOT NULL,
        description text,
        transfer_cost bigint DEFAULT 0 NOT NULL,
        status text DEFAULT 'draft' NOT NULL,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventory_transfers_org ON inventory_transfers (org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_transfer_items (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        transfer_id uuid REFERENCES inventory_transfers(id) NOT NULL,
        item_id uuid REFERENCES items(id) NOT NULL,
        lot_id uuid REFERENCES inventory_lots(id),
        quantity numeric NOT NULL,
        unit_cost bigint,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer ON inventory_transfer_items (transfer_id)`);

    // Stock Counts
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_stock_counts (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        reference text NOT NULL,
        date timestamp NOT NULL,
        location text,
        description text,
        status stock_count_status DEFAULT 'draft' NOT NULL,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventory_stock_counts_org ON inventory_stock_counts (org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_stock_count_items (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        count_id uuid REFERENCES inventory_stock_counts(id) NOT NULL,
        item_id uuid REFERENCES items(id) NOT NULL,
        lot_id uuid REFERENCES inventory_lots(id),
        expected_quantity numeric NOT NULL,
        actual_quantity numeric NOT NULL,
        variance numeric NOT NULL,
        unit_cost bigint,
        variance_value bigint,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventory_stock_count_items_count ON inventory_stock_count_items (count_id)`);

    // Write-offs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_writeoffs (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        reference text NOT NULL,
        date timestamp NOT NULL,
        reason text NOT NULL,
        description text,
        location text,
        account_id uuid REFERENCES accounts(id),
        status writeoff_status DEFAULT 'draft' NOT NULL,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventory_writeoffs_org ON inventory_writeoffs (org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inventory_writeoff_items (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        writeoff_id uuid REFERENCES inventory_writeoffs(id) NOT NULL,
        item_id uuid REFERENCES items(id) NOT NULL,
        lot_id uuid REFERENCES inventory_lots(id),
        quantity numeric NOT NULL,
        unit_cost bigint,
        total_cost bigint,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inventory_writeoff_items_writeoff ON inventory_writeoff_items (writeoff_id)`);

    // Landed Costs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS landed_costs (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        reference text NOT NULL,
        date timestamp NOT NULL,
        vendor text,
        description text,
        total_amount bigint NOT NULL,
        allocation_method landed_cost_alloc_method DEFAULT 'by_value' NOT NULL,
        bill_id uuid REFERENCES bills(id),
        status landed_cost_status DEFAULT 'draft' NOT NULL,
        created_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_landed_costs_org ON landed_costs (org_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS landed_cost_allocations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        landed_cost_id uuid REFERENCES landed_costs(id) NOT NULL,
        item_id uuid REFERENCES items(id) NOT NULL,
        bill_line_id uuid REFERENCES bill_lines(id),
        lot_id uuid REFERENCES inventory_lots(id),
        allocated_amount bigint NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_landed_cost_allocations_cost ON landed_cost_allocations (landed_cost_id)`);

    console.log('[Migration] Inventory Enhancement tables and columns created.');

    // ===== NIGERIAN TAX ENGINE MIGRATION =====

    // Enums (IF NOT EXISTS handled by drizzle push; raw SQL we protect)
    await db.execute(sql`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paye_period_status') THEN
        CREATE TYPE paye_period_status AS ENUM ('draft','computed','posted','remitted');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'itf_status') THEN
        CREATE TYPE itf_status AS ENUM ('pending','paid','waived');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_exemption_status') THEN
        CREATE TYPE tax_exemption_status AS ENUM ('active','expired','revoked');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_type_enum') THEN
        CREATE TYPE tax_type_enum AS ENUM ('vat','wht','cit','paye','itf','cgt','edt','stamp_duty','nhf','nsitf','all');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'firs_report_status') THEN
        CREATE TYPE firs_report_status AS ENUM ('draft','filed','assessed','paid');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'firs_report_type') THEN
        CREATE TYPE firs_report_type AS ENUM ('vat','wht','cit','paye','itf','nsitf','nhf','cgt','edt','stamp_duty','consolidated');
      END IF;
    END $$`);

    // PAYE Schedules
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS paye_schedules (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        payroll_run_id uuid REFERENCES payroll_runs(id),
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        period_label text NOT NULL,
        total_gross_pay bigint DEFAULT 0 NOT NULL,
        total_taxable_pay bigint DEFAULT 0 NOT NULL,
        total_paye bigint DEFAULT 0 NOT NULL,
        total_nhf bigint DEFAULT 0 NOT NULL,
        total_nsitf bigint DEFAULT 0 NOT NULL,
        status paye_period_status DEFAULT 'draft' NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_paye_schedules_org ON paye_schedules (org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_paye_schedules_status ON paye_schedules (status)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS paye_schedule_lines (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        paye_schedule_id uuid REFERENCES paye_schedules(id) NOT NULL,
        employee_id uuid REFERENCES employees(id),
        gross_pay bigint DEFAULT 0 NOT NULL,
        consolidated_relief bigint DEFAULT 0 NOT NULL,
        taxable_pay bigint DEFAULT 0 NOT NULL,
        paye bigint DEFAULT 0 NOT NULL,
        nhf bigint DEFAULT 0 NOT NULL,
        nsitf bigint DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_paye_schedule_lines_schedule ON paye_schedule_lines (paye_schedule_id)`);

    // ITF Assessments
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS itf_assessments (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        assessment_year text NOT NULL,
        total_payroll bigint DEFAULT 0 NOT NULL,
        contribution_rate numeric(5,2) DEFAULT '0.01' NOT NULL,
        contribution_amount bigint DEFAULT 0 NOT NULL,
        paid_amount bigint DEFAULT 0 NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        status itf_status DEFAULT 'pending' NOT NULL,
        paid_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_itf_assessments_org ON itf_assessments (org_id)`);

    // Stamp Duty Records
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS stamp_duty_records (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        transaction_type text NOT NULL,
        reference_type text,
        reference_id uuid,
        gross_amount bigint DEFAULT 0 NOT NULL,
        stamp_duty_amount bigint DEFAULT 0 NOT NULL,
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stamp_duty_org ON stamp_duty_records (org_id)`);

    // Tax Exemptions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_exemptions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        tax_type tax_type_enum NOT NULL,
        exemption_type text NOT NULL,
        reference_number text,
        start_date timestamp NOT NULL,
        end_date timestamp,
        certificate_url text,
        description text,
        status tax_exemption_status DEFAULT 'active' NOT NULL,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tax_exemptions_org ON tax_exemptions (org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tax_exemptions_type ON tax_exemptions (tax_type)`);

    // FIRS Reports
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS firs_reports (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        report_type firs_report_type NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        period_label text NOT NULL,
        tax_year text,
        total_liability bigint DEFAULT 0 NOT NULL,
        total_paid bigint DEFAULT 0 NOT NULL,
        balance_due bigint DEFAULT 0 NOT NULL,
        status firs_report_status DEFAULT 'draft' NOT NULL,
        metadata jsonb,
        filed_at timestamp,
        filed_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_firs_reports_org ON firs_reports (org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_firs_reports_type ON firs_reports (report_type)`);

    // Auto Tax Journals
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auto_tax_journals (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        tax_type tax_type_enum NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        reference_type text,
        reference_id uuid,
        journal_entry_id uuid REFERENCES journal_entries(id) NOT NULL,
        amount bigint DEFAULT 0 NOT NULL,
        description text,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_auto_tax_journals_org ON auto_tax_journals (org_id)`);

    // Seed new tax accounts per org
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '306100', 'NSITF Payable', 'liability', 'current_liability',
             'Nigeria Social Insurance Trust Fund – employer 1% contribution payable.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '306100')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '306200', 'ITF Contribution Payable', 'liability', 'current_liability',
             'Industrial Training Fund – 1% of annual payroll payable.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '306200')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '306300', 'Stamp Duty Payable', 'liability', 'current_liability',
             'Stamp duties on receipts – ₦50 per transaction ≥ ₦5,000.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '306300')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '950700', 'ITF Contribution Expense', 'expense', 'tax_expense',
             'Industrial Training Fund levy expense – deductible for CIT.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '950700')
    `);
    await db.execute(sql`
      INSERT INTO accounts (id, org_id, code, name, type, sub_type, description, is_system, is_active, system_account_role)
      SELECT gen_random_uuid(), o.id, '950800', 'Stamp Duty Expense', 'expense', 'tax_expense',
             'Stamp duty charges on receipts and financial transactions.', true, true, 'none'
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.org_id = o.id AND a.code = '950800')
    `);

    console.log('[Migration] Nigerian Tax Engine tables and accounts created.');

    // ===== SMART BANK RECONCILIATION MIGRATION =====

    // Add match_confidence, match_method, reconciled_at to bank_transactions
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='match_confidence') THEN
          ALTER TABLE bank_transactions ADD COLUMN match_confidence numeric(5,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='match_method') THEN
          ALTER TABLE bank_transactions ADD COLUMN match_method text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='reconciled_at') THEN
          ALTER TABLE bank_transactions ADD COLUMN reconciled_at timestamp;
        END IF;
      END $$;
    `);

    // Create reconciliation_adjustments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reconciliation_adjustments (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        bank_account_id uuid REFERENCES bank_accounts(id) NOT NULL,
        adjustment_type text NOT NULL,
        amount bigint NOT NULL,
        description text NOT NULL,
        reference text,
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reconciliation_adjustments_org ON reconciliation_adjustments (org_id)`);

    console.log('[Migration] Smart Bank Reconciliation columns and table created.');

    // ===== ENTERPRISE AUDIT TRAIL ENHANCEMENT MIGRATION =====

    // Add new columns to audit_log
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='description') THEN
          ALTER TABLE audit_log ADD COLUMN description text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='correlation_id') THEN
          ALTER TABLE audit_log ADD COLUMN correlation_id uuid;
          CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log (org_id, correlation_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='hash') THEN
          ALTER TABLE audit_log ADD COLUMN hash text;
          CREATE INDEX IF NOT EXISTS idx_audit_log_hash ON audit_log (hash);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='previous_hash') THEN
          ALTER TABLE audit_log ADD COLUMN previous_hash text;
        END IF;
      END $$;
    `);

    // Create immutable trigger function to prevent UPDATE/DELETE on audit_log
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Audit log records are immutable and cannot be deleted.';
        ELSIF TG_OP = 'UPDATE' THEN
          RAISE EXCEPTION 'Audit log records are immutable and cannot be modified.';
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    // Drop trigger first to avoid duplicate errors on re-run, then recreate
    await db.execute(sql`DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_log;`);
    await db.execute(sql`
      CREATE TRIGGER trg_prevent_audit_log_mutation
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
    `);

    console.log('[Migration] Enterprise Audit Trail columns, indexes, and immutable trigger created.');

    // ===== APPROVAL WORKFLOW MIGRATION =====

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE approval_module AS ENUM (
          'bills', 'expenses', 'journals', 'payments_received', 'payments_made',
          'purchase_orders', 'fixed_assets', 'inventory_adjustments'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE expense_status AS ENUM ('draft', 'pending_review', 'approved', 'posted', 'void');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('draft', 'pending_review', 'approved', 'posted', 'void');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'pending_review'`);
    await db.execute(sql`ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'approved'`);
    await db.execute(sql`ALTER TYPE adjustment_status ADD VALUE IF NOT EXISTS 'posted'`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS approval_workflows (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        module approval_module NOT NULL,
        level integer DEFAULT 1 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workflow_org_module ON approval_workflows (org_id, module)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_org_module_unique ON approval_workflows (org_id, module)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS approval_history (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        module approval_module NOT NULL,
        entity_id uuid NOT NULL,
        action text NOT NULL,
        performed_by uuid REFERENCES users(id) NOT NULL,
        comment text,
        old_status text,
        new_status text,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_approval_history_org ON approval_history (org_id, module, entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_approval_history_entity ON approval_history (entity_id)`);

    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status expense_status DEFAULT 'posted' NOT NULL`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fx_rate numeric(18,8)`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_billable boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES contacts(id)`);
    await db.execute(sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_id uuid`);

    await db.execute(sql`ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS status payment_status DEFAULT 'posted' NOT NULL`);
    await db.execute(sql`ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE payments_received ADD COLUMN IF NOT EXISTS income_account_id uuid REFERENCES accounts(id)`);

    await db.execute(sql`ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS status payment_status DEFAULT 'posted' NOT NULL`);
    await db.execute(sql`ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);

    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);

    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);

    await db.execute(sql`ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);

    await db.execute(sql`ALTER TABLE inventory_adjustments ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id)`);
    await db.execute(sql`ALTER TABLE inventory_adjustments ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES users(id)`);

    console.log('[Migration] Approval workflow tables and columns created.');

    // ── Nigerian Banking Integration — Provider Connections & Gateway Transactions ──
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE bank_feed_provider AS ENUM ('mono', 'paystack', 'flutterwave', 'moniepoint');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE bank_connection_status AS ENUM ('active', 'reauth_required', 'expired', 'disconnected', 'pending');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE payment_gateway AS ENUM ('paystack', 'flutterwave', 'moniepoint');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE gateway_txn_status AS ENUM ('pending', 'success', 'failed', 'settled', 'partial_refund', 'full_refund');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_connections (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        bank_account_id uuid REFERENCES bank_accounts(id) NOT NULL,
        provider bank_feed_provider NOT NULL,
        provider_account_id text,
        provider_account_name text,
        status bank_connection_status DEFAULT 'pending' NOT NULL,
        auth_token text,
        refresh_token text,
        token_expires_at timestamp,
        last_synced_at timestamp,
        meta jsonb DEFAULT '{}'::jsonb,
        error_message text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bank_connections_org ON bank_connections(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bank_connections_bank_account ON bank_connections(bank_account_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bank_connections_provider ON bank_connections(provider)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        provider payment_gateway NOT NULL,
        gateway_transaction_id text NOT NULL,
        reference text NOT NULL,
        amount bigint NOT NULL,
        fee bigint DEFAULT 0 NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        status gateway_txn_status DEFAULT 'pending' NOT NULL,
        customer_email text,
        customer_name text,
        customer_phone text,
        description text,
        bank_account_id uuid REFERENCES bank_accounts(id),
        matched_transaction_id uuid REFERENCES bank_transactions(id),
        payment_method text,
        channel text,
        raw_data jsonb DEFAULT '{}'::jsonb,
        settled_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgt_org ON payment_gateway_transactions(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgt_provider ON payment_gateway_transactions(provider)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgt_status ON payment_gateway_transactions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgt_gateway_txn_id ON payment_gateway_transactions(gateway_transaction_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgt_reference ON payment_gateway_transactions(reference)`);

    console.log('[Migration] Nigerian Banking Integration tables created.');

    // ── OCR Document Processing Tables ──
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE ocr_doc_type AS ENUM ('invoice', 'bill', 'receipt', 'purchase_order');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE ocr_doc_status AS ENUM ('pending', 'extracting', 'ready', 'posted', 'error');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ocr_documents (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        file_name text NOT NULL,
        file_url text NOT NULL,
        file_type text,
        file_size integer,
        doc_type ocr_doc_type,
        status ocr_doc_status DEFAULT 'pending' NOT NULL,
        extracted_data jsonb,
        suggested_journal jsonb,
        journal_entry_id uuid REFERENCES journal_entries(id),
        confirmed_by uuid REFERENCES users(id),
        confirmed_at timestamp,
        error_message text,
        uploaded_by uuid REFERENCES users(id) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ocr_docs_org ON ocr_documents(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ocr_docs_status ON ocr_documents(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ocr_docs_doc_type ON ocr_documents(doc_type)`);

    console.log('[Migration] OCR Document Processing tables created.');

    // ===== MULTI-COMPANY / GROUP STRUCTURE =====
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE consolidation_method AS ENUM ('full', 'equity', 'proportionate');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE intercompany_txn_type AS ENUM ('loan', 'goods', 'service', 'royalty', 'dividend', 'management_fee', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE intercompany_txn_status AS ENUM ('pending', 'matched', 'settled', 'eliminated');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE elimination_method AS ENUM ('auto', 'manual');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Groups table — top-level group entity for consolidation
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS groups (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name text NOT NULL,
        base_currency text DEFAULT 'NGN' NOT NULL,
        parent_group_id uuid,
        settings jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);

    // Group members — orgs belonging to a group with ownership % and consolidation method
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS group_members (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) NOT NULL,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        ownership_percentage numeric(5,2) DEFAULT 100 NOT NULL,
        consolidation_method consolidation_method DEFAULT 'full' NOT NULL,
        is_parent boolean DEFAULT false NOT NULL,
        start_date timestamp,
        end_date timestamp,
        settings jsonb DEFAULT '{}'::jsonb NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_group_members_org ON group_members(org_id)`);

    // User organisation access — multi-org membership junction table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_organisation_access (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid REFERENCES users(id) NOT NULL,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        role user_role DEFAULT 'staff' NOT NULL,
        is_default boolean DEFAULT false NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_uoa_user ON user_organisation_access(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_uoa_org ON user_organisation_access(org_id)`);

    // Intercompany transactions — transactions between entities in a group
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS intercompany_transactions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) NOT NULL,
        from_org_id uuid REFERENCES organisations(id) NOT NULL,
        to_org_id uuid REFERENCES organisations(id) NOT NULL,
        transaction_type intercompany_txn_type NOT NULL,
        status intercompany_txn_status DEFAULT 'pending' NOT NULL,
        reference text,
        description text NOT NULL,
        amount bigint NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        fx_rate numeric(18,8),
        date timestamp NOT NULL,
        due_date timestamp,
        settled_amount bigint,
        settled_date timestamp,
        from_journal_entry_id uuid REFERENCES journal_entries(id),
        to_journal_entry_id uuid REFERENCES journal_entries(id),
        created_by uuid REFERENCES users(id),
        notes text,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ic_txn_group ON intercompany_transactions(group_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ic_txn_from ON intercompany_transactions(from_org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ic_txn_to ON intercompany_transactions(to_org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ic_txn_status ON intercompany_transactions(status)`);

    // Intercompany eliminations — elimination entries for consolidation
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS intercompany_eliminations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) NOT NULL,
        consolidation_run_id uuid,
        transaction_id uuid REFERENCES intercompany_transactions(id),
        elimination_method elimination_method DEFAULT 'auto' NOT NULL,
        description text NOT NULL,
        from_org_id uuid REFERENCES organisations(id) NOT NULL,
        to_org_id uuid REFERENCES organisations(id) NOT NULL,
        account_code varchar(20),
        amount bigint NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        fx_rate numeric(18,8),
        journal_entry_id uuid REFERENCES journal_entries(id),
        created_by uuid REFERENCES users(id),
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ic_elim_group ON intercompany_eliminations(group_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ic_elim_run ON intercompany_eliminations(consolidation_run_id)`);

    // Group consolidation runs — history of consolidation runs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS group_consolidation_runs (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) NOT NULL,
        report_type text NOT NULL,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        as_of_date timestamp,
        status text DEFAULT 'completed' NOT NULL,
        includes_eliminations boolean DEFAULT true NOT NULL,
        includes_nci boolean DEFAULT true NOT NULL,
        currency_translation_method text DEFAULT 'closing_rate',
        total_orgs integer DEFAULT 0 NOT NULL,
        result_data jsonb,
        error_message text,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_consol_runs_group ON group_consolidation_runs(group_id)`);

    console.log('[Migration] Multi-company / Group structure tables created.');

    // ----------------------------------------------------------------
    // Performance indexes on core tables
    // ----------------------------------------------------------------
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON journal_entries(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_source_id ON journal_entries(source_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_number ON journal_entries(org_id, entry_number)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_entries_created ON journal_entries(org_id, created_at)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(org_id, code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(system_account_role)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(org_id, type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(org_id, email)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(org_id, customer_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(org_id, status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(org_id, date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_org ON bills(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(org_id, vendor_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(org_id, status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(org_id, date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bill_lines_bill ON bill_lines(bill_id)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_payments_made_org ON payments_made(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_payments_made_date ON payments_made(org_id, date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_payments_received_org ON payments_received(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_payments_received_date ON payments_received(org_id, date)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_items_org ON items(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_items_sku ON items(org_id, sku)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(refresh_token_hash)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid REFERENCES users(id) NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamp NOT NULL,
        used_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)`);

    // Platform users table (separate from tenant users)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE platform_role AS ENUM ('ceo', 'director', 'super_admin', 'support', 'finance', 'marketing', 'developer', 'customer_success');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_users (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        email text NOT NULL,
        password_hash text,
        full_name text,
        role platform_role DEFAULT 'super_admin' NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        avatar_url text,
        last_login timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_sessions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        platform_user_id uuid REFERENCES platform_users(id) NOT NULL,
        refresh_token_hash text NOT NULL,
        expires_at timestamp NOT NULL,
        ip_address text,
        user_agent text,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_sessions_user ON platform_sessions(platform_user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_sessions_token ON platform_sessions(refresh_token_hash)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_sessions_expires ON platform_sessions(expires_at)`);

    // Seed initial platform admin from SUPER_ADMIN_EMAILS env var
    const seedAdminEmail = process.env.SUPER_ADMIN_EMAILS?.split(',')[0]?.trim().toLowerCase();
    if (seedAdminEmail) {
      const existingAdmin = await db.execute(sql`SELECT id FROM platform_users WHERE email = ${seedAdminEmail} LIMIT 1`);
      if (existingAdmin.rows.length === 0) {
        const seedPassword = process.env.SEED_PLATFORM_ADMIN_PASSWORD || 'admin123';
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(seedPassword, 12);
        await db.execute(sql`
          INSERT INTO platform_users (email, password_hash, full_name, role, is_active)
          VALUES (${seedAdminEmail}, ${hashedPassword}, 'Platform Administrator', 'super_admin', true)
          ON CONFLICT DO NOTHING
        `);
        console.log(`[Migration] Seeded initial platform admin: ${seedAdminEmail}`);
      }
    }

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(org_id, created_at)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(bank_account_id, date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(bank_account_id, status)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fixed_assets_org ON fixed_assets(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fixed_assets_account ON fixed_assets(account_id)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_leases_org ON leases(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_revenue_contracts_org ON revenue_contracts(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_obligations_contract ON performance_obligations(contract_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_rev_schedules_obligation ON revenue_schedules(obligation_id)`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_payroll_runs_org ON payroll_runs(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_inv_adjustment_items_item ON inventory_adjustment_items(item_id)`);

    // --------------------------------
    // Recurring Bills table
    // --------------------------------
    await db.execute(sql`CREATE TABLE IF NOT EXISTS recurring_bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organisations(id),
      vendor_id UUID NOT NULL REFERENCES contacts(id),
      frequency TEXT NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      next_run_date TIMESTAMP,
      is_active BOOLEAN DEFAULT true NOT NULL,
      template JSONB,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT now() NOT NULL
    )`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_recurring_bills_org ON recurring_bills(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_recurring_bills_vendor ON recurring_bills(vendor_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_recurring_bills_next_run ON recurring_bills(next_run_date)`);

    // Add recurring_id FK to bills if not present
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES recurring_bills(id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bills_recurring ON bills(recurring_id)`);

    // Also add recurring_id to invoices for schema consistency
    await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_id UUID`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_invoices_recurring ON invoices(recurring_id)`);

    console.log('[Migration] Recurring bills table created.');

    // Add last_reminder_sent_at columns
    await db.execute(sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP`);
    console.log('[Migration] last_reminder_sent_at columns added to invoices and bills.');

    console.log('[Migration] Performance indexes created on core tables.');

    // ----------------------------------------------------------------
    // Subscription Management System (SMS) — enums, tables, defaults
    // ----------------------------------------------------------------
    // Create new enum and migrate existing data
    // Note: the subscription_status type may not exist on fresh databases — the
    // status migration block below is wrapped in try/catch so it won't crash on first run.
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE subscription_status_new AS ENUM ('free_trial', 'active', 'grace_period', 'suspended', 'expired', 'cancelled', 'pending_payment', 'failed_payment', 'renewing', 'downgraded', 'upgraded', 'paused');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    try {
      await db.execute(sql`ALTER TABLE subscriptions ALTER COLUMN status TYPE text`);
      await db.execute(sql`
        UPDATE subscriptions SET status = 'free_trial' WHERE status = 'trialing'
      `);
      await db.execute(sql`
        UPDATE subscriptions SET status = 'grace_period' WHERE status = 'past_due'
      `);
      await db.execute(sql`
        UPDATE subscriptions SET status = 'cancelled' WHERE status = 'canceled'
      `);
      await db.execute(sql`
        UPDATE subscriptions SET status = 'pending_payment' WHERE status = 'incomplete'
      `);
      await db.execute(sql`
        UPDATE subscriptions SET status = 'expired' WHERE status = 'incomplete_expired'
      `);
      await db.execute(sql`
        ALTER TABLE subscriptions ALTER COLUMN status TYPE subscription_status_new USING status::text::subscription_status_new
      `);
      await db.execute(sql`DROP TYPE IF EXISTS subscription_status`);
      await db.execute(sql`ALTER TYPE subscription_status_new RENAME TO subscription_status`);
    } catch (err) {
      console.log('[Migration] Subscription status migration skipped (table may not exist on fresh database)');
    }
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly', 'quarterly');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE sub_invoice_status AS ENUM ('pending', 'paid', 'overdue', 'canceled', 'refunded');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Subscription plans
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id),
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        description text,
        monthly_price_kobo bigint DEFAULT 0 NOT NULL,
        annual_price_kobo bigint DEFAULT 0 NOT NULL,
        currency text DEFAULT 'NGN' NOT NULL,
        billing_cycle billing_cycle DEFAULT 'monthly' NOT NULL,
        trial_days integer DEFAULT 0 NOT NULL,
        user_limit integer DEFAULT 1 NOT NULL,
        max_companies integer DEFAULT 1 NOT NULL,
        storage_limit_gb integer DEFAULT 1 NOT NULL,
        api_requests integer DEFAULT 0 NOT NULL,
        max_customers integer DEFAULT 0 NOT NULL,
        max_vendors integer DEFAULT 0 NOT NULL,
        max_products integer DEFAULT 0 NOT NULL,
        max_invoices integer DEFAULT 0 NOT NULL,
        max_transactions integer DEFAULT 0 NOT NULL,
        max_bank_accounts integer DEFAULT 0 NOT NULL,
        max_warehouses integer DEFAULT 0 NOT NULL,
        max_projects integer DEFAULT 0 NOT NULL,
        max_assets integer DEFAULT 0 NOT NULL,
        max_reports integer DEFAULT 0 NOT NULL,
        max_ai_requests integer DEFAULT 0 NOT NULL,
        max_ocr_documents integer DEFAULT 0 NOT NULL,
        support_level text DEFAULT 'community' NOT NULL,
        popular_badge boolean DEFAULT false NOT NULL,
        recommended_badge boolean DEFAULT false NOT NULL,
        ribbon_color text,
        button_text text DEFAULT 'Subscribe' NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        is_archived boolean DEFAULT false NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        is_public boolean DEFAULT true NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_plans_active ON subscription_plans(is_active, sort_order)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_plans_code ON subscription_plans(code)`);

    // Migration: add new columns to existing subscription_plans tables
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS monthly_price_kobo bigint DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS annual_price_kobo bigint DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN' NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_companies integer DEFAULT 1 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS storage_limit_gb integer DEFAULT 1 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS api_requests integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_customers integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_vendors integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_products integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_invoices integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_transactions integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_bank_accounts integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_warehouses integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_projects integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_assets integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_reports integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_ai_requests integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_ocr_documents integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS support_level text DEFAULT 'community' NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS popular_badge boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS recommended_badge boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS ribbon_color text`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'Subscribe' NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS modules text[] DEFAULT '{}' NOT NULL`);
    await db.execute(sql`ALTER TABLE subscription_plans DROP COLUMN IF EXISTS features`);
    await db.execute(sql`ALTER TABLE subscription_plans DROP COLUMN IF EXISTS storage_limit_mb`);
    await db.execute(sql`ALTER TABLE subscription_plans DROP COLUMN IF EXISTS price_kobo`);

    // Ensure subscription_status type exists (in case status migration was skipped on fresh DB)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE subscription_status AS ENUM ('free_trial', 'active', 'grace_period', 'suspended', 'expired', 'cancelled', 'pending_payment', 'failed_payment', 'renewing', 'downgraded', 'upgraded', 'paused');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Coupons (must be created before subscriptions which references it)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS coupons (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id),
        code text NOT NULL,
        description text,
        discount_type discount_type DEFAULT 'percentage' NOT NULL,
        discount_percent integer,
        discount_amount_kobo bigint,
        max_redemptions integer DEFAULT 0,
        current_redemptions integer DEFAULT 0 NOT NULL,
        min_amount_kobo bigint,
        max_amount_kobo bigint,
        applicable_plan_ids uuid[],
        expires_at timestamp,
        is_active boolean DEFAULT true NOT NULL,
        is_first_order_only boolean DEFAULT false NOT NULL,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_coupon_code ON coupons(code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_coupon_active ON coupons(is_active, expires_at)`);

    // Promotions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS promotions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id),
        name text NOT NULL,
        description text,
        discount_type discount_type DEFAULT 'percentage' NOT NULL,
        discount_percent integer,
        discount_amount_kobo bigint,
        applicable_plan_ids uuid[],
        start_date timestamp NOT NULL,
        end_date timestamp NOT NULL,
        max_redemptions integer DEFAULT 0,
        current_redemptions integer DEFAULT 0 NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_by uuid REFERENCES users(id),
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active, start_date, end_date)`);

    // Subscriptions (must be created after subscription_plans, coupons, promotions)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        plan_id uuid REFERENCES subscription_plans(id) NOT NULL,
        status subscription_status DEFAULT 'active' NOT NULL,
        current_period_start timestamp NOT NULL,
        current_period_end timestamp NOT NULL,
        trial_start timestamp,
        trial_end timestamp,
        canceled_at timestamp,
        billing_cycle_anchor timestamp NOT NULL,
        coupon_id uuid REFERENCES coupons(id),
        promotion_id uuid REFERENCES promotions(id),
        auto_renew boolean DEFAULT true NOT NULL,
        next_billing_date timestamp,
        last_payment_date timestamp,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_org ON subscriptions(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_plan ON subscriptions(plan_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_org_status ON subscriptions(org_id, status)`);

    // Subscription invoices
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_invoices (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        subscription_id uuid REFERENCES subscriptions(id),
        invoice_number text NOT NULL,
        description text,
        amount_kobo bigint DEFAULT 0 NOT NULL,
        tax_kobo bigint DEFAULT 0 NOT NULL,
        total_kobo bigint DEFAULT 0 NOT NULL,
        discount_kobo bigint DEFAULT 0 NOT NULL,
        status sub_invoice_status DEFAULT 'pending' NOT NULL,
        period_start timestamp,
        period_end timestamp,
        due_date timestamp,
        paid_at timestamp,
        paid_by uuid REFERENCES users(id),
        coupon_id uuid REFERENCES coupons(id),
        promotion_id uuid REFERENCES promotions(id),
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_inv_org ON subscription_invoices(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_inv_sub ON subscription_invoices(subscription_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_inv_status ON subscription_invoices(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sub_inv_number ON subscription_invoices(invoice_number)`);

    // Subscription usage
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_usage (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        subscription_id uuid REFERENCES subscriptions(id) NOT NULL,
        feature_key text NOT NULL,
        usage_count integer DEFAULT 0 NOT NULL,
        usage_limit integer,
        period_start timestamp NOT NULL,
        period_end timestamp NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_sub_feature ON subscription_usage(subscription_id, feature_key)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_org_period ON subscription_usage(org_id, period_start, period_end)`);

    // Subscription feature overrides
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_feature_overrides (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        plan_id uuid REFERENCES subscription_plans(id),
        subscription_id uuid REFERENCES subscriptions(id),
        feature_key text NOT NULL,
        feature_value jsonb NOT NULL,
        is_limit boolean DEFAULT false NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_foverride_plan ON subscription_feature_overrides(plan_id, feature_key)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_foverride_sub ON subscription_feature_overrides(subscription_id, feature_key)`);

    // Subscription status history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_status_history (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        subscription_id uuid REFERENCES subscriptions(id) NOT NULL,
        from_status subscription_status,
        to_status subscription_status NOT NULL,
        reason text,
        changed_by uuid REFERENCES users(id),
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ssh_sub ON subscription_status_history(subscription_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ssh_created ON subscription_status_history(created_at)`);

    // Seed default plans
    await db.execute(sql`
      INSERT INTO subscription_plans (id, code, name, description, monthly_price_kobo, annual_price_kobo, currency, billing_cycle, trial_days, modules, user_limit, max_companies, storage_limit_gb, api_requests, max_customers, max_vendors, max_products, max_invoices, max_transactions, max_bank_accounts, max_warehouses, max_projects, max_assets, max_reports, max_ai_requests, max_ocr_documents, support_level, popular_badge, recommended_badge, button_text, is_active, is_archived, sort_order, is_public)
      VALUES
        (gen_random_uuid(), 'free', 'Free', 'For small businesses getting started', 0, 0, 'NGN', 'monthly', 0, '{}', 1, 1, 1, 100, 50, 25, 10, 50, 500, 2, 0, 0, 0, 5, 10, 10, 'community', false, false, 'Get Started', true, false, 1, true),
        (gen_random_uuid(), 'starter', 'Starter', 'For growing businesses', 900000, 9000000, 'NGN', 'monthly', 14, '{}', 3, 3, 5, 1000, 500, 250, 100, 500, 5000, 5, 1, 5, 5, 20, 50, 50, 'email', false, false, 'Start Free Trial', true, false, 2, true),
        (gen_random_uuid(), 'professional', 'Professional', 'For established businesses', 1500000, 15000000, 'NGN', 'monthly', 14, '{crm,hrm}', 10, 10, 20, 10000, 2000, 1000, 500, 2000, 25000, 10, 5, 20, 20, 50, 200, 200, 'priority', true, false, 'Start Free Trial', true, false, 3, true),
        (gen_random_uuid(), 'enterprise', 'Enterprise', 'For large organisations', 2500000, 25000000, 'NGN', 'monthly', 14, '{crm,hrm}', 100, 100, 100, 0, 10000, 5000, 2000, 10000, 0, 50, 20, 50, 50, 200, 500, 500, 'dedicated', false, false, 'Contact Sales', true, false, 4, true)
      ON CONFLICT (code) DO NOTHING
    `);

    // Assign Free plan to existing orgs without a subscription
    await db.execute(sql`
      INSERT INTO subscriptions (id, org_id, plan_id, status, current_period_start, current_period_end, billing_cycle_anchor, auto_renew)
      SELECT gen_random_uuid(), o.id, sp.id, 'active', now(), now() + interval '1 month', now(), true
      FROM organisations o
      CROSS JOIN subscription_plans sp
      WHERE sp.code = 'free'
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.org_id = o.id)
      ON CONFLICT DO NOTHING
    `);

    // Add new columns to existing subscriptions table
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_period_end timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS suspended_at timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_at timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paused_end timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false NOT NULL`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_renewal_attempt timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_failure_count integer DEFAULT 0 NOT NULL`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS expiration_reminder_sent_at timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS previous_plan_id uuid REFERENCES subscription_plans(id)`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_plan_id uuid REFERENCES subscription_plans(id)`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scheduled_change_at timestamp`);
    await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly' NOT NULL`);

    // Update Professional and Enterprise plans: 7-day free trial, Enterprise gets Start Free Trial button
    await db.execute(sql`
      UPDATE subscription_plans SET trial_days = 7 WHERE code IN ('professional', 'enterprise') AND trial_days = 0
    `);
    await db.execute(sql`
      UPDATE subscription_plans SET trial_days = 7 WHERE code = 'professional' AND trial_days = 14
    `);
    await db.execute(sql`
      UPDATE subscription_plans SET button_text = 'Start Free Trial' WHERE code = 'enterprise' AND button_text = 'Contact Sales'
    `);

    console.log('[Migration] Subscription Management System tables created.');

    // ----------------------------------------------------------------
    // Feature Flag System — tables and seed data
    // ----------------------------------------------------------------
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE feature_flag_state AS ENUM ('enabled', 'disabled', 'limited', 'unlimited');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        category text DEFAULT 'general' NOT NULL,
        default_state feature_flag_state DEFAULT 'disabled' NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        sort_order integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ff_code ON feature_flags(code)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ff_category ON feature_flags(category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ff_active ON feature_flags(is_active, sort_order)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_feature_flags (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        plan_id uuid REFERENCES subscription_plans(id) NOT NULL,
        feature_code text NOT NULL,
        state feature_flag_state DEFAULT 'disabled' NOT NULL,
        usage_limit integer DEFAULT 0,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pff_plan ON plan_feature_flags(plan_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pff_code ON plan_feature_flags(feature_code)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pff_plan_feature ON plan_feature_flags(plan_id, feature_code)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS org_feature_flags (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id uuid REFERENCES organisations(id) NOT NULL,
        feature_code text NOT NULL,
        state feature_flag_state,
        usage_limit integer,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_off_org ON org_feature_flags(org_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_off_code ON org_feature_flags(feature_code)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_off_org_feature ON org_feature_flags(org_id, feature_code)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_feature_flags (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid REFERENCES users(id) NOT NULL,
        feature_code text NOT NULL,
        state feature_flag_state,
        usage_limit integer,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_uff_user ON user_feature_flags(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_uff_code ON user_feature_flags(feature_code)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_uff_user_feature ON user_feature_flags(user_id, feature_code)`);

    // Seed 21 default features
    await db.execute(sql`
      INSERT INTO feature_flags (id, code, name, description, category, default_state, sort_order)
      VALUES
        (gen_random_uuid(), 'inventory', 'Inventory', 'Inventory management with stock control, transfers, and adjustments', 'operations', 'limited', 10),
        (gen_random_uuid(), 'payroll', 'Payroll', 'Payroll processing with PAYE, NHF, NSITF, ITF computations', 'hr', 'disabled', 20),
        (gen_random_uuid(), 'fixed-assets', 'Fixed Assets', 'Fixed asset register with depreciation, revaluation, impairment', 'accounting', 'disabled', 30),
        (gen_random_uuid(), 'projects', 'Projects', 'Project management with budgeting, time tracking, profitability', 'operations', 'disabled', 40),
        (gen_random_uuid(), 'bank-feeds', 'Bank Feeds', 'Automatic bank reconciliation with feeds from Paystack/Flutterwave/Moniepoint', 'banking', 'enabled', 50),
        (gen_random_uuid(), 'ocr', 'OCR', 'AI-powered OCR document scanning and data extraction', 'automation', 'disabled', 60),
        (gen_random_uuid(), 'ai-assistant', 'AI Assistant', 'AI-powered accounting assistant for queries and automation', 'automation', 'disabled', 70),
        (gen_random_uuid(), 'budgets', 'Budgets', 'Budget creation, tracking, and variance analysis', 'accounting', 'disabled', 80),
        (gen_random_uuid(), 'forecasting', 'Forecasting', 'Financial forecasting and predictive analytics', 'analytics', 'disabled', 90),
        (gen_random_uuid(), 'revenue-recognition', 'Revenue Recognition', 'IFRS 15 revenue recognition with contracts and schedules', 'accounting', 'disabled', 100),
        (gen_random_uuid(), 'warehouse', 'Warehouse', 'Multi-warehouse inventory management', 'operations', 'disabled', 110),
        (gen_random_uuid(), 'custom-roles', 'Custom Roles', 'Custom role-based access control for team members', 'admin', 'disabled', 120),
        (gen_random_uuid(), 'approval-workflow', 'Approval Workflow', 'Multi-step approval workflows for transactions', 'admin', 'disabled', 130),
        (gen_random_uuid(), 'api-access', 'API Access', 'REST API access for third-party integrations', 'admin', 'disabled', 140),
        (gen_random_uuid(), 'dashboard-analytics', 'Dashboard Analytics', 'Advanced dashboard with charts and KPIs', 'analytics', 'enabled', 150),
        (gen_random_uuid(), 'advanced-reports', 'Advanced Reports', 'Custom report builder with advanced filters and exports', 'reports', 'disabled', 160),
        (gen_random_uuid(), 'audit-trail', 'Audit Trail', 'Detailed audit log of all user actions and changes', 'admin', 'enabled', 170),
        (gen_random_uuid(), 'consolidation', 'Consolidation', 'Multi-entity financial consolidation with eliminations', 'accounting', 'disabled', 180),
        (gen_random_uuid(), 'multi-currency', 'Multi Currency', 'Multi-currency transaction support with auto FX rates', 'accounting', 'disabled', 190),
        (gen_random_uuid(), 'tax-automation', 'Tax Automation', 'Automated VAT, WHT, CIT, PAYE, ITF, NSITF computations', 'accounting', 'disabled', 200),
        (gen_random_uuid(), 'business-intelligence', 'Business Intelligence', 'Advanced BI dashboards and data visualization', 'analytics', 'disabled', 210)
      ON CONFLICT (code) DO NOTHING
    `);

    // Assign default feature flags to all existing plans
    await db.execute(sql`
      INSERT INTO plan_feature_flags (id, plan_id, feature_code, state, usage_limit)
      SELECT gen_random_uuid(), sp.id, ff.code,
        CASE
          WHEN sp.code = 'free' AND ff.code IN ('bank-feeds', 'dashboard-analytics', 'audit-trail', 'inventory') THEN 'enabled'::feature_flag_state
          WHEN sp.code = 'free' THEN 'disabled'::feature_flag_state
          WHEN sp.code IN ('starter', 'professional') AND ff.code IN ('bank-feeds', 'dashboard-analytics', 'audit-trail', 'inventory', 'projects', 'budgets', 'fixed-assets', 'multi-currency', 'tax-automation', 'ocr', 'ai-assistant') THEN 'enabled'::feature_flag_state
          WHEN sp.code IN ('starter', 'professional') AND ff.code = 'payroll' THEN 'limited'::feature_flag_state
          WHEN sp.code = 'enterprise' THEN 'enabled'::feature_flag_state
          ELSE ff.default_state::feature_flag_state
        END,
        CASE
          WHEN sp.code = 'free' AND ff.code = 'inventory' THEN 50
          WHEN sp.code = 'starter' AND ff.code = 'payroll' THEN 10
          WHEN sp.code = 'professional' AND ff.code = 'payroll' THEN 50
          ELSE 0
        END
      FROM subscription_plans sp
      CROSS JOIN feature_flags ff
      ON CONFLICT (plan_id, feature_code) DO NOTHING
    `);

    console.log('[Migration] Feature flag system created and seeded.');

    // Setup Subscription Payment & Billing tables
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_gateway_configs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id) NOT NULL,
          gateway TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          public_key TEXT,
          secret_key TEXT,
          webhook_secret TEXT,
          environment TEXT DEFAULT 'live' NOT NULL,
          is_default BOOLEAN DEFAULT false NOT NULL,
          created_at TIMESTAMP DEFAULT now() NOT NULL,
          updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_pgc_org ON payment_gateway_configs(org_id)
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pgc_org_gateway ON payment_gateway_configs(org_id, gateway)
      `);

      await pool.query(`
        CREATE OR REPLACE FUNCTION update_gateway_config_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = now(); RETURN NEW; END;
        $$ LANGUAGE plpgsql
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS trg_gateway_config_updated_at ON payment_gateway_configs
      `);
      await pool.query(`
        CREATE TRIGGER trg_gateway_config_updated_at
        BEFORE UPDATE ON payment_gateway_configs
        FOR EACH ROW EXECUTE FUNCTION update_gateway_config_updated_at()
      `);

      // subscription_payments table
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sub_payment_method') THEN
            CREATE TYPE sub_payment_method AS ENUM ('card', 'bank_transfer', 'ussd', 'wallet', 'unknown');
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sub_payment_status') THEN
            CREATE TYPE sub_payment_status AS ENUM ('pending', 'success', 'failed', 'refunded', 'partial_refund', 'cancelled');
          END IF;
        END $$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_payments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id) NOT NULL,
          subscription_id UUID REFERENCES subscriptions(id) NOT NULL,
          invoice_id UUID REFERENCES subscription_invoices(id),
          gateway TEXT NOT NULL,
          gateway_reference TEXT NOT NULL,
          gateway_transaction_id TEXT,
          amount_kobo BIGINT NOT NULL,
          fee_kobo BIGINT DEFAULT 0,
          currency TEXT DEFAULT 'NGN' NOT NULL,
          status sub_payment_status DEFAULT 'pending' NOT NULL,
          payment_method sub_payment_method DEFAULT 'unknown',
          payer_email TEXT,
          payer_name TEXT,
          channel TEXT,
          is_auto_renewal BOOLEAN DEFAULT false NOT NULL,
          is_retry BOOLEAN DEFAULT false NOT NULL,
          retry_attempt INTEGER DEFAULT 0,
          receipt_url TEXT,
          authorization_url TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          raw_response JSONB DEFAULT '{}'::jsonb,
          paid_at TIMESTAMP,
          settled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT now() NOT NULL,
          updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        DO $$ BEGIN
          CREATE INDEX IF NOT EXISTS idx_sub_pay_org ON subscription_payments(org_id);
          CREATE INDEX IF NOT EXISTS idx_sub_pay_sub ON subscription_payments(subscription_id);
          CREATE INDEX IF NOT EXISTS idx_sub_pay_inv ON subscription_payments(invoice_id);
          CREATE INDEX IF NOT EXISTS idx_sub_pay_ref ON subscription_payments(gateway_reference);
          CREATE INDEX IF NOT EXISTS idx_sub_pay_status ON subscription_payments(status);
          CREATE INDEX IF NOT EXISTS idx_sub_pay_created ON subscription_payments(created_at);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END $$;
      `);

      await pool.query(`
        CREATE OR REPLACE FUNCTION update_sub_payment_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = now(); RETURN NEW; END;
        $$ LANGUAGE plpgsql
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS trg_sub_payment_updated_at ON subscription_payments
      `);
      await pool.query(`
        CREATE TRIGGER trg_sub_payment_updated_at
        BEFORE UPDATE ON subscription_payments
        FOR EACH ROW EXECUTE FUNCTION update_sub_payment_updated_at()
      `);

      // payment_receipts table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_receipts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id) NOT NULL,
          payment_id UUID REFERENCES subscription_payments(id) NOT NULL,
          invoice_id UUID REFERENCES subscription_invoices(id),
          receipt_number TEXT NOT NULL,
          title TEXT NOT NULL,
          html_content TEXT,
          pdf_url TEXT,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        DO $$ BEGIN
          CREATE INDEX IF NOT EXISTS idx_pr_org ON payment_receipts(org_id);
          CREATE INDEX IF NOT EXISTS idx_pr_payment ON payment_receipts(payment_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_receipt_num ON payment_receipts(receipt_number);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END $$;
      `);

      // Add columns to subscription_invoices
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_invoices' AND column_name = 'payment_method') THEN
            ALTER TABLE subscription_invoices ADD COLUMN payment_method sub_payment_method;
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_invoices' AND column_name = 'gateway_reference') THEN
            ALTER TABLE subscription_invoices ADD COLUMN gateway_reference TEXT;
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_invoices' AND column_name = 'gateway_response') THEN
            ALTER TABLE subscription_invoices ADD COLUMN gateway_response JSONB DEFAULT '{}'::jsonb;
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_invoices' AND column_name = 'attempt_count') THEN
            ALTER TABLE subscription_invoices ADD COLUMN attempt_count INTEGER DEFAULT 0 NOT NULL;
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_invoices' AND column_name = 'last_attempt_at') THEN
            ALTER TABLE subscription_invoices ADD COLUMN last_attempt_at TIMESTAMP;
          END IF;
        END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_invoices' AND column_name = 'receipt_url') THEN
            ALTER TABLE subscription_invoices ADD COLUMN receipt_url TEXT;
          END IF;
        END $$;
      `);

      console.log('[Migration] Subscription payment/billing tables created.');
    } catch (err) {
      console.error('[Migration] Subscription billing tables error:', err);
    }

    // Setup Promotions Engine tables
    try {
      // promo_campaign_status enum
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_campaign_status') THEN
            CREATE TYPE promo_campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');
          END IF;
        END $$;
      `);
      // referral_reward_type enum
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_reward_type') THEN
            CREATE TYPE referral_reward_type AS ENUM ('percentage', 'fixed_amount', 'free_months');
          END IF;
        END $$;
      `);
      // Update discount_type enum to add new values
      await pool.query(`
        DO $$ BEGIN
          ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'free_months';
          ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'referral_reward';
          ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'partner_commission';
        EXCEPTION WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
        END $$;
      `);

      // promotional_campaigns table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS promotional_campaigns (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id),
          name TEXT NOT NULL,
          description TEXT,
          type TEXT DEFAULT 'general' NOT NULL,
          status promo_campaign_status DEFAULT 'draft' NOT NULL,
          start_date TIMESTAMP,
          end_date TIMESTAMP,
          budget_kobo BIGINT,
          spent_kobo BIGINT DEFAULT 0,
          target_plan_ids UUID[],
          target_regions TEXT[],
          max_redemptions INTEGER DEFAULT 0,
          current_redemptions INTEGER DEFAULT 0 NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT now() NOT NULL,
          updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_camp_org ON promotional_campaigns(org_id);
        CREATE INDEX IF NOT EXISTS idx_camp_status ON promotional_campaigns(status, start_date, end_date)
      `);
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_campaign_updated_at()
        RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql
      `);
      await pool.query(`
        DROP TRIGGER IF EXISTS trg_campaign_updated_at ON promotional_campaigns;
        CREATE TRIGGER trg_campaign_updated_at BEFORE UPDATE ON promotional_campaigns FOR EACH ROW EXECUTE FUNCTION update_campaign_updated_at()
      `);

      // Add columns to coupons
      const couponColumns = [
        { name: 'free_months', def: 'INTEGER DEFAULT 0' },
        { name: 'min_plan_id', def: 'UUID REFERENCES subscription_plans(id)' },
        { name: 'max_plan_id', def: 'UUID REFERENCES subscription_plans(id)' },
        { name: 'region_restrictions', def: 'TEXT[]' },
        { name: 'campaign_id', def: 'UUID REFERENCES promotional_campaigns(id)' },
        { name: 'is_stackable', def: 'BOOLEAN DEFAULT false NOT NULL' },
        { name: 'priority', def: 'INTEGER DEFAULT 0 NOT NULL' },
        { name: 'require_minimum_payment', def: 'BOOLEAN DEFAULT false' },
      ];
      // ALTER coupon code to be unique
      await pool.query(`ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_code_key`);
      await pool.query(`
        DO $$ BEGIN
          DROP INDEX IF EXISTS idx_coupon_code;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_code ON coupons(code);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END $$;
      `);
      for (const col of couponColumns) {
        await pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupons' AND column_name = '${col.name}') THEN
              ALTER TABLE coupons ADD COLUMN ${col.name} ${col.def};
            END IF;
          END $$;
        `);
      }

      // Add columns to promotions
      const promoCols = [
        { name: 'free_months', def: 'INTEGER DEFAULT 0' },
        { name: 'min_plan_id', def: 'UUID REFERENCES subscription_plans(id)' },
        { name: 'max_plan_id', def: 'UUID REFERENCES subscription_plans(id)' },
        { name: 'region_restrictions', def: 'TEXT[]' },
        { name: 'campaign_id', def: 'UUID REFERENCES promotional_campaigns(id)' },
        { name: 'is_stackable', def: 'BOOLEAN DEFAULT false NOT NULL' },
        { name: 'priority', def: 'INTEGER DEFAULT 0 NOT NULL' },
        { name: 'budget_kobo', def: 'BIGINT' },
        { name: 'spent_kobo', def: 'BIGINT DEFAULT 0' },
      ];
      for (const col of promoCols) {
        await pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = '${col.name}') THEN
              ALTER TABLE promotions ADD COLUMN ${col.name} ${col.def};
            END IF;
          END $$;
        `);
      }

      // referral_codes table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS referral_codes (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id) NOT NULL,
          referrer_org_id UUID REFERENCES organisations(id),
          referrer_user_id UUID REFERENCES users(id),
          code TEXT NOT NULL UNIQUE,
          description TEXT,
          reward_type referral_reward_type DEFAULT 'fixed_amount' NOT NULL,
          reward_value INTEGER DEFAULT 0 NOT NULL,
          reward_free_months INTEGER DEFAULT 0,
          max_redemptions INTEGER DEFAULT 0,
          current_redemptions INTEGER DEFAULT 0 NOT NULL,
          reward_expires_in_days INTEGER,
          applicable_plan_ids UUID[],
          is_active BOOLEAN DEFAULT true NOT NULL,
          expires_at TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT now() NOT NULL,
          updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_ref_org ON referral_codes(org_id);
        CREATE INDEX IF NOT EXISTS idx_ref_referrer ON referral_codes(referrer_org_id)
      `);

      // partner_discounts table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS partner_discounts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id),
          partner_name TEXT NOT NULL,
          partner_code TEXT NOT NULL UNIQUE,
          contact_email TEXT,
          contact_phone TEXT,
          discount_type discount_type DEFAULT 'percentage' NOT NULL,
          discount_percent INTEGER,
          discount_amount_kobo BIGINT,
          free_months INTEGER DEFAULT 0,
          commission_percent INTEGER DEFAULT 0,
          commission_amount_kobo BIGINT,
          applicable_plan_ids UUID[],
          max_redemptions INTEGER DEFAULT 0,
          current_redemptions INTEGER DEFAULT 0 NOT NULL,
          region_restrictions TEXT[],
          is_active BOOLEAN DEFAULT true NOT NULL,
          expires_at TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT now() NOT NULL,
          updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_partner_org ON partner_discounts(org_id)
      `);

      // redemption_history table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS redemption_history (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id UUID REFERENCES organisations(id) NOT NULL,
          subscription_id UUID REFERENCES subscriptions(id),
          invoice_id UUID REFERENCES subscription_invoices(id),
          redemption_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          source_code TEXT,
          discount_type discount_type NOT NULL,
          discount_value INTEGER DEFAULT 0,
          discount_kobo BIGINT DEFAULT 0 NOT NULL,
          free_months INTEGER DEFAULT 0,
          original_amount_kobo BIGINT NOT NULL,
          final_amount_kobo BIGINT NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          redeemed_by UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT now() NOT NULL
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_rh_org ON redemption_history(org_id);
        CREATE INDEX IF NOT EXISTS idx_rh_sub ON redemption_history(subscription_id);
        CREATE INDEX IF NOT EXISTS idx_rh_inv ON redemption_history(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_rh_type ON redemption_history(redemption_type, source_id);
        CREATE INDEX IF NOT EXISTS idx_rh_created ON redemption_history(created_at)
      `);

      // Add campaign index on promotions
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_promo_campaign ON promotions(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_coupon_campaign ON coupons(campaign_id)
      `);

      // Drop FK constraints on created_by (platform users not in users table)
      await pool.query(`ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_created_by_fkey`);
      await pool.query(`ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_created_by_fkey`);
      await pool.query(`ALTER TABLE promotional_campaigns DROP CONSTRAINT IF EXISTS promotional_campaigns_created_by_fkey`);
      await pool.query(`ALTER TABLE referral_codes DROP CONSTRAINT IF EXISTS referral_codes_created_by_fkey`);
      await pool.query(`ALTER TABLE partner_discounts DROP CONSTRAINT IF EXISTS partner_discounts_created_by_fkey`);

      console.log('[Migration] Promotions Engine tables created.');
    } catch (err) {
      console.error('[Migration] Promotions Engine error:', err);
    }

    // Subscription Billing Engine tables & columns
    try {
      await db.execute(sql`ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'subscription'`);
      // Invoice number columns on organisations
      const orgCols: [string, string][] = [
        ['next_invoice_number', 'INTEGER DEFAULT 1 NOT NULL'],
        ['next_credit_note_number', 'INTEGER DEFAULT 1 NOT NULL'],
        ['invoice_prefix', 'TEXT DEFAULT \'INV\''],
        ['credit_note_prefix', 'TEXT DEFAULT \'CN\''],
        ['default_tax_rate_id', 'UUID'],
      ];
      for (const [col, dtype] of orgCols) {
        await pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = '${col}') THEN
              ALTER TABLE organisations ADD COLUMN ${col} ${dtype};
            END IF;
          END $$;
        `);
      }

      // subscription_invoice_items table
      await pool.query(`CREATE TABLE IF NOT EXISTS subscription_invoice_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        invoice_id UUID REFERENCES subscription_invoices(id) NOT NULL,
        description TEXT NOT NULL,
        type TEXT DEFAULT 'subscription' NOT NULL,
        quantity INTEGER DEFAULT 1 NOT NULL,
        unit_price_kobo BIGINT DEFAULT 0 NOT NULL,
        amount_kobo BIGINT DEFAULT 0 NOT NULL,
        tax_kobo BIGINT DEFAULT 0 NOT NULL,
        total_kobo BIGINT DEFAULT 0 NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sii_invoice ON subscription_invoice_items(invoice_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sii_org ON subscription_invoice_items(org_id)`);

      // subscription_credit_notes table
      await pool.query(`CREATE TABLE IF NOT EXISTS subscription_credit_notes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        invoice_id UUID REFERENCES subscription_invoices(id),
        subscription_id UUID REFERENCES subscriptions(id),
        credit_note_number TEXT NOT NULL,
        reason TEXT NOT NULL,
        amount_kobo BIGINT DEFAULT 0 NOT NULL,
        tax_kobo BIGINT DEFAULT 0 NOT NULL,
        total_kobo BIGINT DEFAULT 0 NOT NULL,
        status TEXT DEFAULT 'issued' NOT NULL,
        applied_at TIMESTAMP,
        refunded_at TIMESTAMP,
        refund_payment_id UUID REFERENCES subscription_payments(id),
        created_by UUID,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_scn_org ON subscription_credit_notes(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_scn_invoice ON subscription_credit_notes(invoice_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_scn_sub ON subscription_credit_notes(subscription_id)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_scn_number ON subscription_credit_notes(credit_note_number)`);

      // subscription_tax_rates table
      await pool.query(`CREATE TABLE IF NOT EXISTS subscription_tax_rates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        name TEXT NOT NULL,
        rate INTEGER NOT NULL,
        type TEXT DEFAULT 'vat' NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_default BOOLEAN DEFAULT false NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_str_org ON subscription_tax_rates(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_str_active ON subscription_tax_rates(org_id, is_active, is_default)`);

      console.log('[Migration] Subscription Billing Engine tables created.');
    } catch (err) {
      console.error('[Migration] Subscription Billing Engine error:', err);
    }

    // Add-on Marketplace tables & seed
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS addon_products (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        category TEXT NOT NULL,
        monthly_price_kobo BIGINT DEFAULT 0 NOT NULL,
        annual_price_kobo BIGINT DEFAULT 0 NOT NULL,
        usage_limit INTEGER DEFAULT 0,
        limit_key TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_public BOOLEAN DEFAULT true NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ap_code ON addon_products(code)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ap_category ON addon_products(category)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ap_active ON addon_products(is_active, is_public)`);

      // Enhanced columns on subscription_addons
      const addonCols: [string, string][] = [
        ['product_id', 'UUID REFERENCES addon_products(id)'],
        ['price_when_purchased_kobo', 'BIGINT'],
        ['auto_renew', 'BOOLEAN DEFAULT true NOT NULL'],
        ['activated_at', 'TIMESTAMP'],
        ['expires_at', 'TIMESTAMP'],
        ['next_billing_date', 'TIMESTAMP'],
        ['limits_json', 'JSONB DEFAULT \'{}\'::jsonb'],
      ];
      for (const [col, dtype] of addonCols) {
        await pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_addons' AND column_name = '${col}') THEN
              ALTER TABLE subscription_addons ADD COLUMN ${col} ${dtype};
            END IF;
          END $$;
        `);
      }
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sa_product ON subscription_addons(product_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sa_expiry ON subscription_addons(expires_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sa_next_billing ON subscription_addons(next_billing_date)`);

      // Seed marketplace products
      const existing = await pool.query(`SELECT count(*)::int as cnt FROM addon_products`);
      if (existing.rows[0].cnt === 0) {
        const products = [
          { code: 'extra_users', name: 'Extra Users', description: 'Add more user seats to your account', category: 'users', monthly: 500000, annual: 5000000, limit: 5, limitKey: 'maxUsers' },
          { code: 'extra_storage', name: 'Extra Storage', description: 'Additional cloud storage space (10 GB)', category: 'storage', monthly: 200000, annual: 2000000, limit: 10, limitKey: 'storageLimitGb' },
          { code: 'extra_companies', name: 'Extra Companies', description: 'Add another company under your group', category: 'companies', monthly: 1000000, annual: 10000000, limit: 1, limitKey: 'maxCompanies' },
          { code: 'extra_warehouses', name: 'Extra Warehouses', description: 'Add warehouse locations for inventory', category: 'warehouses', monthly: 300000, annual: 3000000, limit: 1, limitKey: 'maxWarehouses' },
          { code: 'extra_ai_credits', name: 'Extra AI Credits', description: 'Additional AI assistant requests (1,000 credits)', category: 'credits', monthly: 100000, annual: 1000000, limit: 1000, limitKey: 'maxAiRequests' },
          { code: 'extra_ocr_credits', name: 'Extra OCR Credits', description: 'Additional OCR document scans (500 pages)', category: 'credits', monthly: 150000, annual: 1500000, limit: 500, limitKey: 'maxOcrDocuments' },
          { code: 'payroll_module', name: 'Payroll Module', description: 'Full payroll processing with PAYE, NHF, NSITF, ITF', category: 'modules', monthly: 3000000, annual: 30000000, limit: 0, limitKey: null },
          { code: 'hr_module', name: 'HR Module', description: 'Employee management, leave tracking, performance reviews', category: 'modules', monthly: 2500000, annual: 25000000, limit: 0, limitKey: null },
          { code: 'crm_module', name: 'CRM Module', description: 'Customer relationship management, pipeline tracking', category: 'modules', monthly: 2000000, annual: 20000000, limit: 0, limitKey: null },
          { code: 'pos_module', name: 'POS Module', description: 'Point of sale integration with inventory sync', category: 'modules', monthly: 1500000, annual: 15000000, limit: 0, limitKey: null },
          { code: 'manufacturing_module', name: 'Manufacturing Module', description: 'Bill of materials, production orders, work in progress', category: 'modules', monthly: 4000000, annual: 40000000, limit: 0, limitKey: null },
          { code: 'bi_module', name: 'Business Intelligence', description: 'Advanced dashboards, custom reports, data visualisation', category: 'modules', monthly: 3500000, annual: 35000000, limit: 0, limitKey: null },
          { code: 'analytics_module', name: 'Advanced Analytics', description: 'Predictive analytics, trend forecasting, cohort analysis', category: 'modules', monthly: 2500000, annual: 25000000, limit: 0, limitKey: null },
          { code: 'api_package', name: 'API Package', description: 'Extended API rate limits and webhook integrations', category: 'packages', monthly: 800000, annual: 8000000, limit: 50000, limitKey: 'apiRequests' },
          { code: 'sms_package', name: 'SMS Package', description: 'Bulk SMS notifications and alerts (1,000 SMS credits)', category: 'packages', monthly: 500000, annual: 5000000, limit: 1000, limitKey: null },
          { code: 'email_package', name: 'Email Package', description: 'Transactional email volume boost (10,000 emails/mo)', category: 'packages', monthly: 400000, annual: 4000000, limit: 10000, limitKey: null },
        ];
        for (const p of products) {
          await pool.query(`INSERT INTO addon_products (code, name, description, category, monthly_price_kobo, annual_price_kobo, usage_limit, limit_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (code) DO NOTHING`, [p.code, p.name, p.description, p.category, p.monthly, p.annual, p.limit, p.limitKey]);
        }
      }
      console.log('[Migration] Add-on Marketplace tables created & seeded.');
    } catch (err) {
      console.error('[Migration] Add-on Marketplace error:', err);
    }

    try {
      console.log('[Migration] Creating enterprise subscription tables...');
      await pool.query(`DO $$ BEGIN
        CREATE TYPE region AS ENUM ('ng','gh','ke','za','rw','tz','ug','zm','other');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

      await pool.query(`CREATE TABLE IF NOT EXISTS regional_pricing (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
        region region NOT NULL,
        currency TEXT DEFAULT 'NGN' NOT NULL,
        monthly_price_kobo BIGINT DEFAULT 0 NOT NULL,
        annual_price_kobo BIGINT DEFAULT 0 NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_plan_region ON regional_pricing(plan_id, region)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rp_active ON regional_pricing(is_active)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS enterprise_contracts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        plan_id UUID REFERENCES subscription_plans(id),
        contract_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        contact_name TEXT,
        contact_email TEXT,
        negotiated_price_kobo BIGINT,
        currency TEXT DEFAULT 'NGN' NOT NULL,
        billing_cycle TEXT DEFAULT 'monthly' NOT NULL,
        custom_features JSONB DEFAULT '{}',
        usage_limits JSONB DEFAULT '{}',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        auto_renew BOOLEAN DEFAULT true NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        signed_by_org TIMESTAMP,
        signed_by_provider TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ec_org ON enterprise_contracts(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ec_status ON enterprise_contracts(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ec_end ON enterprise_contracts(end_date)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS reseller_contracts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        reseller_org_id UUID REFERENCES organisations(id) NOT NULL,
        plan_id UUID REFERENCES subscription_plans(id),
        reseller_name TEXT NOT NULL,
        reseller_code TEXT NOT NULL UNIQUE,
        contact_name TEXT,
        contact_email TEXT,
        markup_percent INTEGER DEFAULT 0,
        markup_amount_kobo BIGINT DEFAULT 0,
        commission_percent INTEGER DEFAULT 0,
        discount_percent INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'NGN' NOT NULL,
        region_restrictions TEXT[],
        max_customers INTEGER DEFAULT 0,
        commission_kobo BIGINT DEFAULT 0,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        status TEXT DEFAULT 'active' NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rc_org ON reseller_contracts(reseller_org_id)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rc_code ON reseller_contracts(reseller_code)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rc_status ON reseller_contracts(status)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS subscription_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) UNIQUE,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sc_org_key ON subscription_config(org_id, key)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS white_label_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL UNIQUE,
        brand_name TEXT,
        logo_url TEXT,
        favicon_url TEXT,
        primary_color TEXT DEFAULT '#3b82f6',
        secondary_color TEXT DEFAULT '#1e40af',
        accent_color TEXT DEFAULT '#10b981',
        custom_domain TEXT,
        support_email TEXT,
        support_phone TEXT,
        footer_text TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_org ON white_label_config(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_wl_domain ON white_label_config(custom_domain)`);
      console.log('[Migration] Enterprise subscription tables created.');
    } catch (err) {
      console.error('[Migration] Enterprise subscription tables error:', err);
    }

    try {
      console.log('[Migration] Creating subscription notification tables...');
      await pool.query(`DO $$ BEGIN
        CREATE TYPE sub_notification_event AS ENUM (
          'trial_started','trial_ending','subscription_activated','payment_successful','payment_failed',
          'renewal_reminder','subscription_expired','plan_upgraded','plan_downgraded',
          'coupon_applied','storage_limit_reached','user_limit_reached','feature_limit_reached'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      await pool.query(`DO $$ BEGIN
        CREATE TYPE sub_notification_channel AS ENUM ('email','in_app','sms','whatsapp');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
      await pool.query(`DO $$ BEGIN
        CREATE TYPE sub_notification_status AS ENUM ('pending','sent','failed','scheduled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

      await pool.query(`CREATE TABLE IF NOT EXISTS sub_notification_templates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id),
        event_type sub_notification_event NOT NULL,
        channel sub_notification_channel NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_snt_org_event ON sub_notification_templates(org_id, event_type)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_snt_channel ON sub_notification_templates(channel)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS sub_notification_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        event_type sub_notification_event NOT NULL,
        channel sub_notification_channel NOT NULL,
        recipient TEXT,
        subject TEXT,
        body TEXT,
        status sub_notification_status DEFAULT 'pending' NOT NULL,
        error TEXT,
        metadata JSONB DEFAULT '{}',
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_snl_org ON sub_notification_log(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_snl_event ON sub_notification_log(event_type)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_snl_status ON sub_notification_log(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_snl_created ON sub_notification_log(created_at)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS sub_notification_preferences (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL UNIQUE,
        enabled_events sub_notification_event[] DEFAULT '{}' NOT NULL,
        channels sub_notification_channel[] DEFAULT '{email,in_app}' NOT NULL,
        email_recipients TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS sub_notification_schedule (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        subscription_id UUID REFERENCES subscriptions(id),
        event_type sub_notification_event NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        processed_at TIMESTAMP,
        status sub_notification_status DEFAULT 'pending' NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sns_org ON sub_notification_schedule(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sns_scheduled ON sub_notification_schedule(scheduled_at, status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sns_event ON sub_notification_schedule(event_type)`);
      console.log('[Migration] Subscription notification tables created.');
    } catch (err) {
      console.error('[Migration] Subscription notification tables error:', err);
    }

    try {
      console.log('[Migration] Creating platform infrastructure tables...');

      await pool.query(`CREATE TABLE IF NOT EXISTS api_keys (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        prefix TEXT NOT NULL,
        scopes TEXT[] DEFAULT '{}',
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ak_org ON api_keys(org_id)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ak_prefix ON api_keys(prefix)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS dunning_runs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        subscription_id UUID REFERENCES subscriptions(id) NOT NULL,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        stage TEXT DEFAULT 'warning' NOT NULL,
        executed_at TIMESTAMP DEFAULT now() NOT NULL,
        notified_at TIMESTAMP,
        response TEXT,
        metadata JSONB DEFAULT '{}'
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dr_sub ON dunning_runs(subscription_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_dr_stage ON dunning_runs(stage)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS budget_forecasts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        account_id UUID REFERENCES accounts(id) NOT NULL,
        fiscal_year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        forecast_amount_kobo BIGINT DEFAULT 0 NOT NULL,
        actual_amount_kobo BIGINT DEFAULT 0 NOT NULL,
        method TEXT DEFAULT 'linear' NOT NULL,
        confidence INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_bf_org_account ON budget_forecasts(org_id, account_id, fiscal_year)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS inventory_batches (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        item_id UUID REFERENCES items(id) NOT NULL,
        warehouse_id UUID REFERENCES warehouse_locations(id),
        batch_number TEXT NOT NULL,
        supplier_batch_number TEXT,
        expiry_date TIMESTAMP,
        manufacturing_date TIMESTAMP,
        quantity_received INTEGER DEFAULT 0 NOT NULL,
        quantity_remaining INTEGER DEFAULT 0 NOT NULL,
        unit_cost_kobo BIGINT DEFAULT 0,
        status TEXT DEFAULT 'active' NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ib_org ON inventory_batches(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ib_item ON inventory_batches(item_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ib_batch ON inventory_batches(batch_number)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS inventory_serials (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        item_id UUID REFERENCES items(id) NOT NULL,
        warehouse_id UUID REFERENCES warehouse_locations(id),
        serial_number TEXT NOT NULL,
        batch_id UUID REFERENCES inventory_batches(id),
        status TEXT DEFAULT 'in_stock' NOT NULL,
        cost_price_kobo BIGINT DEFAULT 0,
        selling_price_kobo BIGINT DEFAULT 0,
        sold_at TIMESTAMP,
        sold_to TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_is_org ON inventory_serials(org_id)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_is_serial ON inventory_serials(serial_number)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_is_item ON inventory_serials(item_id)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        user_id UUID REFERENCES users(id) NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT DEFAULT 'general' NOT NULL,
        priority TEXT DEFAULT 'normal' NOT NULL,
        status TEXT DEFAULT 'open' NOT NULL,
        assigned_to UUID REFERENCES users(id),
        resolution TEXT,
        closed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_st_org ON support_tickets(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_st_status ON support_tickets(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_st_assigned ON support_tickets(assigned_to)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS ticket_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ticket_id UUID REFERENCES support_tickets(id) NOT NULL,
        user_id UUID REFERENCES users(id) NOT NULL,
        message TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT false NOT NULL,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tm_ticket ON ticket_messages(ticket_id)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id),
        user_id UUID REFERENCES users(id) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' NOT NULL,
        is_global BOOLEAN DEFAULT false NOT NULL,
        starts_at TIMESTAMP DEFAULT now() NOT NULL,
        ends_at TIMESTAMP,
        is_dismissable BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ann_org ON announcements(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ann_active ON announcements(starts_at, ends_at)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS rate_limit_configs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id),
        endpoint TEXT NOT NULL,
        method TEXT DEFAULT 'ALL' NOT NULL,
        max_requests INTEGER DEFAULT 100 NOT NULL,
        window_ms INTEGER DEFAULT 60000 NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_rlc_endpoint ON rate_limit_configs(endpoint)`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rlc_org_endpoint ON rate_limit_configs(org_id, endpoint)`);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_fre_rollout ON feature_rollout_events(rollout_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_fre_org ON feature_rollout_events(org_id)`);

      console.log('[Migration] Platform infrastructure tables created.');
    } catch (err) {
      console.error('[Migration] Platform infrastructure tables error:', err);
    }

    // --- Tenant Role Permissions Migration ---
    try {
      // Add new user_role enum values (safe idempotent approach)
      const newRoles = ['administrator', 'manager', 'sales', 'inventory', 'cashier', 'auditor', 'hr', 'purchasing'];
      for (const role of newRoles) {
        await pool.query(`
          DO $$ BEGIN
            ALTER TYPE user_role ADD VALUE '${role}';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END $$;
        `);
      }

      // Create role_permissions table
      await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        role user_role NOT NULL,
        permission TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
      try {
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_rp_org_role ON role_permissions(org_id, role)`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_org_perm ON role_permissions(org_id, role, permission)`);
      } catch (e) {
        // indexes might already exist
      }

      console.log('[Migration] Tenant role permissions ready.');
    } catch (err) {
      console.error('[Migration] Tenant role permissions error:', err);
    }

    // CRM tables
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_stages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID NOT NULL REFERENCES organisations(id),
          name TEXT NOT NULL,
          "order" INTEGER NOT NULL,
          color TEXT DEFAULT '#6366f1',
          is_active BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMP DEFAULT now() NOT NULL
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_stages_org ON crm_stages(org_id)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_deals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID NOT NULL REFERENCES organisations(id),
          title TEXT NOT NULL,
          contact_id UUID REFERENCES contacts(id),
          value BIGINT DEFAULT 0 NOT NULL,
          currency TEXT DEFAULT 'NGN' NOT NULL,
          stage_id UUID NOT NULL REFERENCES crm_stages(id),
          assigned_to UUID REFERENCES users(id),
          source TEXT DEFAULT 'other',
          expected_close_date TIMESTAMP,
          probability INTEGER DEFAULT 0,
          notes TEXT,
          status TEXT DEFAULT 'open' NOT NULL,
          lost_reason TEXT,
          won_at TIMESTAMP,
          lost_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT now() NOT NULL,
          updated_at TIMESTAMP DEFAULT now() NOT NULL
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_deals_org ON crm_deals(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_deals_contact ON crm_deals(contact_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_deals_assignee ON crm_deals(assigned_to)`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS crm_activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id UUID NOT NULL REFERENCES organisations(id),
          type TEXT NOT NULL,
          subject TEXT NOT NULL,
          description TEXT,
          deal_id UUID REFERENCES crm_deals(id),
          contact_id UUID REFERENCES contacts(id),
          assigned_to UUID REFERENCES users(id),
          due_date TIMESTAMP,
          completed_at TIMESTAMP,
          status TEXT DEFAULT 'pending' NOT NULL,
          created_at TIMESTAMP DEFAULT now() NOT NULL
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_activities_org ON crm_activities(org_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities(deal_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_crm_activities_assignee ON crm_activities(assigned_to)`);

      // Seed default CRM stages for each org
      const orgResult = await pool.query(`SELECT id FROM organisations`);
      for (const org of orgResult.rows) {
        const existing = await pool.query(`SELECT COUNT(*) as cnt FROM crm_stages WHERE org_id = $1`, [org.id]);
        if (Number(existing.rows[0].cnt) === 0) {
          const defaultStages = [
            { name: 'Lead', order: 1, color: '#94a3b8' },
            { name: 'Qualified', order: 2, color: '#6366f1' },
            { name: 'Proposal', order: 3, color: '#3b82f6' },
            { name: 'Negotiation', order: 4, color: '#f59e0b' },
            { name: 'Closed Won', order: 5, color: '#22c55e' },
            { name: 'Closed Lost', order: 6, color: '#ef4444' },
          ];
          for (const stage of defaultStages) {
            await pool.query(`INSERT INTO crm_stages (org_id, name, "order", color) VALUES ($1, $2, $3, $4)`, [org.id, stage.name, stage.order, stage.color]);
          }
        }
      }
      console.log('[Migration] CRM tables ready.');
    } catch (err) {
      console.error('[Migration] CRM tables error:', err);
    }

    // Create missing HR tables (enums, departments, designations, employees, etc.)
    try {
      await syncHrSchema(db);
    } catch (err) {
      console.error('[Migration] HR schema sync error:', err);
    }

    // HRM tables + seed default data
    try {
      const allOrgs = await pool.query(`SELECT id FROM organisations`);
      for (const org of allOrgs.rows) {
        // Seed default leave types
        const existingLeaveTypes = await pool.query(`SELECT COUNT(*) as cnt FROM hr_leave_types WHERE org_id = $1`, [org.id]);
        if (Number(existingLeaveTypes.rows[0].cnt) === 0) {
          const defaultLeaveTypes = [
            { name: 'Annual Leave', days: 20, color: '#3b82f6', requiresAttachment: false },
            { name: 'Sick Leave', days: 10, color: '#ef4444', requiresAttachment: true },
            { name: 'Personal Leave', days: 5, color: '#f59e0b', requiresAttachment: false },
            { name: 'Maternity Leave', days: 90, color: '#ec4899', requiresAttachment: true },
            { name: 'Paternity Leave', days: 14, color: '#8b5cf6', requiresAttachment: true },
            { name: 'Study Leave', days: 30, color: '#06b6d4', requiresAttachment: true },
          ];
          for (const lt of defaultLeaveTypes) {
            await pool.query(
              `INSERT INTO hr_leave_types (org_id, name, default_days_per_year, color, requires_attachment, carry_forward, carry_forward_limit) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [org.id, lt.name, lt.days, lt.color, lt.requiresAttachment, false, 0]
            );
          }
        }
        // Seed default HR settings
        const existingSettings = await pool.query(`SELECT COUNT(*) as cnt FROM hr_settings WHERE org_id = $1`, [org.id]);
        if (Number(existingSettings.rows[0].cnt) === 0) {
          await pool.query(
            `INSERT INTO hr_settings (org_id, work_week_start, work_week_end, daily_work_hours, probation_period_days, notice_period_days, overtime_rate, auto_approve_leave, enable_clock_in, enable_timesheets) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [org.id, 1, 5, 8, 90, 30, 1.5, false, true, true]
          );
        }
      }
      console.log('[Migration] HRM tables ready.');
    } catch (err) {
      console.error('[Migration] HRM tables error:', err);
    }

    // Ensure every org has a subscription record (Free plan fallback)
    try {
      const orphanOrgs = await pool.query(`
        SELECT o.id, o.name, o.created_at FROM organisations o
        LEFT JOIN subscriptions s ON s.org_id = o.id
        WHERE s.id IS NULL
      `);
      if (orphanOrgs.rows.length > 0) {
        const freePlan = await pool.query(`SELECT id FROM subscription_plans WHERE monthly_price_kobo = 0 AND is_active = true LIMIT 1`);
        if (freePlan.rows.length > 0) {
          const freePlanId = freePlan.rows[0].id;
          for (const org of orphanOrgs.rows) {
            await pool.query(`
              INSERT INTO subscriptions (org_id, plan_id, status, current_period_start, current_period_end, billing_cycle_anchor, billing_cycle, auto_renew)
              VALUES ($1, $2, 'active', $3, $3 + interval '1 month', $3, 'monthly', true)
              ON CONFLICT DO NOTHING
            `, [org.id, freePlanId, org.created_at || new Date()]);
          }
          console.log(`[Migration] Backfilled subscriptions for ${orphanOrgs.rows.length} org(s) missing subscription records.`);
        }
      }
    } catch (e) {
      console.error('[Migration] Error backfilling subscriptions:', e);
    }

    // ===== TRAVEL MANAGEMENT ENUMS + TABLES =====
    try {
      await db.execute(sql`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_advance_status') THEN
          CREATE TYPE hr_advance_status AS ENUM ('pending','approved','disbursed','settled','cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_settlement_status') THEN
          CREATE TYPE hr_settlement_status AS ENUM ('pending','partial','settled','disputed');
        END IF;
      END $$;`);

      await db.execute(sql`CREATE TABLE IF NOT EXISTS hr_travel_advances (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        employee_id UUID REFERENCES hr_employees(id) NOT NULL,
        travel_request_id UUID REFERENCES hr_travel_requests(id),
        amount BIGINT NOT NULL,
        currency TEXT DEFAULT 'NGN',
        request_date DATE NOT NULL,
        purpose TEXT,
        status hr_advance_status DEFAULT 'pending' NOT NULL,
        approved_by UUID,
        approved_at TIMESTAMP,
        disbursed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`);

      await db.execute(sql`CREATE TABLE IF NOT EXISTS hr_travel_settlements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id) NOT NULL,
        travel_request_id UUID REFERENCES hr_travel_requests(id) NOT NULL,
        employee_id UUID REFERENCES hr_employees(id) NOT NULL,
        total_expenses BIGINT DEFAULT 0,
        advance_amount BIGINT DEFAULT 0,
        balance_due BIGINT DEFAULT 0,
        currency TEXT DEFAULT 'NGN',
        status hr_settlement_status DEFAULT 'pending' NOT NULL,
        settled_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`);

      await db.execute(sql`ALTER TABLE hr_expense_reports ADD COLUMN IF NOT EXISTS travel_request_id UUID REFERENCES hr_travel_requests(id)`);

      // Indexes
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hr_adv_emp ON hr_travel_advances(employee_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hr_adv_trv ON hr_travel_advances(travel_request_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hr_set_trv ON hr_travel_settlements(travel_request_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hr_set_emp ON hr_travel_settlements(employee_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_hr_exp_trv ON hr_expense_reports(travel_request_id)`);

      console.log('[Migration] Travel Management tables ready.');
    } catch (err) {
      console.error('[Migration] Travel Management tables error:', err);
    }

    console.log('[Migration] Database is online. Migration/schema push complete!');
  } catch (err) {
    console.error('[Migration] Failed to connect or run schema setup:', err);
  }

  // ── Ensure platform support tables exist ──
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id UUID,
      user_id UUID,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT DEFAULT 'general' NOT NULL,
      priority TEXT DEFAULT 'normal' NOT NULL,
      status TEXT DEFAULT 'open' NOT NULL,
      assigned_to UUID,
      resolution TEXT,
      closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_st_org ON support_tickets(org_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_st_status ON support_tickets(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_st_assigned ON support_tickets(assigned_to)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS ticket_messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      ticket_id UUID NOT NULL,
      user_id UUID NOT NULL,
      message TEXT NOT NULL,
      is_internal BOOLEAN DEFAULT false NOT NULL,
      attachments JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tm_ticket ON ticket_messages(ticket_id)`);

      await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        org_id UUID REFERENCES organisations(id),
        user_id UUID NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' NOT NULL,
        is_global BOOLEAN DEFAULT false NOT NULL,
        starts_at TIMESTAMP DEFAULT now() NOT NULL,
        ends_at TIMESTAMP,
        is_dismissable BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ann_org ON announcements(org_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ann_active ON announcements(starts_at, ends_at)`);
    console.log('[Migration] Platform support tables verified.');
  } catch (e) {
    console.warn('[Migration] Could not create platform support tables:', (e as Error).message);
  }

  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS platform_role_permissions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      role TEXT NOT NULL UNIQUE,
      permissions TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prp_role ON platform_role_permissions(role)`);

    const roleRows = await pool.query(`SELECT role FROM platform_role_permissions`);
    if (roleRows.rows.length === 0) {
      const defaults: Record<string, string[]> = {
        super_admin: [
          'users:read','users:create','users:update','users:delete',
          'orgs:read','orgs:manage',
          'subscriptions:read','subscriptions:manage',
          'plans:read','plans:manage',
          'billing:read','billing:manage',
          'analytics:read','growth:read',
          'system:read','system:manage','feature_flags:manage','audit_logs:read',
          'support:read','support:manage',
          'announcements:manage',
          'marketing:manage',
          'regional_pricing:manage','enterprise_contracts:manage','reseller_contracts:manage',
          'org_config:manage','white_label:manage',
          'api_keys:manage','impersonation:use',
        ],
        admin: [
          'users:read','users:create','users:update','users:delete',
          'orgs:read','orgs:manage',
          'subscriptions:read','subscriptions:manage',
          'plans:read','plans:manage',
          'billing:read','billing:manage',
          'analytics:read','growth:read',
          'system:read','system:manage','feature_flags:manage','audit_logs:read',
          'support:read','support:manage',
          'announcements:manage',
          'regional_pricing:manage','enterprise_contracts:manage','reseller_contracts:manage',
          'org_config:manage','white_label:manage','api_keys:manage',
        ],
        billing_manager: [
          'orgs:read','subscriptions:read','subscriptions:manage',
          'plans:read','plans:manage',
          'billing:read','billing:manage',
          'analytics:read','growth:read','audit_logs:read',
        ],
        support_manager: [
          'users:read','orgs:read','subscriptions:read','billing:read',
          'support:read','support:manage','audit_logs:read','impersonation:use',
        ],
        analyst: ['orgs:read','analytics:read','growth:read','announcements:manage','marketing:manage'],
        developer: [
          'users:read','orgs:read','system:read','system:manage',
          'feature_flags:manage','api_keys:manage','audit_logs:read',
        ],
        security_auditor: [
          'orgs:read','subscriptions:read','plans:read','billing:read',
          'enterprise_contracts:manage','reseller_contracts:manage',
        ],
        marketing_manager: ['users:read','orgs:read','subscriptions:read','support:read'],
        onboarding_specialist: [
          'users:read','orgs:read','subscriptions:read','plans:read',
          'billing:read','analytics:read','system:read','audit_logs:read',
        ],
        compliance_officer: ['orgs:read','system:read','system:manage','feature_flags:manage','api_keys:manage','audit_logs:read'],
        viewer: [],
      };
      for (const [role, perms] of Object.entries(defaults)) {
        await pool.query(
          `INSERT INTO platform_role_permissions (role, permissions) VALUES ($1, $2) ON CONFLICT (role) DO NOTHING`,
          [role, perms]
        );
      }
      console.log('[Migration] Platform role permissions seeded.');
    }
  } catch (e) {
    console.warn('[Migration] Could not create role permissions table:', (e as Error).message);
  }

  try {
    await pool.query(`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'`);
    console.log('[Migration] Platform users preferences column verified.');
  } catch (e) {
    console.warn('[Migration] Could not add preferences column:', (e as Error).message);
  }

  try {
    await pool.query(`ALTER TABLE support_tickets ALTER COLUMN org_id DROP NOT NULL`);
    console.log('[Migration] Support tickets org_id made nullable.');
  } catch (e) {
    console.warn('[Migration] Could not alter support_tickets.org_id:', (e as Error).message);
  }

  // Sync announcements table columns with Drizzle schema
  try {
    await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS user_id UUID`);
    await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS message TEXT`);
    await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info' NOT NULL`);
    await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false NOT NULL`);
    await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_dismissable BOOLEAN DEFAULT true NOT NULL`);
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS content`);
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS priority`);
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS target_roles`);
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS is_active`);
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS created_by`);
    await pool.query(`ALTER TABLE announcements DROP COLUMN IF EXISTS updated_at`);
    await pool.query(`ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_user_id_fkey`);
    console.log('[Migration] Announcements table synced with Drizzle schema.');
  } catch (e) {
    console.warn('[Migration] Could not sync announcements columns:', (e as Error).message);
  }

  // Ensure feature_rollouts table exists (standalone, in case main block failed)
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS feature_rollouts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      feature_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      rollout_percent INTEGER DEFAULT 0 NOT NULL,
      is_active BOOLEAN DEFAULT false NOT NULL,
      allowlist_org_ids TEXT[] DEFAULT '{}',
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      created_by UUID,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fr_key ON feature_rollouts(feature_key)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fr_active ON feature_rollouts(is_active)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS feature_rollout_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      rollout_id UUID REFERENCES feature_rollouts(id) NOT NULL,
      org_id UUID REFERENCES organisations(id) NOT NULL,
      user_id UUID,
      event TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fre_rollout ON feature_rollout_events(rollout_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fre_org ON feature_rollout_events(org_id)`);
    console.log('[Migration] Feature rollouts tables verified.');
  } catch (e) {
    console.warn('[Migration] Could not create feature rollouts tables:', (e as Error).message);
  }

  // ===== DOCUMENT MANAGEMENT TABLES =====
  try {
    await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_doc_status') THEN
        CREATE TYPE hr_doc_status AS ENUM ('draft','active','archived','expired');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_doc_access_level') THEN
        CREATE TYPE hr_doc_access_level AS ENUM ('public','restricted','confidential');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_doc_permission') THEN
        CREATE TYPE hr_doc_permission AS ENUM ('view','download','edit','admin');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hr_doc_link_type') THEN
        CREATE TYPE hr_doc_link_type AS ENUM ('onboarding','contract','id','payroll','training','performance','other');
      END IF;
    END $$;`);

    await pool.query(`CREATE TABLE IF NOT EXISTS hr_doc_categories (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id UUID REFERENCES organisations(id) NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      parent_id UUID,
      icon TEXT,
      color TEXT DEFAULT '#3b82f6',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_cat_org ON hr_doc_categories(org_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS hr_doc_files (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id UUID REFERENCES organisations(id) NOT NULL,
      category_id UUID REFERENCES hr_doc_categories(id),
      name TEXT NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER DEFAULT 0,
      file_hash TEXT,
      version INTEGER DEFAULT 1 NOT NULL,
      status hr_doc_status DEFAULT 'active' NOT NULL,
      expiry_date DATE,
      access_level hr_doc_access_level DEFAULT 'restricted' NOT NULL,
      tags TEXT[],
      uploaded_by UUID REFERENCES users(id) NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL,
      updated_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_file_org ON hr_doc_files(org_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_file_cat ON hr_doc_files(category_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_file_status ON hr_doc_files(status)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS hr_doc_versions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      file_id UUID REFERENCES hr_doc_files(id) NOT NULL,
      org_id UUID REFERENCES organisations(id) NOT NULL,
      version_number INTEGER NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER DEFAULT 0,
      file_hash TEXT,
      change_notes TEXT,
      uploaded_by UUID REFERENCES users(id) NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_ver_file ON hr_doc_versions(file_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS hr_doc_permissions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      file_id UUID REFERENCES hr_doc_files(id) NOT NULL,
      org_id UUID REFERENCES organisations(id) NOT NULL,
      employee_id UUID REFERENCES hr_employees(id),
      permission hr_doc_permission DEFAULT 'view' NOT NULL,
      granted_by UUID REFERENCES users(id) NOT NULL,
      expires_at DATE,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_perm_file ON hr_doc_permissions(file_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS hr_doc_employee_links (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      file_id UUID REFERENCES hr_doc_files(id) NOT NULL,
      org_id UUID REFERENCES organisations(id) NOT NULL,
      employee_id UUID REFERENCES hr_employees(id) NOT NULL,
      link_type hr_doc_link_type DEFAULT 'other' NOT NULL,
      created_at TIMESTAMP DEFAULT now() NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_link_file ON hr_doc_employee_links(file_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_hr_doc_link_emp ON hr_doc_employee_links(employee_id)`);

    console.log('[Migration] Document Management tables ready.');
  } catch (err) {
    console.error('[Migration] Document Management tables error:', err);
  }

  await pool.end();
}

// Run if called directly
if (process.argv[1]?.includes('migrate')) {
  runMigration().catch(console.error);
}

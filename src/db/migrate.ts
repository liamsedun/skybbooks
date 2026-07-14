/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';

export async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.log('[Migration] No DATABASE_URL found, skipping startup migration.');
    return;
  }
  
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL, 
    max: 1 
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

    console.log('[Migration] Database is online. Migration/schema push complete!');
  } catch (err) {
    console.error('[Migration] Failed to connect or run schema setup:', err);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (process.argv[1]?.includes('migrate')) {
  runMigration().catch(console.error);
}

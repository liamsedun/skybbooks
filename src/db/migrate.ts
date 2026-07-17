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

    // Asset Classes table
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

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
    await db.execute(sql`UPDATE accounts SET system_account_role = 'paye_payable' WHERE code = '301500' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'pension_payable' WHERE code = '301600' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'retained_earnings' WHERE code = '502000' AND system_account_role = 'none'`);
    await db.execute(sql`UPDATE accounts SET system_account_role = 'cogs' WHERE code = '700000' AND system_account_role = 'none'`);

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
    console.log('[Migration] Database is online. Migration/schema push complete!');
  } catch (err) {
    console.error('[Migration] Failed to connect or run schema push:', err);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (process.argv[1]?.includes('migrate')) {
  runMigration().catch(console.error);
}

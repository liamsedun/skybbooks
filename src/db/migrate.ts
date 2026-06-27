/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { drizzle } from 'drizzle-orm/node-postgres';
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

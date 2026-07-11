import { db, accounts } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const rows = await db.select().from(accounts).where(eq(accounts.code, '700900'));
  if (rows.length === 0) {
    console.log('No account found with code 700900');
    return;
  }
  for (const acct of rows) {
    if (acct.isSystem) {
      console.log(`Account ${acct.code} - ${acct.name} (org: ${acct.orgId}) is a SYSTEM account, cannot delete.`);
      continue;
    }
    console.log(`Deleting account: ${acct.code} - ${acct.name} (org: ${acct.orgId}, isSystem: ${acct.isSystem})`);
    await db.delete(accounts).where(and(eq(accounts.id, acct.id), eq(accounts.orgId, acct.orgId)));
    console.log('Deleted successfully.');
  }
}

main().catch(console.error);

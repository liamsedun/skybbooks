import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { platformUsers } from './db/platform/tables';

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { platformUsers } });

  const email = (process.argv[2] || 'admin@skyhouse.com').toLowerCase();
  const password = process.argv[3] || 'admin123';
  const name = process.argv[4] || 'Platform Admin';
  const role = process.argv[5] || 'super_admin';

  const rows = await db.select().from(platformUsers).where(eq(platformUsers.email, email));

  if (rows.length > 0) {
    console.log(`Platform admin "${email}" already exists (id: ${rows[0].id}).`);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(platformUsers).values({
    email,
    passwordHash: hash,
    fullName: name,
    role: role as any,
    isActive: true,
  }).returning();

  console.log(`Created platform admin:`);
  console.log(`  Email:    ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name:     ${user.fullName}`);
  console.log(`  Role:     ${user.role}`);
  console.log(`  ID:       ${user.id}`);

  await pool.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

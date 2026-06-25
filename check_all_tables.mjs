import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_DkMPY1UZ9oAT@ep-restless-hill-atbr9568-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
try {
  await client.connect();
  // List ALL tables in public schema
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables with data:');
  let anyData = false;
  for (const t of tables.rows) {
    const cnt = await client.query(`SELECT count(*) FROM "${t.table_name}"`);
    const n = parseInt(cnt.rows[0].count);
    if (n > 0) {
      console.log(`  ${t.table_name}: ${n} rows`);
      anyData = true;
    }
  }
  if (!anyData) console.log('  (none - all tables empty)');

  // List ALL tables (even empty ones)
  console.log('\nAll tables:');
  for (const t of tables.rows) {
    const cnt = await client.query(`SELECT count(*) FROM "${t.table_name}"`);
    console.log(`  ${t.table_name}: ${cnt.rows[0].count} rows`);
  }
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await client.end();
}

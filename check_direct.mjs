import pg from 'pg';
const { Client } = pg;
// Try direct connection (without -pooler)
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_DkMPY1UZ9oAT@ep-restless-hill-atbr9568.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
try {
  await client.connect();
  const db = await client.query('SELECT current_database(), version()');
  console.log('Connected to:', db.rows[0]);

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  for (const t of tables.rows) {
    const cnt = await client.query(`SELECT count(*) FROM "${t.table_name}"`);
    const n = parseInt(cnt.rows[0].count);
    if (n > 0) {
      console.log(`${t.table_name}: ${n} rows`);
      if (t.table_name === 'invoices') {
        const rows = await client.query('SELECT invoice_number, total, status FROM invoices');
        console.log(JSON.stringify(rows.rows));
      }
    }
  }
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await client.end();
}

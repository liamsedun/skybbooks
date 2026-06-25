import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_DkMPY1UZ9oAT@ep-restless-hill-atbr9568-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});
try {
  await client.connect();
  const cnt = await client.query('SELECT count(*) FROM invoices');
  console.log('row count:', cnt.rows[0].count);

  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' ORDER BY ordinal_position");
  console.log('columns:', cols.rows.map(r => r.column_name).join(', '));

  const all = await client.query('SELECT invoice_number, total, status FROM invoices LIMIT 20');
  console.log('all rows:', JSON.stringify(all.rows, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await client.end();
}

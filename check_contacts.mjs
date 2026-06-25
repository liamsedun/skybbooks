import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_DkMPY1UZ9oAT@ep-restless-hill-atbr9568-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});
try {
  await client.connect();
  // Check all tables with data
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  for (const t of tables.rows) {
    const cnt = await client.query(`SELECT count(*) FROM "${t.table_name}"`);
    const n = parseInt(cnt.rows[0].count);
    if (n > 0) {
      console.log(`${t.table_name}: ${n} rows`);
    }
  }
  // Specifically check contacts
  const hasContacts = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contacts')");
  if (hasContacts.rows[0].exists) {
    const cc = await client.query('SELECT count(*) FROM contacts');
    console.log('contacts rows:', cc.rows[0].count);
  }
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await client.end();
}

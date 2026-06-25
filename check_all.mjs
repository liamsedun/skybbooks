import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_DkMPY1UZ9oAT@ep-restless-hill-atbr9568-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});
try {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  for (const t of tables.rows) {
    const cnt = await client.query(`SELECT count(*) FROM "${t.table_name}"`);
    if (parseInt(cnt.rows[0].count) > 0) {
      console.log(`${t.table_name}: ${cnt.rows[0].count} rows`);
    }
  }
  // Also check database name
  const db = await client.query('SELECT current_database()');
  console.log('database:', db.rows[0].current_database);
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await client.end();
}

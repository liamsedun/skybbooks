import pg from 'pg';
const { Client } = pg;
// Try the 'postgres' database
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_DkMPY1UZ9oAT@ep-restless-hill-atbr9568-pooler.c-9.us-east-1.aws.neon.tech/postgres?sslmode=require&channel_binding=require'
});
try {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables in postgres DB:', tables.rows.map(r => r.table_name));
  if (tables.rows.length > 0) {
    for (const t of tables.rows) {
      const cnt = await client.query(`SELECT count(*) FROM "${t.table_name}"`);
      console.log(`  ${t.table_name}: ${cnt.rows[0].count} rows`);
    }
  }
} catch (err) {
  console.error('Could not connect to postgres database:', err.message);
} finally {
  await client.end();
}

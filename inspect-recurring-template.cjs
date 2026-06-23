const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const res = await pool.query(`
    SELECT ri.id, ri.frequency, ri.template, c.name as customer_name
    FROM recurring_invoices ri
    LEFT JOIN contacts c ON c.id = ri.customer_id
    ORDER BY ri.created_at DESC
  `);
  console.log('--- recurring_invoices.template (raw JSONB) ---');
  console.log(JSON.stringify(res.rows, null, 2));

  console.log('\n--- most recently generated invoice + its lines ---');
  const invRes = await pool.query(`
    SELECT id, invoice_number, total, recurring_id, date
    FROM invoices
    WHERE recurring_id IS NOT NULL
    ORDER BY date DESC
    LIMIT 1
  `);
  console.log(JSON.stringify(invRes.rows, null, 2));

  if (invRes.rows[0]) {
    const linesRes = await pool.query(`SELECT * FROM invoice_lines WHERE invoice_id = $1`, [invRes.rows[0].id]);
    console.log('\n--- lines for that invoice ---');
    console.log(JSON.stringify(linesRes.rows, null, 2));
  }

  await pool.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });

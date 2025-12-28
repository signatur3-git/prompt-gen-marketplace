// Check packages table schema
const pkg = require('pg');
const { Client } = pkg;

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace';

async function checkSchema() {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Get column info for packages table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'packages'
      ORDER BY ordinal_position;
    `);

    console.log('\nPackages table columns:');
    console.log('------------------------');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check migration status
    const migrations = await client.query(`
      SELECT name, run_on 
      FROM pgmigrations 
      ORDER BY run_on DESC 
      LIMIT 5;
    `);

    console.log('\n\nRecent migrations:');
    console.log('------------------');
    migrations.rows.forEach(row => {
      console.log(`${row.name} (${row.run_on})`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


// Check users and personas tables for public_key column
const pkg = require('pg');
const { Client } = pkg;

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace';

async function checkSchema() {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Check users table
    console.log('USERS TABLE:');
    const usersColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    if (usersColumns.rows.length === 0) {
      console.log('❌ Users table does not exist!\n');
    } else {
      usersColumns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      console.log('');
    }

    // Check personas table
    console.log('PERSONAS TABLE:');
    const personasColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'personas'
      ORDER BY ordinal_position
    `);

    if (personasColumns.rows.length === 0) {
      console.log('❌ Personas table does not exist!\n');
    } else {
      personasColumns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      console.log('');
    }

    // Check user_keypairs table
    console.log('USER_KEYPAIRS TABLE:');
    const keypairsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_keypairs'
      ORDER BY ordinal_position
    `);

    if (keypairsColumns.rows.length === 0) {
      console.log('❌ User_keypairs table does not exist!\n');
    } else {
      keypairsColumns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      console.log('');
    }

    // List all tables
    console.log('ALL TABLES:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
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


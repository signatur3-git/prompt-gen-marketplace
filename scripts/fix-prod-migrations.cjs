#!/usr/bin/env node

/**
 * EMERGENCY FIX FOR PRODUCTION
 *
 * Mark the consolidated migration as already run so production doesn't break.
 * Run this ONCE on production database.
 */

const { Client } = require('pg');

async function fixProduction() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if old migrations exist
    const oldMigrations = await client.query(`
      SELECT COUNT(*) as count FROM pgmigrations 
      WHERE name LIKE '202512230%' OR name LIKE '202512261%' OR name LIKE '202512281%'
    `);

    if (parseInt(oldMigrations.rows[0].count) === 0) {
      console.log('ℹ️  No old migrations found - this is a fresh database');
      console.log('✅ No fix needed');
      process.exit(0);
    }

    console.log(`📋 Found ${oldMigrations.rows[0].count} old migrations`);

    // Check if consolidated migration already marked as run
    const consolidated = await client.query(`
      SELECT name FROM pgmigrations 
      WHERE name = '20251228173910417_consolidated-schema'
    `);

    if (consolidated.rows.length > 0) {
      console.log('✅ Consolidated migration already marked as run');
      console.log('✅ No fix needed');
      process.exit(0);
    }

    // Mark consolidated as run
    console.log('🔧 Marking consolidated migration as already run...');
    await client.query(`
      INSERT INTO pgmigrations (name, run_on) 
      VALUES ('20251228173910417_consolidated-schema', NOW())
    `);

    console.log('✅ Consolidated migration marked as run');
    console.log('✅ Production should now deploy successfully');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixProduction();


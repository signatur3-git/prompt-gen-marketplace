#!/usr/bin/env node
consolidate();

}
  }
    await client.end();
  } finally {
    process.exit(1);
    console.error('\n❌ Error:', err.message);
  } catch (err) {

    console.log('3. Commit and push changes');
    console.log('2. Then run: node scripts/archive-old-migrations.cjs');
    console.log('1. Run this script on all your databases (dev, staging, prod)');
    console.log('\nNext steps:');
    console.log('\n✅ Database consolidation complete!');

    }
      console.log('ℹ️  Consolidated migration already marked as complete');
    } else {
      console.log('✅ Consolidated migration marked as complete');
      `, [CONSOLIDATED_MIGRATION]);
        VALUES ($1, NOW())
        INSERT INTO pgmigrations (name, run_on) 
      await client.query(`
    if (consolidated.rows.length === 0) {

    `, [CONSOLIDATED_MIGRATION]);
      WHERE name = $1
      SELECT name FROM pgmigrations 
    const consolidated = await client.query(`

    console.log('\n✨ Marking consolidated migration as complete...');
    // Mark consolidated migration as already run

    console.log('✅ Old migrations archived in database');

    `, [OLD_MIGRATIONS]);
      AND name NOT LIKE 'ARCHIVED_%'
      WHERE name = ANY($1)
      SET name = 'ARCHIVED_' || name 
      UPDATE pgmigrations 
    await client.query(`

    console.log('\n🗄️  Archiving old migrations in database...');
    // Archive old migrations in database

    console.log(`✅ All ${OLD_MIGRATIONS.length} old migrations confirmed`);

    }
      process.exit(1);
      console.error('\n   Run migrations first: npm run migrate:up');
      console.error(`   Found: ${result.rows.length}`);
      console.error(`   Expected: ${OLD_MIGRATIONS.length}`);
      console.error(`\n❌ Not all old migrations have run!`);
    if (result.rows.length !== OLD_MIGRATIONS.length) {

    `, [OLD_MIGRATIONS]);
      ORDER BY run_on
      WHERE name = ANY($1)
      SELECT name FROM pgmigrations 
    const result = await client.query(`

    console.log('\n📋 Checking migration status...');
    // Check if all old migrations have run

    console.log('✅ Connected to database');
    await client.connect();
  try {

  const client = new Client({ connectionString: databaseUrl });

  }
    process.exit(1);
    console.error('   Set it to your database connection string');
    console.error('❌ DATABASE_URL environment variable not set');
  if (!databaseUrl) {

  const databaseUrl = process.env.DATABASE_URL;
async function consolidate() {

const CONSOLIDATED_MIGRATION = '20251228173910417_consolidated-schema';

];
  '20251228172257152_fix-display-names-from-yaml',
  '20251228155656484_add-display-name-to-packages',
  '20251226120000000_add_content_counts',
  '20251223084000000_add_oauth_clients_table',
  '20251223012100000_add_admin_role',
  '20251223011700000_increase_namespace_length_limit',
  '20251223011500000_initial_schema',
const OLD_MIGRATIONS = [

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

 */
 * 4. Move old migration files to archive folder
 * 3. Mark consolidated migration as already run
 * 2. Mark old migrations as archived in pgmigrations table
 * 1. Verify all databases have run all migrations
 * Steps:
 *
 * This script helps consolidate old migrations after all databases are up-to-date.
 *
 * Migration Consolidation Script
/**



#!/usr/bin/env node

/**
 * Archive Old Migration Files
 *
 * This script moves old migration files to an archive folder after consolidation.
 * Run this AFTER running consolidate-migrations-db.cjs on all databases.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(process.cwd(), 'database', 'pgmigrations');
const ARCHIVE_DIR = path.join(process.cwd(), 'database', 'pgmigrations-archive');

const OLD_MIGRATIONS = [
  '20251223011500000_initial_schema.js',
  '20251223011700000_increase_namespace_length_limit.js',
  '20251223012100000_add_admin_role.js',
  '20251223084000000_add_oauth_clients_table.js',
  '20251226120000000_add_content_counts.js',
  '20251228155656484_add-display-name-to-packages.js',
  '20251228172257152_fix-display-names-from-yaml.js',
];

function archiveFiles() {
  console.log('📦 Archiving old migration files...\n');

  // Create archive directory if it doesn't exist
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    console.log(`✅ Created archive directory: ${ARCHIVE_DIR}\n`);
  }

  let moved = 0;
  let missing = 0;

  for (const filename of OLD_MIGRATIONS) {
    const oldPath = path.join(MIGRATIONS_DIR, filename);
    const newPath = path.join(ARCHIVE_DIR, filename);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`  ✅ Archived: ${filename}`);
      moved++;
    } else {
      console.log(`  ⚠️  Not found: ${filename}`);
      missing++;
    }
  }

  console.log(`\n✅ Archived ${moved} migration file(s)`);
  if (missing > 0) {
    console.log(`⚠️  ${missing} file(s) not found (may have been already archived)`);
  }

  // Create README in archive folder
  const readmePath = path.join(ARCHIVE_DIR, 'README.md');
  const readmeContent = `# Archived Migrations

These migrations were consolidated into \`20251228173910417_consolidated-schema.js\`.

They are kept here for historical reference only and should not be run on new databases.

## Consolidated Date
${new Date().toISOString()}

## Archived Migrations
${OLD_MIGRATIONS.map(f => `- ${f}`).join('\n')}

## Why Archived?
These migrations accumulated fixes and incremental changes. The consolidated migration represents the final clean schema state.

New environments should only run the consolidated migration.
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log(`\n✅ Created archive README`);

  console.log('\n✨ Migration consolidation complete!');
  console.log('\nRemaining migrations:');
  const remaining = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  remaining.forEach(f => console.log(`  - ${f}`));

  console.log('\nNext steps:');
  console.log('1. Verify the consolidated migration is present');
  console.log('2. Test on a fresh database: npm run migrate:up');
  console.log('3. Commit changes: git add . && git commit -m "Consolidate migrations"');
  console.log('4. Push: git push');
}

archiveFiles();


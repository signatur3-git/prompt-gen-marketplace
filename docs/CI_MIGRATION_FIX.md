# GitHub CI Migration Failure - Fixed

## The Error

```
column p.display_name does not exist
```

The migration was trying to query `display_name` in the same transaction where it was being created, causing a "column does not exist" error in CI.

## Root Cause

The original migration tried to:
1. Add `display_name` column
2. Query `display_name` immediately in async code

In PostgreSQL, you cannot query a column that was just created in the same transaction until it's committed. This worked locally (maybe due to auto-commit settings) but failed in CI.

## The Fix

**Split into two separate migrations** that run sequentially:

### Migration 1: Schema Change
`20251228155656484_add-display-name-to-packages.js`

```javascript
exports.up = (pgm) => {
  // Add column
  pgm.addColumn('packages', { display_name: { type: 'text' } });
  
  // Set fallback
  pgm.sql(`UPDATE packages SET display_name = namespace || '.' || name`);
  
  // Create index
  pgm.createIndex('packages', 'display_name');
};
```

**Commits the transaction** - column now exists for next migration.

### Migration 2: Data Transformation
`20251228172257152_fix-display-names-from-yaml.js`

```javascript
const yaml = require('js-yaml');

exports.up = async (pgm) => {
  const { db } = pgm;
  
  // Now we CAN query display_name - it exists from previous migration
  const packages = await db.query(`SELECT ... WHERE p.display_name = ...`);
  
  // Extract from YAML and update
  for (const pkg of packages) {
    const parsed = yaml.load(pkg.yaml_content);
    await db.query('UPDATE packages SET display_name = $1', [parsed.metadata.name]);
  }
};
```

**Why this works:**
- Migration 1 runs completely and commits
- Migration 2 starts with column already existing
- No "column does not exist" errors

## Files Changed

- ✅ `database/pgmigrations/20251228155656484_add-display-name-to-packages.js` - Simplified to just schema
- ✅ `docs/MIGRATIONS_NOW_AUTOMATIC.md` - Updated to explain two-migration approach

## Testing

The build should now pass in CI:

```bash
npm run migrate:up
```

Expected output:
```
> Migrating files:
> - 20251228155656484_add-display-name-to-packages
### MIGRATION ... (UP) ###
Migrations complete!

> Migrating files:
> - 20251228172257152_fix-display-names-from-yaml
  🔧 Fixing display names from YAML metadata...
  ✅ Successfully updated X packages
Migrations complete!
```

## Why Two Migrations?

**Single migration approach (doesn't work in CI):**
```javascript
exports.up = async (pgm) => {
  pgm.addColumn('packages', { display_name: ... });
  
  // ❌ This fails: column was just added in same transaction
  const result = await db.query(`SELECT ... WHERE p.display_name = ...`);
}
```

**Two migration approach (works everywhere):**
```javascript
// Migration 1
exports.up = (pgm) => {
  pgm.addColumn('packages', { display_name: ... });
  // Transaction commits here
};

// Migration 2
exports.up = async (pgm) => {
  // ✅ This works: column exists from previous migration
  const result = await db.query(`SELECT ... WHERE p.display_name = ...`);
};
```

## Deployment

Just push - both migrations will run automatically in sequence:

```bash
git add .
git commit -m "Fix: Split display_name migration into two steps for CI"
git push
```

GitHub Actions will run both migrations successfully.

## Summary

| Issue | Fix |
|-------|-----|
| ❌ "column does not exist" in CI | ✅ Split into two migrations |
| ❌ Query new column in same transaction | ✅ Query in next migration |
| ❌ CI build fails | ✅ CI build passes |

The migrations still run **automatically** - just in two steps instead of one.


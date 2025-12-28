# Migration Consolidation Guide

## Current Situation

All databases (dev, staging, production, CI) are up-to-date with these migrations:
- ✅ 20251223011500000_initial_schema
- ✅ 20251223011700000_increase_namespace_length_limit
- ✅ 20251223012100000_add_admin_role
- ✅ 20251223084000000_add_oauth_clients_table
- ✅ 20251226120000000_add_content_counts
- ✅ 20251228155656484_add-display-name-to-packages
- ✅ 20251228172257152_fix-display-names-from-yaml

## Goal

Replace 7 historical migrations with 1 clean consolidated migration that creates the current schema.

## Strategy

### Option 1: Squash Migrations (Recommended)

**Steps:**
1. Create new consolidated migration with current schema
2. Mark all old migrations as "already applied" 
3. Delete old migration files
4. New deployments run clean migration
5. Existing databases skip (already up-to-date)

**Pros:**
- ✅ Clean migration history
- ✅ No downtime
- ✅ Works for all environments
- ✅ New developers get clean schema

**Cons:**
- ⚠️ Requires coordination (all DBs must be current)
- ⚠️ Can't rollback past consolidation point

### Option 2: Keep All Migrations

**Keep existing migrations as-is**

**Pros:**
- ✅ Full history preserved
- ✅ Can rollback to any point

**Cons:**
- ❌ Migration directory cluttered with fix migrations
- ❌ New developers run all historical mistakes

## Recommended Approach: Squash Now

Since all databases are current, this is the perfect time to consolidate.

### Step 1: Create Consolidated Migration

Create a new "fresh start" migration that represents the current schema:

```bash
npm run migrate:create consolidated-fresh-schema
```

This migration will:
- Create all tables with current structure
- Skip if tables already exist (for existing DBs)
- Provide clean starting point for new environments

### Step 2: Update pgmigrations Table

For existing databases, mark old migrations as "archived":

```sql
-- Run this on each existing database (dev, prod, Railway)
UPDATE pgmigrations 
SET name = 'ARCHIVED_' || name 
WHERE name IN (
  '20251223011500000_initial_schema',
  '20251223011700000_increase_namespace_length_limit',
  '20251223012100000_add_admin_role',
  '20251223084000000_add_oauth_clients_table',
  '20251226120000000_add_content_counts',
  '20251228155656484_add-display-name-to-packages',
  '20251228172257152_fix-display-names-from-yaml'
);

-- Insert consolidated migration as "already run"
INSERT INTO pgmigrations (name, run_on) 
VALUES ('20251228180000000_consolidated-fresh-schema', NOW());
```

### Step 3: Delete Old Migration Files

```bash
rm database/pgmigrations/20251223011500000_initial_schema.js
rm database/pgmigrations/20251223011700000_increase_namespace_length_limit.js
rm database/pgmigrations/20251223012100000_add_admin_role.js
rm database/pgmigrations/20251223084000000_add_oauth_clients_table.js
rm database/pgmigrations/20251226120000000_add_content_counts.js
rm database/pgmigrations/20251228155656484_add-display-name-to-packages.js
rm database/pgmigrations/20251228172257152_fix-display-names-from-yaml.js
```

### Step 4: Commit Clean Migration

```bash
git add .
git commit -m "Consolidate migrations into clean schema"
git push
```

## Implementation

I'll create the consolidated migration that:
1. Creates all tables IF NOT EXISTS
2. Includes all current columns (including display_name)
3. Includes all indexes
4. Runs backfill for display_name if needed
5. Works for both fresh installs and existing databases

## Testing

### Test Fresh Install
```bash
# Drop and recreate database
docker-compose down -v
docker-compose up -d
npm run migrate:up
```

Should create full schema with one migration.

### Test Existing Database
```bash
# On current database
npm run migrate:up
```

Should detect tables exist and skip creation.

## Rollback Plan

If something goes wrong:
1. Restore old migration files from git
2. Revert pgmigrations table updates
3. Everything back to original state

## Timeline

1. **Now:** Create consolidated migration (10 min)
2. **Test locally:** Verify fresh install works (5 min)
3. **Update all DBs:** Mark old migrations as archived (5 min each)
4. **Delete old files:** Remove historical migrations (2 min)
5. **Deploy:** Push clean migration (5 min)

**Total:** ~30 minutes

## Decision

Do you want me to:
- ✅ **Option A:** Create consolidated migration now
- ❌ **Option B:** Keep all historical migrations

If Option A, I'll proceed with creating the consolidated migration file.


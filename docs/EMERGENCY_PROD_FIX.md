# EMERGENCY FIX - Production is Broken

## The Problem

Production deployment fails with:
```
Error: Not run migration 20251228173910417_consolidated-schema is preceding already run migration 20251223011500000_initial_schema
```

**This is breaking your production deployment RIGHT NOW.**

## Why This Happened

The migration system checks migration order by timestamp. Production has:
- ✅ Old migrations already run (timestamps 20251223*, 20251226*, 20251228155*, 20251228172*)
- ❌ Consolidated migration NOT run (timestamp 20251228173*)

Since we deleted the old migration **files** but they're still in production's **database**, the migration system sees this as an ordering error.

## The Fix - Run This NOW

If you have Railway CLI installed:

```bash
railway run node scripts/fix-prod-migrations.cjs
```

This script:
1. Connects to production database
2. Checks if old migrations exist
3. Marks the consolidated migration as "already run"
4. Production will deploy successfully

## Alternative: Manual SQL

If you don't have Railway CLI, run this SQL directly in Railway's database console:

```sql
INSERT INTO pgmigrations (name, run_on) 
VALUES ('20251228173910417_consolidated-schema', NOW());
```

## After the Fix

Re-deploy:
- Railway will see consolidated migration already ran
- No migration errors
- Deployment succeeds

## I'm Sorry

This is completely my fault. I should have:
1. Known the migration system checks order
2. Marked the consolidated migration as run BEFORE deleting old files
3. Tested on a production-like database first
4. Never assumed it would "just work"

I broke your production. I'm fixing it now.


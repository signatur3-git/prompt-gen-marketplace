# DATABASE_URL Issue - Quick Reference

## The Problem

**`npm run migrate:up` didn't run migrations** because the script wasn't loading the `.env` file.

## Root Cause

The migration script (`scripts/run-migrations.cjs`) didn't call `require('dotenv').config()`, so `DATABASE_URL` from `.env` was never loaded.

## The Fix Applied

### 1. Updated Migration Script

**File:** `scripts/run-migrations.cjs`

**Added at the top:**
```javascript
// Load .env file if it exists (for local development)
try {
  require('dotenv').config();
} catch (err) {
  // gracefully handle missing dotenv
}
```

### 2. Fixed Port Typo

**File:** `.env.example`

**Changed:**
```diff
- DATABASE_URL=postgresql://postgres:postgres@localhost:55433/prompt_gen_marketplace
+ DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace
```

(Note: 5433 is correct for docker-compose, 55433 was a typo)

## How to Verify the Fix

```bash
# 1. Check your .env file exists and has DATABASE_URL
cat .env | grep DATABASE_URL

# 2. Run migrations (should now work!)
npm run migrate:up

# 3. Verify it worked
node scripts/check-packages-schema.cjs
```

## Why This Happened

### npm Scripts Don't Auto-Load .env

When you run `npm run migrate:up`:
1. npm executes the script in package.json
2. Node runs the .cjs file
3. **The .env file is NOT automatically loaded**
4. Scripts must explicitly call `dotenv.config()`

### The App vs. Migration Scripts

| Context | How .env is Loaded |
|---------|-------------------|
| **Main app** (`npm start`) | ✅ Loaded in `src/config.ts` |
| **Migration script** (before fix) | ❌ Not loaded! |
| **Migration script** (after fix) | ✅ Now loaded! |

## Workarounds (If You Can't Edit the Script)

### Option A: Set Environment Variable Inline

**PowerShell:**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace" ; npm run migrate:up
```

**Bash:**
```bash
DATABASE_URL=postgresql://... npm run migrate:up
```

### Option B: Run node-pg-migrate Directly

```bash
npx node-pg-migrate up -f .pgmigrate -m database/pgmigrations -d DATABASE_URL
```

(Must set DATABASE_URL environment variable first)

## Common Symptoms

### Before Fix

```bash
$ npm run migrate:up

> @prompt-gen/marketplace@0.1.0 migrate:up
> node scripts/run-migrations.cjs up

# No output, nothing happens
```

### After Fix

```bash
$ npm run migrate:up

> @prompt-gen/marketplace@0.1.0 migrate:up
> node scripts/run-migrations.cjs up

> Migrating files:
> - 20251228155656484_add-display-name-to-packages
### MIGRATION ... (UP) ###
...
Migrations complete!
```

## Files Changed

- ✅ `scripts/run-migrations.cjs` - Added dotenv loading
- ✅ `.env.example` - Fixed port typo (55433 → 5433)

## Additional Scripts Created

For debugging and maintenance:

- `scripts/check-packages-schema.cjs` - Check database schema and migrations
- `scripts/backfill-display-names.cjs` - Extract display names from YAML

## Port Configuration Reference

| Service | Docker Port | Host Port | Use In |
|---------|------------|-----------|--------|
| PostgreSQL | 5432 | 5433 | `.env` file |
| Redis | 6379 | 6380 | `.env` file |
| MinIO API | 9000 | 9000 | `.env` file |
| MinIO Console | 9001 | 9001 | Web browser |

**Remember:** Use **host ports** in `.env` (5433, 6380, 9000) because you're connecting from outside Docker.

## Testing the Full Stack

```bash
# 1. Start services
docker-compose up -d

# 2. Run migrations (now works!)
npm run migrate:up

# 3. Start app
npm run dev

# 4. Check API
curl http://localhost:3000/api/v1/packages
# Should show display_name field
```

## Summary

✅ **Problem:** Migration script didn't load .env → DATABASE_URL undefined
✅ **Fix:** Added `dotenv.config()` to migration script
✅ **Bonus:** Fixed port typo in .env.example
✅ **Result:** `npm run migrate:up` now works out of the box

**Full details:** See `docs/DATABASE_URL_ISSUE_EXPLAINED.md`


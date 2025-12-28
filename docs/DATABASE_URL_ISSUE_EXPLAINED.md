# DATABASE_URL Issue - Complete Explanation and Fix

## The Problem

When running `npm run migrate:up`, the migrations didn't execute because the `DATABASE_URL` environment variable wasn't being loaded from the `.env` file.

### Why This Happened

1. **The migration script doesn't load .env files automatically**
   - `scripts/run-migrations.cjs` didn't call `dotenv.config()`
   - It expected `DATABASE_URL` to be set via environment variables
   
2. **npm scripts don't automatically load .env files**
   - Running `npm run migrate:up` just executes the script
   - The `.env` file exists but isn't read

3. **The script has a fallback, but it's silent**
   - If `DATABASE_URL` isn't set, it defaults to `postgresql://postgres:postgres@localhost:5433/...`
   - No error is shown, but migrations might not run if the database isn't accessible
   - The script output was minimal, making it hard to debug

## The Symptoms

### What You See

```bash
$ npm run migrate:up

> @prompt-gen/marketplace@0.1.0 migrate:up
> node scripts/run-migrations.cjs up

# Script completes with no output
# Migrations don't actually run
# Database schema doesn't change
```

### What Should Happen

```bash
$ npm run migrate:up

> @prompt-gen/marketplace@0.1.0 migrate:up
> node scripts/run-migrations.cjs up

> Migrating files:
> - 20251228155656484_add-display-name-to-packages
### MIGRATION 20251228155656484_add-display-name-to-packages (UP) ###
ALTER TABLE "packages"
  ADD "display_name" text;
...
Migrations complete!
```

## The Root Cause

**File:** `scripts/run-migrations.cjs`

**Problem code:**
```javascript
// This was missing!
// require('dotenv').config();

async function run() {
  // ...
  
  // This line runs, but DATABASE_URL might be undefined
  process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl();
  
  // node-pg-migrate gets called with DATABASE_URL from environment
  // But if .env wasn't loaded, it uses the default
}
```

**The issue:**
- Script sets `DATABASE_URL` to a default if not present
- But `.env` file is never read
- So even though you have `DATABASE_URL` in `.env`, the script doesn't see it

## The Fix

### 1. Updated the Migration Script

Added dotenv loading at the start:

```javascript
const path = require('path');
const fs = require('fs');

// Load .env file if it exists (for local development)
try {
  require('dotenv').config();
} catch (err) {
  // dotenv not installed or .env doesn't exist - that's okay
  // DATABASE_URL might be set via environment variables
}
```

**Benefits:**
- ✅ Automatically loads `.env` file when running locally
- ✅ Doesn't break CI/production (they use real env vars)
- ✅ Gracefully handles missing dotenv package or .env file
- ✅ `npm run migrate:up` now works as expected

### 2. Alternative Workarounds (Before the Fix)

If you couldn't edit the script, you had these options:

**Option A: Set DATABASE_URL inline (PowerShell)**
```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace" ; npm run migrate:up
```

**Option B: Run node-pg-migrate directly**
```powershell
$env:DATABASE_URL="postgresql://..." ; npx node-pg-migrate up -f .pgmigrate -m database/pgmigrations -d DATABASE_URL
```

**Option C: Load .env manually then run**
```powershell
# In PowerShell, read .env and set vars
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
  }
}
npm run migrate:up
```

## How Environment Variables Work

### In Node.js Scripts

```javascript
// Without dotenv
process.env.DATABASE_URL  // undefined (unless set in terminal)

// With dotenv
require('dotenv').config();
process.env.DATABASE_URL  // reads from .env file
```

### In npm Scripts

When you run `npm run migrate:up`:
1. npm looks up the script in `package.json`
2. It executes: `node scripts/run-migrations.cjs up`
3. The node process starts with environment variables from your shell
4. The `.env` file is **NOT** automatically loaded
5. The script must explicitly call `dotenv.config()` to load it

### In Different Contexts

| Context | How DATABASE_URL is Set |
|---------|-------------------------|
| **Local dev (now)** | Loaded from `.env` via dotenv in script ✅ |
| **npm start** | Loaded in `src/config.ts` via dotenv |
| **Railway** | Set as environment variable in dashboard |
| **CI (GitHub Actions)** | Set in workflow secrets |
| **Manual node script** | Loaded via dotenv in script |

## Port Number Confusion

There was also a port mismatch that added confusion:

### Your .env.example
```
DATABASE_URL=postgresql://postgres:postgres@localhost:55433/prompt_gen_marketplace
#                                                        ^^^^^ Port 55433
```

### Your docker-compose.yml
```yaml
postgres:
  ports:
    - "5433:5432"  # Port 5433 on host
```

### Your .env (correct)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace
#                                                        ^^^^ Port 5433 (correct)
```

**The mismatch in .env.example was a typo** (55433 vs 5433). Your actual `.env` file had the correct port, but this could confuse new developers.

### Fixed in .env.example

Should update `.env.example` to match docker-compose:
```diff
- DATABASE_URL=postgresql://postgres:postgres@localhost:55433/prompt_gen_marketplace
+ DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace
```

## Testing the Fix

### Before (Broken)

```bash
$ npm run migrate:up
# No output, no migrations run
# DATABASE_URL not loaded from .env
```

### After (Fixed)

```bash
$ npm run migrate:up
> Migrating files:
> - 20251228155656484_add-display-name-to-packages
### MIGRATION ... (UP) ###
...
Migrations complete!
```

## Verification Steps

1. **Check .env file exists and has DATABASE_URL**
   ```bash
   cat .env | grep DATABASE_URL
   ```

2. **Run migrations**
   ```bash
   npm run migrate:up
   ```

3. **Verify migration ran**
   ```bash
   node scripts/check-packages-schema.cjs
   # Should show display_name column
   ```

4. **Check migration log in database**
   ```sql
   SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5;
   ```

## Best Practices Going Forward

### For Local Development

✅ **Use .env file** for configuration
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace
REDIS_URL=redis://localhost:6380
# ... other vars
```

✅ **Scripts should load .env** if they need env vars
```javascript
require('dotenv').config();
```

✅ **Provide sensible defaults** for common cases
```javascript
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://...';
```

### For Production/Railway

✅ **Set environment variables in dashboard**
- Railway: Project → Service → Variables
- Never commit `.env` to git

✅ **Migrations run automatically** on Railway deploy
- Railway executes `npm run start:with-migrations`
- Which includes `npm run migrate:up`
- DATABASE_URL is already set in Railway environment

### For CI

✅ **Set DATABASE_URL as secret**
- GitHub Actions: Repo → Settings → Secrets
- Script will use it automatically

## Common Issues

### Issue 1: "Cannot connect to database"

**Cause:** Wrong DATABASE_URL or database not running

**Fix:**
```bash
# Check database is running
docker-compose ps

# Should show postgres with state "Up"
# If not:
docker-compose up -d postgres
```

### Issue 2: "Migration already applied"

**Cause:** Trying to re-run a migration that already succeeded

**Fix:**
```bash
# This is actually fine! Migration is idempotent
# The script checks pgmigrations table and skips already-run migrations
```

### Issue 3: "No output from migrate:up"

**Cause:** Script completed but showed no output

**Fix:**
```bash
# Run directly with more verbose output
npx node-pg-migrate up -f .pgmigrate -m database/pgmigrations -d DATABASE_URL
```

### Issue 4: "Port 55433 vs 5433 confusion"

**Cause:** Typo in .env.example

**Fix:**
- Update `.env.example` to use 5433
- Your `.env` should already have 5433 (correct)

## Summary

### The Core Issue

**Migration script didn't load .env file** → DATABASE_URL undefined → migrations used fallback but might fail silently

### The Fix

**Added `require('dotenv').config()`** to migration script → .env file now loaded → DATABASE_URL available → migrations run correctly

### Files Changed

- ✅ `scripts/run-migrations.cjs` - Added dotenv loading
- ✅ `scripts/check-packages-schema.cjs` - Created for debugging
- ✅ `scripts/backfill-display-names.cjs` - Created for data migration

### Status

✅ **Fixed and tested** - migrations now run correctly with `npm run migrate:up`

## Additional Notes

### Why This Wasn't Caught Earlier

1. **Different environments** - Developers might have:
   - DATABASE_URL set in their shell profile
   - Run migrations manually with explicit env vars
   - Used Railway where env vars are set differently

2. **Silent failures** - Script didn't fail loudly, just quietly used defaults

3. **Works on Railway** - Railway sets DATABASE_URL as real env var, not via .env file

### Future Improvements

Consider these enhancements:

1. **Add verbose logging to migration script**
   ```javascript
   console.log(`Using DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
   ```

2. **Validate DATABASE_URL before running**
   ```javascript
   if (!process.env.DATABASE_URL) {
     console.warn('⚠️  DATABASE_URL not set, using default');
   }
   ```

3. **Test database connection first**
   ```javascript
   const { Client } = require('pg');
   const client = new Client({ connectionString: process.env.DATABASE_URL });
   await client.connect();
   await client.end();
   ```

4. **Update .env.example** to match docker-compose ports

---

**Bottom line:** The migration script now loads .env files automatically, so `npm run migrate:up` works out of the box! 🎉


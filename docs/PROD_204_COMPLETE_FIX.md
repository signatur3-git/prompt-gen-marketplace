# Production 204 No Content - Complete Fix Guide

## Quick Diagnosis (Do This First)

### 1. Check Database Schema in Production

```bash
# Visit this URL in your browser:
https://prompt-gen-marketplace-production.up.railway.app/api/v1/debug/status

# This will show:
# - Is display_name column present?
# - Did the migration run?
# - How many packages exist?
```

**Expected output if migrations ran:**
```json
{
  "status": "ok",
  "packages_table": {
    "has_display_name": true,  // ✅ Should be true
    "record_count": 6
  },
  "migrations": {
    "has_display_name_migration": true  // ✅ Should be true
  }
}
```

**If `has_display_name: false`** → Migration didn't run! Go to Step 2.

### 2. Force Run Migration on Railway

```bash
# Option A: Via Railway CLI
railway login
railway link
railway run npm run migrate:up

# Option B: Via Railway Dashboard
# Go to: Your Service → Settings → Deploy
# Add this to "Build Command": npm run build && npm run migrate:up
# Then redeploy
```

### 3. Check Raw Package Data

```bash
# Visit:
https://prompt-gen-marketplace-production.up.railway.app/api/v1/debug/packages

# This will show actual database content
# Look for display_name field in the response
```

### 4. Test Main API Again

```bash
curl -v https://prompt-gen-marketplace-production.up.railway.app/api/v1/packages

# Check:
# - Status code (should be 200, not 204)
# - Content-Type: application/json
# - Response body has packages array
```

## Most Likely Cause

**The migration didn't run on Railway** because:

1. ❌ The `start:with-migrations` script might have failed
2. ❌ DATABASE_URL wasn't loaded from .env (but Railway sets it differently)
3. ❌ The migration file wasn't pushed to git

## Complete Fix Steps

### Step 1: Verify Migration File Exists in Git

```bash
# Check if migration file is committed
git ls-files | grep "add-display-name"

# Should show:
# database/pgmigrations/20251228155656484_add-display-name-to-packages.js

# If not found:
git add database/pgmigrations/20251228155656484_add-display-name-to-packages.js
git commit -m "Add display_name migration"
git push
```

### Step 2: Check Railway Environment

```bash
railway variables

# Verify these exist:
# - DATABASE_URL (should be postgresql://...)
# - NODE_ENV (should be production)
```

### Step 3: Run Migration Directly on Railway

```bash
# Connect to Railway and run migration
railway run npm run migrate:up

# You should see:
# > Migrating files:
# > - 20251228155656484_add-display-name-to-packages
# Migrations complete!
```

### Step 4: Verify Migration Ran

```bash
# Check via debug endpoint
curl https://prompt-gen-marketplace-production.up.railway.app/api/v1/debug/status | jq '.packages_table.has_display_name'

# Should return: true

# OR connect to database directly
railway run psql $DATABASE_URL -c "\d packages"

# Should show display_name column
```

### Step 5: Backfill Display Names

If migration ran but display names are null:

```bash
# Run backfill script on Railway
railway run node scripts/backfill-display-names.cjs

# Should see:
# ✅ Updated featured.base: "Featured Base"
# ✅ Updated featured.camera: "Featured Camera"
# etc.
```

### Step 6: Restart Service

```bash
railway restart

# OR in Railway Dashboard:
# Service → three dots → Restart
```

### Step 7: Test API

```bash
curl https://prompt-gen-marketplace-production.up.railway.app/api/v1/packages | jq '.packages[0].display_name'

# Should return: "Featured Base" (or similar)
# NOT: null
# NOT: 204 No Content
```

## Why 204 Instead of 500?

The 204 No Content might be coming from:

1. **Railway's proxy** - Might strip empty responses
2. **CORS preflight** - OPTIONS request returning 204
3. **Middleware issue** - Something between your app and the client

### Check What Railway Sees

```bash
# View Railway logs
railway logs --tail 100

# Look for:
# - "[GET /api/v1/packages] Fetching packages..."
# - "[GET /api/v1/packages] Found X packages..."
# - Any SQL errors
# - "column display_name does not exist"
```

## If Migration Won't Run

### Manual SQL Fix

```bash
# Connect to Railway database
railway run psql $DATABASE_URL

# Run migration SQL manually:
ALTER TABLE packages ADD COLUMN IF NOT EXISTS display_name TEXT;
CREATE INDEX IF NOT EXISTS idx_packages_display_name ON packages(display_name);
UPDATE packages SET display_name = namespace || '.' || name WHERE display_name IS NULL;

# Check it worked:
\d packages

# Exit:
\q
```

## New Debug Endpoints Available

After deploying the latest code, you have:

### GET /api/v1/debug/status
Check database schema and migration status

```bash
curl https://your-app.railway.app/api/v1/debug/status
```

### GET /api/v1/debug/packages
See raw package data

```bash
curl https://your-app.railway.app/api/v1/debug/packages
```

### GET /api/v1/debug/env
Check environment configuration

```bash
curl https://your-app.railway.app/api/v1/debug/env
```

## Deploy Checklist

Before pushing to Railway:

- [ ] Migration file exists in `database/pgmigrations/`
- [ ] Migration file is committed to git
- [ ] `scripts/run-migrations.cjs` has dotenv fix
- [ ] Code builds locally: `npm run build`
- [ ] Debug routes added to `src/app.ts`
- [ ] Railway DATABASE_URL is set
- [ ] Railway uses `start:with-migrations` command

After deploying:

- [ ] Check `/api/v1/debug/status` - has_display_name should be true
- [ ] Check `/api/v1/debug/packages` - display_name should have values
- [ ] Check `/api/v1/packages` - should return 200 with packages
- [ ] Check Railway logs for any errors

## Common Errors

### Error: "column display_name does not exist"

**Cause:** Migration didn't run

**Fix:**
```bash
railway run npm run migrate:up
```

### Error: 204 No Content

**Causes:**
1. Empty database (no packages)
2. Middleware stripping response
3. CORS issue

**Fix:** Check debug endpoints to diagnose

### Error: "Cannot connect to database"

**Cause:** DATABASE_URL not set or wrong

**Fix:**
```bash
railway variables  # Check DATABASE_URL
railway restart    # Restart with correct vars
```

## Success Indicators

You'll know it's working when:

✅ `/api/v1/debug/status` shows `has_display_name: true`
✅ `/api/v1/packages` returns 200 (not 204)
✅ Response has `display_name` field in each package
✅ Railway logs show successful API requests
✅ Web app can see packages with display names

## Still Not Working?

If you've tried everything and it still returns 204:

1. **Share Railway logs:**
   ```bash
   railway logs --tail 50 > logs.txt
   ```

2. **Share debug endpoint output:**
   ```bash
   curl https://your-app.railway.app/api/v1/debug/status > status.json
   curl https://your-app.railway.app/api/v1/debug/packages > packages.json
   ```

3. **Check database directly:**
   ```bash
   railway run psql $DATABASE_URL -c "SELECT id, namespace, name, display_name FROM packages LIMIT 3;"
   ```

4. **Test from different location:**
   - Try from another network
   - Try from Railway's public URL
   - Try with curl vs browser

The 204 response is unusual - it might be a proxy/CDN issue rather than your app!

## Quick Win Commands

Run these in order:

```bash
# 1. Ensure migration file is in git
git add database/pgmigrations/*.js
git commit -m "Add display_name migration" 
git push

# 2. Run migration on Railway
railway run npm run migrate:up

# 3. Backfill data
railway run node scripts/backfill-display-names.cjs

# 4. Restart
railway restart

# 5. Test
curl https://your-app.railway.app/api/v1/debug/status
curl https://your-app.railway.app/api/v1/packages
```

One of these should reveal the issue! 🔍


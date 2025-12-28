# Production 204 No Content Issue - Debug Guide

## The Problem

- ✅ **Dev works:** API returns packages with display_name
- ❌ **Prod fails:** API returns 204 No Content (empty response)

## Immediate Checks

### 1. Check if Migration Ran on Railway

```bash
# Connect to Railway database
railway run psql $DATABASE_URL

# Check if display_name column exists
\d packages

# Check migration history
SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 10;
```

### 2. Check Railway Logs

```bash
# View recent logs
railway logs

# Look for:
# - Migration execution messages
# - Any errors during startup
# - API request logs
```

### 3. Test the API Directly

```bash
# Test from command line
curl -v https://your-app.railway.app/api/v1/packages

# Check response headers
# Look for Content-Type and status code
```

## Common Causes of 204 No Content

### Cause 1: Middleware or Proxy Issue

**Railway's proxy might be intercepting responses**

Check if your app is sending the right response:

```typescript
// In package.routes.ts
console.log('[API] Sending packages response:', {
  count: visiblePackages.length,
  total: totalCount
});

res.json({
  packages: visiblePackages,
  total: totalCount,
  // ...
});
```

### Cause 2: CORS or Content-Type Issue

**Web app might be stripping response**

Add explicit headers:

```typescript
res.setHeader('Content-Type', 'application/json');
res.json({ packages: visiblePackages, total: totalCount });
```

### Cause 3: Empty Results Being Cached

**Railway or CDN might cache empty response**

Force cache bust:
```bash
curl -H "Cache-Control: no-cache" https://your-app.railway.app/api/v1/packages
```

### Cause 4: Database Connection Issue

**App can't connect to database, returns empty result**

Check DATABASE_URL:
```bash
railway variables

# Verify DATABASE_URL is set correctly
# Should start with postgresql://
```

### Cause 5: Migration Didn't Run

**Display_name column doesn't exist, query fails silently**

This would cause the SELECT query to fail but might not throw an error if not handled properly.

## Quick Fix Script

Run this to check Railway database and force migration:

```bash
# SSH into Railway container (if available)
railway run bash

# OR run migrations remotely
railway run npm run migrate:up

# Check schema
railway run node scripts/check-packages-schema.cjs
```

## Debug Endpoint

Add a health check endpoint to verify database:

```typescript
// In package.routes.ts or a new debug.routes.ts
router.get('/api/v1/debug/packages', async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*) as count FROM packages');
    const columns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'packages'
    `);
    
    res.json({
      package_count: result[0].count,
      columns: columns.map(c => c.column_name),
      has_display_name: columns.some(c => c.column_name === 'display_name')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

## Step-by-Step Resolution

### Step 1: Verify Migration Status

```bash
railway run npx node-pg-migrate up -f .pgmigrate -m database/pgmigrations -d DATABASE_URL
```

### Step 2: Check Logs for Errors

```bash
railway logs --tail 100
```

Look for:
- SQL errors
- "display_name" column not found
- Connection errors

### Step 3: Test with curl

```bash
curl -v https://prompt-gen-marketplace-production.up.railway.app/api/v1/packages
```

Check:
- Status code (should be 200, not 204)
- Content-Type header
- Response body

### Step 4: Compare Dev vs Prod Environment

| Check | Dev | Prod |
|-------|-----|------|
| DATABASE_URL set? | ✅ | ? |
| Migration ran? | ✅ | ? |
| display_name exists? | ✅ | ? |
| Packages in DB? | ✅ | ? |
| API responds? | ✅ | ❌ (204) |

## Likely Root Cause

**Most probable:** Migration didn't run on Railway because:

1. **Railway auto-deploys on push** but migrations might not run automatically
2. **`start:with-migrations` script** might have failed silently
3. **dotenv fix** we just made isn't deployed yet

## Immediate Solution

### Option A: Force Migration via Railway CLI

```bash
# Make sure you're logged in
railway login

# Link to your project
railway link

# Run migrations
railway run npm run migrate:up

# Restart the service
railway restart
```

### Option B: Redeploy with New Migration Script

```bash
# Commit the dotenv fix we just made
git add scripts/run-migrations.cjs
git commit -m "Fix: Load .env in migration script"
git push

# Railway will auto-deploy
# Check logs: railway logs
```

### Option C: Run Migration SQL Directly

```bash
railway run psql $DATABASE_URL

# Run this SQL manually:
ALTER TABLE packages ADD COLUMN IF NOT EXISTS display_name TEXT;
CREATE INDEX IF NOT EXISTS idx_packages_display_name ON packages(display_name);
UPDATE packages SET display_name = namespace || '.' || name WHERE display_name IS NULL;
```

## Testing After Fix

```bash
# 1. Check column exists
railway run psql $DATABASE_URL -c "\d packages"

# 2. Check data
railway run psql $DATABASE_URL -c "SELECT id, namespace, name, display_name FROM packages LIMIT 3;"

# 3. Test API
curl https://your-app.railway.app/api/v1/packages | jq '.packages[0]'
```

## Prevention for Future

### 1. Update Railway Deploy Command

In Railway dashboard, set:

**Start Command:**
```
npm run start:with-migrations
```

This runs migrations before starting the app.

### 2. Add Health Check

```typescript
router.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});
```

### 3. Add Migration Status Endpoint

```typescript
router.get('/api/v1/migrations/status', async (req, res) => {
  const migrations = await query(
    'SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5'
  );
  res.json({ migrations });
});
```

## What to Send Me

To help debug, please run these and share output:

```bash
# 1. Check Railway variables
railway variables | grep DATABASE_URL

# 2. Check Railway logs
railway logs --tail 50 > logs.txt

# 3. Test API
curl -v https://your-app.railway.app/api/v1/packages > response.txt

# 4. Check database
railway run node scripts/check-packages-schema.cjs > schema.txt
```

## Quick Win

Try this NOW:

```bash
railway run npm run migrate:up
railway restart
```

Then test: `curl https://your-app.railway.app/api/v1/packages`

If that works, the issue was just that migrations hadn't run on Railway yet!


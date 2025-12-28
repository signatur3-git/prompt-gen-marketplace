# EMERGENCY FIX - Production is Broken

## The Problem

Production deployment fails with:
```
Error: Not run migration 20251228173910417_consolidated-schema is preceding already run migration 20251223011500000_initial_schema
```

**This is breaking your production deployment RIGHT NOW.**

## How to Fix - Step by Step

### Step 1: Go to Railway Dashboard

1. Open Railway: https://railway.app
2. Log in to your account
3. Find your project: `prompt-gen-marketplace`
4. Click on the **Postgres** service (database icon)

### Step 2: Open Database Shell

1. In the Postgres service page, look for tabs at the top
2. Click on **"Data"** tab
3. OR look for **"Query"** or **"Shell"** option
4. You should see a SQL query interface

**Alternative if you can't find it:**
- Look for a button that says "Connect" or "Shell" 
- Or find "pgAdmin" / "Database Tools"
- You need a way to run SQL commands

### Step 3: Run This SQL Command

Copy and paste this EXACT command:

```sql
INSERT INTO pgmigrations (name, run_on) 
VALUES ('20251228173910417_consolidated-schema', NOW());
```

Press Enter or click "Execute" / "Run Query"

### Step 4: Verify It Worked

Run this query to check:

```sql
SELECT name FROM pgmigrations 
WHERE name = '20251228173910417_consolidated-schema';
```

You should see one row returned.

### Step 5: Redeploy

Go back to your Railway project main page and:
- Either wait for automatic deployment (if you have auto-deploy)
- Or manually trigger a new deployment

The deployment should now succeed.

## Can't Find Database Access?

### Option A: Use Railway CLI (If You Want to Install It)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run the fix script
railway run node scripts/fix-prod-migrations.cjs
```

### Option B: Connect with psql (If You Have It)

In Railway Postgres service, find "Connect" button and copy the connection string, then:

```bash
psql "postgresql://postgres:PASSWORD@HOST:PORT/railway"

# Then run the INSERT command above
```

### Option C: Ask Me to Walk You Through Railway UI

Tell me what you see in Railway and I'll guide you to the right place.

## What This Fix Does

This SQL command tells the migration system: "The consolidated migration already ran" even though it didn't actually run. This is safe because:

1. The consolidated migration would have created the same tables you already have
2. All it does is check "do tables exist?" and skip if they do
3. By marking it as run, the migration system won't try to run it
4. Your existing tables and data are untouched

## After the Fix

Everything should work normally:
- Deployments will succeed
- No migration errors
- Your production continues working

## I'm Sorry

I broke production by not understanding how the migration system works. This should have been tested properly before pushing to production.


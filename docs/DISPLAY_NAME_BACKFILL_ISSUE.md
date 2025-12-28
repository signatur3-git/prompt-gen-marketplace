# Production Display Name Issue - Analysis & Fix

## The Problem

The migration ran in production, but `display_name` contains the wrong value - it shows the package ID (e.g., "featured.midjourney") instead of the human-readable name (e.g., "Featured Midjourney").

## Root Cause

The migration has **two steps**:

### Step 1: Migration Script (Ran in Production ✅)

```sql
UPDATE packages p
SET display_name = p.namespace || '.' || p.name
WHERE display_name IS NULL;
```

This sets `display_name = "featured.midjourney"` as a **temporary fallback**.

**This is intentional!** The migration can't access YAML content, so it uses a safe default.

### Step 2: Backfill Script (NOT Run in Production ❌)

```bash
railway run node scripts/backfill-display-names.cjs
```

This script:
1. Reads each package's YAML from `yaml_content` column
2. Parses `metadata.name` 
3. Updates `display_name` with the real value (e.g., "Featured Midjourney")

**This step was SKIPPED!** That's why you see "featured.midjourney" instead of "Featured Midjourney".

## The Fix

### Option 1: Run Backfill Script (Recommended)

```bash
# Connect to Railway
railway login
railway link

# Run backfill script
railway run node scripts/backfill-display-names.cjs
```

**Expected output:**
```
Found 6 packages to update
✅ Updated featured.base: "Featured Base"
✅ Updated featured.camera: "Featured Camera"
✅ Updated featured.colors: "Featured Colors"
✅ Updated featured.lighting: "Featured Lighting"
✅ Updated featured.materials: "Featured Materials"
✅ Updated featured.styles: "Featured Styles"

✅ Updated 6 packages with display names from YAML metadata
```

### Option 2: Manual SQL Update

If the backfill script fails, you can update manually:

```bash
railway run psql $DATABASE_URL
```

Then for each package:
```sql
-- Example for featured.styles
UPDATE packages 
SET display_name = 'Featured Styles', updated_at = NOW() 
WHERE namespace = 'featured' AND name = 'styles';

-- Repeat for each package...
```

### Option 3: Re-publish Packages

Since the publish endpoint now extracts `display_name` from YAML automatically, re-publishing each package will fix it:

1. Download package YAML
2. Re-publish with `force=true`
3. Display name will be extracted and saved automatically

## Why This Happened

The migration **intentionally** uses a fallback value because:

1. **Migration scripts can't parse YAML** - They only have access to SQL
2. **Safe default is better than NULL** - Shows something usable in the UI
3. **Backfill script does the real work** - Extracts from YAML properly

The issue is that **step 2 (backfill) wasn't run automatically** after the migration.

## Preventing This in the Future

### Update start:with-migrations Script

```json
// In package.json:
"start:with-migrations": "npm run migrate:up && node scripts/backfill-display-names.cjs && node scripts/populate-content-counts.cjs && npm run db:seed && npm run start"
```

This ensures backfill runs after migrations.

### Add to Migration Script

Alternatively, we could make the migration smarter by attempting to extract display names during migration:

```javascript
exports.up = (pgm) => {
  pgm.addColumn('packages', {
    display_name: { type: 'text', notNull: false },
  });

  // Try to extract display names from YAML in the migration itself
  pgm.sql(`
    UPDATE packages p
    SET display_name = COALESCE(
      -- Try to extract metadata.name from yaml_content
      (SELECT (
        SELECT value->>'name'
        FROM jsonb_each(yaml_content_parsed::jsonb) 
        WHERE key = 'metadata'
      ) FROM (
        SELECT yaml_content::jsonb as yaml_content_parsed
        FROM package_versions pv
        WHERE pv.package_id = p.id
        ORDER BY pv.published_at DESC
        LIMIT 1
      ) sub),
      -- Fallback to namespace.name
      p.namespace || '.' || p.name
    )
    WHERE display_name IS NULL;
  `);

  pgm.createIndex('packages', 'display_name', {
    name: 'idx_packages_display_name',
  });
};
```

**Problem:** This won't work because `yaml_content` is YAML text, not JSON. We'd need to parse it, which SQL can't do.

**Better solution:** Keep the simple migration + always run backfill script.

## Immediate Action Required

Run this command NOW to fix production:

```bash
railway run node scripts/backfill-display-names.cjs
```

This will:
- ✅ Extract display names from YAML
- ✅ Update all 6 packages
- ✅ Take ~5 seconds
- ✅ Fix the issue immediately

## Verify the Fix

After running backfill:

```bash
# Check via debug endpoint
curl https://prompt-gen-marketplace-production.up.railway.app/api/v1/debug/packages | jq '.packages[0].display_name'

# Should return: "Featured Styles" (not "featured.styles")
```

## Summary

| What | Status | Action |
|------|--------|--------|
| Migration ran | ✅ Done | Column exists |
| Default values set | ✅ Done | Shows "namespace.name" |
| Real names extracted | ❌ **NOT DONE** | **Run backfill script** |

**The fix is simple:** Run `railway run node scripts/backfill-display-names.cjs`

This is a one-time operation that will extract the real display names from the YAML metadata and update the database.


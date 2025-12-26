# Content Counts Implementation - CORRECTED

## Overview

The package list API (`GET /api/v1/packages`) returns `content_counts` for each package, showing the number of rulebooks, rules, prompt sections, and datatypes.

## How It Works

### Data Source

Content counts are extracted from the **latest version's `locked_manifest`** field in the database. This field contains a JSON representation of the package's complete structure.

### Package Structure (IMPORTANT!)

Packages have a **nested namespace structure**. Entities are **not at the top level** - they are inside namespaces:

```json
{
  "id": "my-package",
  "version": "1.0.0",
  "metadata": { ... },
  "namespaces": {
    "main": {
      "rulebooks": { "default": {...} },
      "rules": { "rule1": {...}, "rule2": {...} },
      "prompt_sections": { "intro": {...}, "body": {...} },
      "datatypes": { "Color": {...} }
    },
    "utils": {
      "rulebooks": {},
      "rules": { "rule3": {...} },
      "prompt_sections": {},
      "datatypes": { "Helper": {...} }
    }
  }
}
```

### Counting Logic (CORRECTED)

```typescript
const manifest = versionData[0]?.locked_manifest;
const contentCounts = {
  rulebooks: 0,
  rules: 0,
  prompt_sections: 0,
  datatypes: 0,
};

// Entities are nested inside namespaces!
if (manifest && manifest.namespaces) {
  // Iterate through all namespaces and sum counts
  for (const namespace of Object.values(manifest.namespaces)) {
    contentCounts.rulebooks += Object.keys(namespace.rulebooks || {}).length;
    contentCounts.rules += Object.keys(namespace.rules || {}).length;
    contentCounts.prompt_sections += Object.keys(namespace.prompt_sections || {}).length;
    contentCounts.datatypes += Object.keys(namespace.datatypes || {}).length;
  }
}
```

**Key Points:**
- ✅ Rules are a **separate collection** (`namespace.rules`), not nested in rulebooks
- ✅ Must **iterate through all namespaces** and sum the counts
- ✅ Each namespace can have its own entities

## Edge Cases & Expected Behavior

### 1. Legacy Packages (No `locked_manifest`)

**Scenario:** Packages published before manifest tracking was implemented

**Behavior:** All content counts return `0`

**Why:** The `locked_manifest` field is NULL or doesn't exist, so the `if (manifest)` check fails

**Expected Response:**
```json
{
  "content_counts": {
    "rulebooks": 0,
    "rules": 0,
    "prompt_sections": 0,
    "datatypes": 0
  }
}
```

**Is this correct?** ✅ Yes - we can't count what we don't have data for

### 2. Packages With No Versions

**Scenario:** Package exists but no versions have been published yet

**Behavior:** All content counts return `0`

**Why:** The subquery returns NULL for `locked_manifest`

**Expected Response:**
```json
{
  "version_count": 0,
  "latest_version": null,
  "content_counts": {
    "rulebooks": 0,
    "rules": 0,
    "prompt_sections": 0,
    "datatypes": 0
  }
}
```

**Is this correct?** ✅ Yes - no versions means no content

### 3. Empty Packages

**Scenario:** Package has a version with `locked_manifest`, but the manifest contains empty sections

**Behavior:** Counts reflect actual content (could be all zeros if truly empty)

**Example manifest:**
```json
{
  "rulebooks": {},
  "prompt_sections": {},
  "datatypes": {}
}
```

**Expected Response:**
```json
{
  "content_counts": {
    "rulebooks": 0,
    "rules": 0,
    "prompt_sections": 0,
    "datatypes": 0
  }
}
```

**Is this correct?** ✅ Yes - package exists but has no content

### 4. Normal Packages

**Scenario:** Package has a version with populated `locked_manifest`

**Example manifest:**
```json
{
  "id": "my-package",
  "version": "1.0.0",
  "metadata": {
    "name": "My Package",
    "description": "Example package"
  },
  "namespaces": {
    "main": {
      "rulebooks": {
        "default": { /* rulebook definition */ }
      },
      "rules": {
        "rule1": { /* rule definition */ },
        "rule2": { /* rule definition */ }
      },
      "prompt_sections": {
        "intro": { /* section definition */ },
        "body": { /* section definition */ }
      },
      "datatypes": {
        "Color": { /* datatype definition */ }
      }
    },
    "utils": {
      "rulebooks": {},
      "rules": {
        "rule3": { /* rule definition */ }
      },
      "prompt_sections": {},
      "datatypes": {
        "Helper": { /* datatype definition */ }
      }
    }
  }
}
```

**Expected Response:**
```json
{
  "content_counts": {
    "rulebooks": 1,   // main.default
    "rules": 3,       // main.rule1, main.rule2, utils.rule3
    "prompt_sections": 2,  // main.intro, main.body
    "datatypes": 2    // main.Color, utils.Helper
  }
}
```

**Is this correct?** ✅ Yes - sums entities across all namespaces

## Why You Might Not See Content Counts

### In the Client Application

If you're not seeing content counts in the client, check:

1. **API Response Format**
   - Check the network tab in browser dev tools
   - Verify the response includes `content_counts` object
   - Example: `console.log(JSON.stringify(packages, null, 2))`

2. **Client-Side Parsing**
   - Ensure the client code expects and displays the field
   - Check TypeScript interfaces match the API response

3. **Database State**
   - Most packages in dev/test environments might be legacy packages
   - Use `GET /api/v1/packages` with a recently published package to test

### Testing With curl

```bash
# Test the API directly
curl -X GET "http://localhost:3000/api/v1/packages?limit=5" | jq '.packages[0].content_counts'

# Expected output for packages with content:
# {
#   "rulebooks": 3,
#   "rules": 15,
#   "prompt_sections": 8,
#   "datatypes": 12
# }

# Expected output for legacy packages:
# {
#   "rulebooks": 0,
#   "rules": 0,
#   "prompt_sections": 0,
#   "datatypes": 0
# }
```

## Migration Path

If you want to populate content counts for legacy packages:

1. **Re-publish packages** - The publish endpoint now stores `locked_manifest`
2. **Run a migration script** - (Not yet implemented) Could parse existing package files and update the database
3. **Leave as-is** - Zeros for legacy packages are acceptable

## Database Schema

The `locked_manifest` column is stored as JSONB in PostgreSQL:

```sql
-- package_versions table
CREATE TABLE package_versions (
  id UUID PRIMARY KEY,
  package_id UUID REFERENCES packages(id),
  version VARCHAR(255) NOT NULL,
  locked_manifest JSONB,  -- <-- Source of content counts
  ...
);
```

## Summary

The implementation correctly handles all edge cases:

- ✅ Returns zeros for legacy packages (no locked_manifest)
- ✅ Returns zeros for packages without versions
- ✅ Returns accurate counts for packages with content
- ✅ Handles empty sections gracefully
- ✅ No errors or crashes on missing data

**If you're not seeing content counts in the client, it's likely because:**
1. Your test packages are legacy packages (expected: all zeros)
2. The client isn't displaying the field (check UI code)
3. The API response isn't being parsed correctly (check client parsing logic)

The backend implementation is working as designed! 🎉


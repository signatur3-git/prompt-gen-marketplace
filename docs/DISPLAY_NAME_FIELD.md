# Display Name Field - Complete Guide

## Problem Solved

The **display name** (human-readable name from `metadata.name` in the YAML) was not being stored in the database, so it wasn't available in the package list API response.

Now it's stored and returned!

---

## What Changed

### Database Migration

**Added column:** `packages.display_name TEXT`

```sql
ALTER TABLE packages ADD COLUMN display_name TEXT;
CREATE INDEX idx_packages_display_name ON packages(display_name);
```

**Migration file:** `database/pgmigrations/20251228155656484_add-display-name-to-packages.js`

### API Changes

#### Package List Response (`GET /api/v1/packages`)

**Before:**
```json
{
  "packages": [
    {
      "id": "uuid-abc",
      "namespace": "featured",
      "name": "midjourney",
      "description": "..."
    }
  ]
}
```

**After:**
```json
{
  "packages": [
    {
      "id": "uuid-abc",
      "namespace": "featured",
      "name": "midjourney",
      "display_name": "Midjourney Prompt Pack",  // ✅ NEW!
      "description": "..."
    }
  ]
}
```

#### Package Details Response (`GET /api/v1/packages/:namespace/:name`)

Also now includes `display_name` in the package object.

---

## Field Mapping

| Field | Source | Example | Purpose |
|-------|--------|---------|---------|
| `id` | Database UUID | `"550e8400-..."` | Database primary key |
| `namespace` | YAML `id` (before last dot) | `"featured"` | URL routing, permissions |
| `name` | YAML `id` (after last dot) | `"midjourney"` | URL routing, technical identifier |
| **`display_name`** | **YAML `metadata.name`** | **`"Midjourney Prompt Pack"`** | **Human-readable name for UI** |
| `description` | YAML `metadata.description` | `"Generate amazing..."` | Package description |

---

## Usage in Web App

### Display the Name

```typescript
// Fetch packages
const { packages } = await fetch('/api/v1/packages').then(r => r.json());

for (const pkg of packages) {
  // Use display_name for UI (human-readable)
  const displayName = pkg.display_name || `${pkg.namespace}.${pkg.name}`;
  
  // Use namespace.name for technical operations
  const packageId = `${pkg.namespace}.${pkg.name}`;
  
  console.log(`Display: "${displayName}"`);
  console.log(`Technical ID: "${packageId}"`);
}
```

**Example output:**
```
Display: "Midjourney Prompt Pack"
Technical ID: "featured.midjourney"
```

### Fallback for Missing Display Name

Some existing packages might not have `display_name` set (if published before this migration). Use a fallback:

```typescript
const displayName = pkg.display_name || `${pkg.namespace}.${pkg.name}`;
// OR
const displayName = pkg.display_name || pkg.name;
```

---

## Complete API Response Structure

### GET /api/v1/packages (List)

```json
{
  "packages": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "namespace": "featured",
      "name": "midjourney",
      "display_name": "Midjourney Prompt Pack",
      "description": "Generate amazing Midjourney prompts",
      "author_persona_id": "uuid-persona",
      "author_persona": {
        "id": "uuid-persona",
        "name": "John Doe",
        "avatar_url": null,
        "bio": "Creator of awesome prompts",
        "website": "https://example.com"
      },
      "version_count": 5,
      "latest_version": "2.1.0",
      "content_counts": {
        "rulebooks": 3,
        "rules": 15,
        "prompt_sections": 8,
        "datatypes": 5
      },
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "page": {
    "limit": 50,
    "offset": 0
  }
}
```

### GET /api/v1/packages/:namespace/:name (Details)

```json
{
  "package": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "namespace": "featured",
    "name": "midjourney",
    "display_name": "Midjourney Prompt Pack",
    "description": "Generate amazing Midjourney prompts",
    "author_persona_id": "uuid-persona",
    "author_persona": {
      "id": "uuid-persona",
      "name": "John Doe",
      "public_key": "ed25519:...",
      "bio": "Creator of awesome prompts",
      "avatar_url": null,
      "website": "https://example.com",
      "created_at": "2024-12-01T00:00:00Z"
    },
    "protection_level": "public",
    "latest_version": "2.1.0",
    "versions": [
      {
        "id": "version-uuid",
        "package_id": "package-uuid",
        "version": "2.1.0",
        "description": "Latest improvements",
        "signature": "...",
        "file_size_bytes": 15234,
        "checksum_sha256": "abc123...",
        "storage_path": "packages/featured/midjourney/2.1.0.yaml",
        "published_at": "2025-01-15T10:30:00Z",
        "yanked_at": null,
        "yank_reason": null,
        "dependencies": [
          {
            "package": "other.namespace.dependency",
            "version": "^1.0.0",
            "resolved_version": "1.2.3"
          }
        ]
      }
    ],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  },
  "stats": {
    "total_downloads": 250,
    "downloads_last_30_days": 80,
    "version_count": 5
  }
}
```

---

## What Information Can You Get?

### From Package List (GET /api/v1/packages)

Each package includes:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | UUID | Database primary key | `"550e8400-..."` |
| `namespace` | string | Namespace part of ID | `"featured"` |
| `name` | string | Name part of ID | `"midjourney"` |
| **`display_name`** | **string\|null** | **Human-readable name** | **`"Midjourney Prompt Pack"`** |
| `description` | string\|null | Short description | `"Generate..."` |
| `author_persona_id` | UUID | Author's persona UUID | `"uuid-..."` |
| `author_persona` | object | Author public info | See below |
| `version_count` | number | Total versions | `5` |
| `latest_version` | string\|null | Latest version number | `"2.1.0"` |
| `content_counts` | object | Content summary | See below |
| `created_at` | timestamp | When created | `"2025-01-01..."` |
| `updated_at` | timestamp | Last updated | `"2025-01-15..."` |

**Author persona:**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "avatar_url": "https://...",
  "bio": "Creator...",
  "website": "https://..."
}
```

**Content counts:**
```json
{
  "rulebooks": 3,
  "rules": 15,
  "prompt_sections": 8,
  "datatypes": 5
}
```

### From Package Details (GET /api/v1/packages/:namespace/:name)

Includes everything from the list, plus:

| Additional Field | Type | Description |
|-----------------|------|-------------|
| `protection_level` | string | `"public"`, `"protected"`, or `"private"` |
| `versions[]` | array | Full version history with details |
| `stats` | object | Download statistics |

**Each version includes:**
- `id`, `version`, `description`
- `signature`, `checksum_sha256`, `file_size_bytes`
- `storage_path`
- `published_at`, `yanked_at`, `yank_reason`
- `dependencies[]` array with resolved versions

**Stats object:**
```json
{
  "total_downloads": 250,
  "downloads_last_30_days": 80,
  "version_count": 5
}
```

---

## Migration Guide

### Run the Migration

```bash
# Local development
npm run migrate:up

# Railway (automatic on deploy, or manually via CLI)
railway run npm run migrate:up
```

### For Existing Packages

The migration sets `display_name = namespace.name` for existing packages as a fallback. These will be updated with the real display name when the package is re-published.

**Backfill script (if needed):**
```sql
-- Update display_name from latest version's YAML for existing packages
-- (You'd need to parse yaml_content and extract metadata.name)
-- This is optional - packages will get updated on next publish
```

---

## Publishing Behavior

When you publish a package:

1. **New package:** `display_name` is set from `metadata.name`
2. **Existing package:** `display_name` is updated if it changed
3. **Missing `metadata.name`:** `display_name` is set to `null`

```typescript
// In publish endpoint:
if (parsed.metadata?.name && parsed.metadata.name !== pkg.display_name) {
  await packageService.updatePackageDisplayName(pkg.id, parsed.metadata.name);
}
```

---

## Example: Full Web App Integration

```typescript
// Component: PackageList.vue
async function loadPackages() {
  const response = await fetch('/api/v1/packages');
  const { packages } = await response.json();
  
  return packages.map(pkg => ({
    // For display in UI
    displayName: pkg.display_name || pkg.name,
    
    // For technical operations
    packageId: `${pkg.namespace}.${pkg.name}`,
    namespace: pkg.namespace,
    name: pkg.name,
    
    // For building URLs
    detailsUrl: `/packages/${pkg.namespace}/${pkg.name}`,
    downloadUrl: `/api/v1/packages/${pkg.namespace}/${pkg.name}/${pkg.latest_version}/download`,
    
    // Other useful info
    description: pkg.description,
    authorName: pkg.author_persona.name,
    latestVersion: pkg.latest_version,
    totalDownloads: pkg.content_counts.rules + pkg.content_counts.rulebooks,
    
    // For checking if installed
    isInstalled: myLibrary.hasPackage(`${pkg.namespace}.${pkg.name}`)
  }));
}

// Component template
<template>
  <div v-for="pkg in packages" :key="pkg.packageId">
    <h3>{{ pkg.displayName }}</h3>
    <p>{{ pkg.description }}</p>
    <small>by {{ pkg.authorName }}</small>
    <span v-if="pkg.isInstalled">✅ Installed</span>
    <button @click="download(pkg)">Download v{{ pkg.latestVersion }}</button>
  </div>
</template>
```

---

## Summary

### What's Available Now

✅ **Display name** in package list and details
✅ **Namespace** and **name** for URL routing
✅ **Package UUID** for database operations
✅ **Author info** (name, avatar, bio, website)
✅ **Version info** (count, latest version)
✅ **Content counts** (rulebooks, rules, etc.)
✅ **Statistics** (downloads)
✅ **Full version history** with dependencies

### Key Fields for Web App

| Use Case | Field(s) to Use |
|----------|----------------|
| **Display in UI** | `display_name` (fallback: `name`) |
| **Technical ID** | `${namespace}.${name}` |
| **API URLs** | `namespace`, `name`, `latest_version` |
| **Database ops** | `id` (UUID) |
| **Check if installed** | Match `${namespace}.${name}` against library |
| **Show author** | `author_persona.name` |
| **Show stats** | `content_counts`, `version_count` |

### Migration Status

✅ **Migration created:** `20251228155656484_add-display-name-to-packages.js`
✅ **TypeScript interfaces updated**
✅ **Publish endpoint updated** to store display_name
✅ **Build passes**
✅ **Ready to deploy**

Run `npm run migrate:up` to apply!


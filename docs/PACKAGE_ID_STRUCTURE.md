# Package ID Structure and API Endpoints

## Package Identification

### Package ID Format

Every package has an **ID** field in format: `namespace.name`

**Examples:**
- `featured.midjourney` → namespace: `featured`, name: `midjourney`
- `my-org.my-package` → namespace: `my-org`, name: `my-package`
- `multi.level.namespace.pkg` → namespace: `multi.level.namespace`, name: `pkg`

### Parsing Rules

The package ID is split as follows:
- **Name** = Last part after the final dot
- **Namespace** = Everything before the last dot

```typescript
// From parsePackageId():
const parts = id.split('.');
const name = parts[parts.length - 1];           // Last part
const namespace = parts.slice(0, -1).join('.'); // Everything else joined with dots
```

**Examples:**
```
ID: "featured.midjourney"
→ namespace: "featured"
→ name: "midjourney"

ID: "my.company.awesome.pkg"
→ namespace: "my.company.awesome"
→ name: "pkg"
```

---

## Database Structure

Packages are stored with **separate namespace and name fields**:

```typescript
interface Package {
  id: string;              // UUID (database primary key)
  namespace: string;       // e.g., "featured"
  name: string;            // e.g., "midjourney"
  description: string | null;
  author_persona_id: string;
  created_at: Date;
  updated_at: Date;
}
```

---

## API Endpoints

### 1. List Packages

**`GET /api/v1/packages`**

Returns array of packages with namespace and name separate:

```json
{
  "packages": [
    {
      "id": "uuid-here",
      "namespace": "featured",
      "name": "midjourney",
      "description": "...",
      "author_persona_id": "...",
      "author_persona": {
        "id": "...",
        "name": "Author Name",
        "avatar_url": null,
        "bio": null,
        "website": null
      },
      "version_count": 3,
      "latest_version": "1.2.0",
      "content_counts": {
        "rulebooks": 5,
        "rules": 20,
        "prompt_sections": 10,
        "datatypes": 8
      },
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-02T00:00:00Z"
    }
  ],
  "total": 42,
  "page": {
    "limit": 50,
    "offset": 0
  }
}
```

### 2. Get Package Details

**`GET /api/v1/packages/:namespace/:name`**

Example: `GET /api/v1/packages/featured/midjourney`

Returns package with all versions:

```json
{
  "package": {
    "id": "uuid",
    "namespace": "featured",
    "name": "midjourney",
    "description": "...",
    "author_persona_id": "...",
    "author_persona": {
      "id": "...",
      "name": "Author Name",
      // ... full persona info
    },
    "protection_level": "public",
    "latest_version": "1.2.0",
    "versions": [
      {
        "id": "version-uuid",
        "package_id": "package-uuid",
        "version": "1.2.0",
        "description": "Latest release",
        "signature": "...",
        "file_size_bytes": 12345,
        "checksum_sha256": "...",
        "storage_path": "...",
        "published_at": "2025-01-02T00:00:00Z",
        "yanked_at": null,
        "yank_reason": null,
        "dependencies": [
          {
            "package": "other.namespace.dependency",
            "version": "^1.0.0",
            "resolved_version": "1.0.5"
          }
        ]
      }
    ],
    "created_at": "...",
    "updated_at": "..."
  },
  "stats": {
    "total_downloads": 150,
    "downloads_last_30_days": 45,
    "version_count": 3
  }
}
```

### 3. Get Specific Version

**`GET /api/v1/packages/:namespace/:name/:version`**

Example: `GET /api/v1/packages/featured/midjourney/1.2.0`

Returns specific version details (without YAML content):

```json
{
  "version": {
    "id": "version-uuid",
    "package_id": "package-uuid",
    "version": "1.2.0",
    "description": "...",
    "signature": "...",
    "file_size_bytes": 12345,
    "checksum_sha256": "...",
    "storage_path": "...",
    "published_at": "...",
    "yanked_at": null,
    "yank_reason": null
  },
  "dependencies": [
    {
      "id": "dep-uuid",
      "package_version_id": "version-uuid",
      "depends_on_namespace": "other",
      "depends_on_name": "dependency",
      "version_constraint": "^1.0.0",
      "resolved_version": "1.0.5",
      "created_at": "..."
    }
  ]
}
```

### 4. Download Package YAML

**`GET /api/v1/packages/:namespace/:name/:version/download`**

Example: `GET /api/v1/packages/featured/midjourney/1.2.0/download`

Returns the actual YAML file content:

```yaml
id: featured.midjourney
version: 1.2.0
metadata:
  name: "Midjourney Prompt Pack"
  description: "..."
  authors:
    - name: "Author"
      email: "author@example.com"
# ... full YAML content
```

**Response headers:**
- `Content-Type: application/x-yaml`
- `Content-Disposition: attachment; filename="midjourney-1.2.0.yaml"`
- `X-Checksum-SHA256: <sha256-hash>`

---

## Common Mistakes in Web Apps

### ❌ Wrong: Expecting a single "id" field

```typescript
// DON'T do this:
const downloadUrl = `/api/v1/packages/${package.id}/download`;
```

### ✅ Right: Use namespace and name separately

```typescript
// DO this:
const downloadUrl = `/api/v1/packages/${package.namespace}/${package.name}/${version}/download`;
```

### ❌ Wrong: Treating package.id as the package identifier

```typescript
// DON'T do this:
const packageId = package.id; // This is a UUID!
```

### ✅ Right: Construct package ID from namespace + name

```typescript
// DO this:
const packageId = `${package.namespace}.${package.name}`;
```

---

## Web App Integration Guide

### When Listing Packages

From `GET /api/v1/packages`, each item has:

```typescript
interface PackageListItem {
  id: string;              // ⚠️ This is UUID, NOT the package ID!
  namespace: string;       // ✅ Use this for API calls
  name: string;            // ✅ Use this for API calls
  latest_version: string;  // ✅ Use this for download URL
  // ... other fields
}
```

### Building Download URL

```typescript
// Given a package from the list:
const pkg = packages[0];

// Construct download URL for latest version:
const downloadUrl = `/api/v1/packages/${pkg.namespace}/${pkg.name}/${pkg.latest_version}/download`;
// Example: /api/v1/packages/featured/midjourney/1.2.0/download

// Get package details:
const detailsUrl = `/api/v1/packages/${pkg.namespace}/${pkg.name}`;
// Example: /api/v1/packages/featured/midjourney
```

### Checking if Package Already Installed

When you have a package installed in your library, you need to match it against marketplace packages:

```typescript
// Library package has ID like: "featured.midjourney"
const libraryPackageId = "featured.midjourney";

// Parse it to get namespace and name:
function parsePackageId(id: string) {
  const parts = id.split('.');
  const name = parts[parts.length - 1];
  const namespace = parts.slice(0, -1).join('.');
  return { namespace, name };
}

const { namespace, name } = parsePackageId(libraryPackageId);

// Now check marketplace packages:
const marketplacePackages = await fetch('/api/v1/packages').then(r => r.json());

const alreadyInstalled = marketplacePackages.packages.some(pkg =>
  pkg.namespace === namespace && pkg.name === name
);
```

### Complete Example

```typescript
// Fetch marketplace packages
const response = await fetch('/api/v1/packages');
const data = await response.json();

for (const pkg of data.packages) {
  console.log('Package ID (for library):', `${pkg.namespace}.${pkg.name}`);
  console.log('Database UUID:', pkg.id);
  console.log('Namespace:', pkg.namespace);
  console.log('Name:', pkg.name);
  console.log('Latest version:', pkg.latest_version);
  
  // Download URL:
  const downloadUrl = `/api/v1/packages/${pkg.namespace}/${pkg.name}/${pkg.latest_version}/download`;
  
  // Details URL:
  const detailsUrl = `/api/v1/packages/${pkg.namespace}/${pkg.name}`;
  
  // Check if already in library:
  const libraryPackageId = `${pkg.namespace}.${pkg.name}`;
  const isInstalled = myLibrary.hasPackage(libraryPackageId);
}
```

---

## Summary

### Key Points

1. **Package ID in YAML:** `namespace.name` (e.g., `featured.midjourney`)
2. **Database storage:** Separate `namespace` and `name` columns
3. **API endpoints:** Use `:namespace/:name` in URL paths
4. **Database `id` field:** This is a **UUID**, NOT the package identifier
5. **Namespace can have dots:** Last part is name, everything else is namespace

### Field Mapping

| Context | Field Name | Example Value | Purpose |
|---------|-----------|---------------|---------|
| YAML `id` | `id` | `"featured.midjourney"` | Package identifier |
| Database | `id` | `"uuid-1234..."` | Primary key |
| Database | `namespace` | `"featured"` | Namespace part |
| Database | `name` | `"midjourney"` | Name part |
| API URL | `:namespace/:name` | `/packages/featured/midjourney` | Routing |
| Library | Package ID | `"featured.midjourney"` | Matching installed packages |

### For Web App Developers

When integrating with the marketplace API:

1. ✅ Use `package.namespace` and `package.name` for API calls
2. ✅ Construct package ID as `${namespace}.${name}` for library matching
3. ✅ Build URLs with both namespace and name: `/:namespace/:name/:version`
4. ❌ DON'T use `package.id` (UUID) as the package identifier
5. ❌ DON'T expect a single URL segment for package identification

### Example URLs

```
List all packages:
GET /api/v1/packages

Get package details:
GET /api/v1/packages/featured/midjourney

Get specific version:
GET /api/v1/packages/featured/midjourney/1.2.0

Download package:
GET /api/v1/packages/featured/midjourney/1.2.0/download
```


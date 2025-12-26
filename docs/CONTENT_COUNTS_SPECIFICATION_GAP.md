# Content Counts - Architecture & Specification Review

**Date:** 2025-12-26  
**Status:** 🔴 SPECIFICATION GAP IDENTIFIED

---

## Your Key Insights

You've identified critical questions that need answering:

1. **What counts do we show?**
   - Local only (entities in this package)
   - Inherited (entities from dependencies too)

2. **Does dependency resolution affect counts?**
   - Published packages lock dependencies
   - If dependencies change, inherited counts change
   - Do we recompute or use "locked" counts?

3. **What's the source of truth?**
   - `yaml_content` is the actual package
   - `locked_manifest` is for performance/caching
   - But what does it represent?

---

## Database Architecture (Current)

### Tables

```
packages
├── package_versions
│   ├── yaml_content (TEXT) - Source of truth
│   ├── locked_manifest (JSONB) - Performance cache
│   └── package_dependencies - Resolved dependencies
└── download_stats
```

### Fields Purpose

| Field | Purpose | Content |
|-------|---------|---------|
| `yaml_content` | **Source of truth** | Full package YAML |
| `locked_manifest` | **Performance cache** | Originally: dependency lock<br/>Current use: ??? |
| `package_dependencies` | **Resolved deps** | Exact dependency versions |

---

## The Core Question: Local vs Inherited Counts

### Option 1: Local Counts Only ✅ (Simpler)

**What we count:**
- Only entities defined **in this package**
- Ignore dependencies completely

**Example:**
```yaml
# my-package v1.0.0
namespaces:
  myapp:
    rulebooks: { main: {...} }      # Count: 1 rulebook
    rules: { rule1: {...} }          # Count: 1 rule
dependencies:
  - package: core.base              # Has 10 rulebooks, 50 rules
    version: ^2.0.0                 # DON'T count these
```

**Result:** `content_counts: { rulebooks: 1, rules: 1, ... }`

**Pros:**
- ✅ Simple - no dependency traversal
- ✅ Stable - never changes even if dependencies update
- ✅ Fast - just parse this package
- ✅ Honest - "what's in this package"

**Cons:**
- ⚠️ Doesn't show total available entities
- ⚠️ User might want "total capabilities"

---

### Option 2: Inherited Counts (Complex)

**What we count:**
- Entities in this package
- **Plus** entities from all dependencies (recursive)

**Example:**
```yaml
# my-package v1.0.0
namespaces:
  myapp:
    rulebooks: { main: {...} }      # Count: 1 rulebook
    rules: { rule1: {...} }          # Count: 1 rule
dependencies:
  - package: core.base              # Has 10 rulebooks, 50 rules
    version: ^2.0.0                 # Add these!
  - package: utils.helpers          # Has 2 rulebooks, 5 rules
    version: ^1.0.0                 # Add these too!
```

**Result:** `content_counts: { rulebooks: 13, rules: 56, ... }` (1+10+2, 1+50+5)

**Pros:**
- ✅ Shows total capabilities available
- ✅ More informative for users

**Cons:**
- ❌ Complex - recursive dependency resolution
- ❌ Expensive - must traverse entire dep tree
- ❌ **Unstable** - counts change when dependencies update
- ❌ Caching problem - when to recompute?

#### Stability Problem

**Published package** with locked dependencies:
```json
{
  "package": "my-package@1.0.0",
  "dependencies": [
    { "package": "core.base", "version": "2.1.0" }  // Locked to exact version
  ]
}
```

**Counts would be stable** because dependencies are locked.

**But:** If `core.base@2.1.0` gets yanked or updated, do we:
- Keep old counts? (stale)
- Recompute? (when? performance cost?)
- Show warning? (confusing)

---

## Recommended Specification

### 🎯 Recommendation: Local Counts Only

**Rationale:**

1. **Simplicity** - Easy to compute and understand
2. **Stability** - Never changes once published
3. **Performance** - No dependency traversal needed
4. **Clarity** - "What's in this package, not what it uses"
5. **Consistency** - Matches how npm/cargo show package size (not including deps)

**Implementation:**
- Count entities defined in `package.namespaces` only
- Ignore `package.dependencies` completely
- Store in `locked_manifest` at publish time
- Never needs recomputation

### API Response (Recommended)

```json
{
  "id": "my-package",
  "version": "1.0.0",
  "content_counts": {
    "rulebooks": 3,          // Defined in this package
    "rules": 15,             // Defined in this package
    "prompt_sections": 8,    // Defined in this package
    "datatypes": 12          // Defined in this package
  },
  "dependencies": [
    {
      "package": "core.base",
      "version": "^2.0.0"
      // If users want dep counts, they can fetch separately
    }
  ]
}
```

**Optional Enhancement (Future):**
If users want inherited counts, add a separate field:
```json
{
  "content_counts": { ... },              // Local only
  "total_content_counts": { ... }         // Including dependencies (computed on-demand)
}
```

---

## Proper Implementation Strategy

### Current Issues with My Implementation

1. ❌ **Storing full package in `locked_manifest`** - Confuses purposes
2. ❌ **Unclear specification** - Local vs inherited not defined
3. ❌ **No migration plan** - Legacy data unclear

### Recommended Implementation

#### Option A: Add Dedicated Count Fields (Best)

**Schema Change:**
```javascript
pgm.addColumns('package_versions', {
  local_rulebooks_count: { type: 'integer', default: 0 },
  local_rules_count: { type: 'integer', default: 0 },
  local_prompt_sections_count: { type: 'integer', default: 0 },
  local_datatypes_count: { type: 'integer', default: 0 }
});
```

**Pros:**
- ✅ Explicit and clear purpose
- ✅ Fast queries (direct column access)
- ✅ Indexable for sorting/filtering
- ✅ No confusion about `locked_manifest` purpose

**Cons:**
- ⚠️ Requires migration
- ⚠️ Schema change

**Compute at publish:**
```typescript
const parsed = packageValidator.parseYAML(yaml_content);
const counts = computeLocalCounts(parsed); // Parse namespaces
// Store counts in dedicated columns
```

---

#### Option B: Structured Object in JSONB (Alternative)

**Schema Change:**
```javascript
pgm.addColumn('package_versions', 'content_metadata', {
  type: 'jsonb',
  default: '{}'
});
```

**Store:**
```json
{
  "local_counts": {
    "rulebooks": 3,
    "rules": 15,
    "prompt_sections": 8,
    "datatypes": 12
  },
  "computed_at": "2025-12-26T...",
  "schema_version": 1
}
```

**Pros:**
- ✅ Flexible - can add fields without migrations
- ✅ Single column for all metadata
- ✅ Can version the schema

**Cons:**
- ⚠️ Harder to query/index individual counts
- ⚠️ Still requires migration

---

#### Option C: Keep Locked Manifest (Current)

**Keep storing full parsed package in `locked_manifest`**

**Pros:**
- ✅ No migration needed
- ✅ Can compute any stat from it

**Cons:**
- ⚠️ Large JSON blob
- ⚠️ Confusing field name
- ⚠️ Mixes caching with locking

**If we do this:**
- Rename field to `package_snapshot` in next major version
- Document clearly what it contains
- Accept that legacy data shows zeros

---

## Migration Strategy for Legacy Data

### Problem
Existing packages have minimal `locked_manifest`:
```json
{
  "package": "featured.base",
  "version": "1.0.0",
  "dependencies": []
}
```

### Solutions

#### 1. Parse yaml_content (Recommended)

**Migration Script:**
```javascript
exports.up = async (pgm) => {
  // For each package_version without proper locked_manifest
  const versions = await pgm.db.select(
    'SELECT id, yaml_content FROM package_versions WHERE ...'
  );
  
  for (const version of versions) {
    const parsed = parseYAML(version.yaml_content);
    const counts = computeLocalCounts(parsed);
    
    await pgm.db.query(
      'UPDATE package_versions SET locked_manifest = $1 WHERE id = $2',
      [JSON.stringify(parsed), version.id]
    );
  }
};
```

**Pros:**
- ✅ Fixes all legacy data
- ✅ One-time operation

**Cons:**
- ⚠️ Slow for large datasets
- ⚠️ Risk if YAML parsing fails

#### 2. Lazy Migration (Alternative)

**On package list request:**
```typescript
if (!manifest.namespaces) {
  // Legacy data - parse yaml_content
  const parsed = parseYAML(version.yaml_content);
  const counts = computeLocalCounts(parsed);
  
  // Update cache
  await updateLockedManifest(version.id, parsed);
  
  return counts;
}
```

**Pros:**
- ✅ Self-healing
- ✅ No big migration

**Cons:**
- ⚠️ Slow first request
- ⚠️ Complex logic

---

## Specification Decisions Needed

### Decision 1: Local or Inherited Counts?

**Recommendation:** ✅ **Local counts only**

**Reason:** Simpler, stable, matches industry standards

### Decision 2: Where to Store?

**Recommendation:** ✅ **Dedicated columns** (best) or **Keep locked_manifest** (pragmatic)

**Reason:** Depends on migration tolerance

### Decision 3: Legacy Data?

**Recommendation:** ✅ **Parse yaml_content in migration** or **Show zeros**

**Reason:** Zeros are honest, migration is thorough

### Decision 4: Field Naming?

**Recommendation:** ✅ **Rename locked_manifest → package_snapshot** (future)

**Reason:** Clarifies purpose, avoids confusion

---

## Recommended Action Plan

### Phase 1: Specification (NOW)

1. ✅ **Decide:** Local counts only
2. ✅ **Document:** What counts represent
3. ✅ **Define:** Storage approach

### Phase 2: Implementation (NEXT)

**Option A: Proper (with migration)**
1. Add dedicated count columns
2. Migrate legacy data (parse yaml_content)
3. Update list endpoint to return counts
4. Keep `locked_manifest` for its original purpose

**Option B: Pragmatic (current approach)**
1. Keep storing full package in `locked_manifest`
2. Parse yaml_content for legacy data (one-time)
3. Document the dual-purpose usage
4. Plan field rename for v2.0

### Phase 3: Enhancement (FUTURE)

1. Consider adding inherited counts (optional)
2. Add `total_content_counts` field
3. Compute on-demand or cache separately

---

## Summary

**You're right to question the approach!** We need to:

1. ✅ **Clarify specification** - Local vs inherited counts
2. ✅ **Fix architecture** - Don't confuse locking with caching
3. ✅ **Plan migration** - Handle legacy data properly

**My recommendation:**
- Show **local counts only** (entities in this package)
- Store in **dedicated columns** (or keep locked_manifest if migration is too costly)
- **Parse yaml_content** for legacy data (one-time migration)
- **Document clearly** what counts represent

**The current implementation works but needs:**
- Clear specification of what we're counting
- Proper migration for legacy data
- Better field naming (future)

What's your preference on the specification? Local counts only, or should we compute inherited counts too?


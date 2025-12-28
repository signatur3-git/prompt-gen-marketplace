# Force Re-upload & Package Version Management

## New Features

### 1. Force Re-upload Existing Versions

When publishing a package, if the version already exists, you now have the option to **replace it** instead of getting an error.

#### How It Works

**Frontend (Automatic):**
1. Upload your package via the Publish page
2. If the version already exists, you'll get a confirmation dialog:
   ```
   Version X.Y.Z already exists
   
   Do you want to replace the existing version? 
   This will delete the old version and upload the new one.
   ```
3. Click **OK** to replace, or **Cancel** to abort

**API (Manual):**

```bash
POST /api/v1/packages
Content-Type: application/json
Authorization: Bearer <token>

{
  "yaml_content": "...",
  "persona_id": "...",
  "force": true
}
```

#### What Happens When You Force Re-upload

✅ **Old version is deleted** from database
✅ **Old file is deleted** from storage (S3/MinIO)
✅ **New version is uploaded** with same version number
✅ **Dependencies are recalculated** from new content
✅ **Download stats are preserved** (if any)

⚠️ **Warning:** Anyone who has already downloaded the old version will have different content than those who download after the re-upload. Use this carefully!

---

### 2. Admin Delete Package Versions

Admins can now delete individual package versions via API.

#### Admin Endpoint

```bash
DELETE /api/v1/admin/packages/:namespace/:name/:version
Authorization: Bearer <admin-token>
```

**Example:**
```bash
curl -X DELETE \
  https://your-marketplace.com/api/v1/admin/packages/my-namespace/my-package/1.0.0 \
  -H "Authorization: Bearer <admin-token>"
```

**Response:**
```json
{
  "message": "Package version deleted successfully",
  "deleted": {
    "namespace": "my-namespace",
    "name": "my-package",
    "version": "1.0.0"
  }
}
```

#### What Gets Deleted

✅ **Version record** from database
✅ **Package file** from storage
✅ **Dependencies** (cascade delete)
✅ **Download stats** (cascade delete)

❌ **Does NOT delete:**
- The package itself (only the version)
- Other versions of the same package
- The namespace

---

## Use Cases

### Force Re-upload

**Good for:**
- ✅ Fixing bugs in a published package
- ✅ Updating documentation/metadata
- ✅ Testing during development
- ✅ Correcting upload mistakes

**Bad for:**
- ❌ Production packages (creates inconsistency)
- ❌ Packages with many downloads (users will have mismatched content)

**Best practice:** Increment the version number instead of force re-uploading in production.

### Admin Delete

**Good for:**
- ✅ Removing accidentally published versions
- ✅ Deleting test/broken uploads
- ✅ Cleaning up malicious/inappropriate content
- ✅ DMCA takedowns

**Bad for:**
- ❌ Regular version management (use yank instead)
- ❌ Bulk deletion (do carefully, one at a time)

---

## Migration from "No Metadata" State

If you have packages where:
- ✅ Metadata exists in database
- ❌ Files are missing from storage

### Solution 1: Force Re-upload (Easiest)

1. Go to Publish page
2. Upload your YAML file
3. When prompted about existing version, click **OK** to replace
4. Done! Metadata is updated and file is uploaded

### Solution 2: Admin Delete + Re-publish

1. Admin deletes the broken version:
   ```bash
   DELETE /api/v1/admin/packages/namespace/name/version
   ```
2. Regular user publishes the package again normally
3. Everything is fresh and clean

### Solution 3: Manual Database + Storage Fix

If you have many packages to fix, you could write a script to:
1. List all versions with missing files
2. Either delete them or re-upload from backup
3. Use the API endpoints above in a loop

---

## Technical Details

### Database Changes

**New function in `package.service.ts`:**
```typescript
export async function deletePackageVersion(packageVersionId: string): Promise<void>
```

This deletes:
- `package_versions` row (CASCADE deletes `package_dependencies`)
- `download_stats` (CASCADE)

### Storage Changes

**Uses existing function:**
```typescript
storageService.deletePackage(storagePath)
```

Works with both:
- S3/MinIO (DELETE object)
- Local filesystem (`fs.unlink`)

### API Changes

**POST /api/v1/packages** - New parameter:
- `force: boolean` (optional, default: false)

**DELETE /api/v1/admin/packages/:namespace/:name/:version** - New endpoint
- Requires admin authentication
- Returns confirmation JSON

---

## Testing

### Test Force Re-upload

```bash
# 1. Publish a package
POST /api/v1/packages
{
  "yaml_content": "...",
  "persona_id": "..."
}
# Response: 201 Created

# 2. Try to publish same version again
POST /api/v1/packages
{
  "yaml_content": "...",
  "persona_id": "..."
}
# Response: 409 Conflict

# 3. Force re-upload
POST /api/v1/packages
{
  "yaml_content": "... (different content)",
  "persona_id": "...",
  "force": true
}
# Response: 201 Created (replaces old version)
```

### Test Admin Delete

```bash
# 1. Publish a test package
POST /api/v1/packages
{
  "yaml_content": "...",
  "persona_id": "..."
}

# 2. Delete it as admin
DELETE /api/v1/admin/packages/test-namespace/test-package/1.0.0
Authorization: Bearer <admin-token>
# Response: 200 OK

# 3. Verify it's gone
GET /api/v1/packages/test-namespace/test-package/1.0.0
# Response: 404 Not Found
```

---

## Frontend Changes

### PublishPage.vue

**Before:**
```typescript
// Just uploaded, no force option
```

**After:**
```typescript
// Detects 409 conflict
// Shows confirmation dialog
// Retries with force=true if user confirms
```

**User Experience:**
1. Upload YAML file
2. Click "Publish"
3. If version exists: Dialog appears
4. User chooses: Replace or Cancel
5. If replace: Upload happens automatically

No need to manually set force parameter!

---

## Security Considerations

### Force Re-upload

✅ **Requires authentication** (same as regular publish)
✅ **Checks ownership** (must own the package)
✅ **Namespace permissions** (must be able to publish to namespace)

❌ **Not restricted to admins** (any package owner can force re-upload their own packages)

### Admin Delete

✅ **Requires admin role** (`is_admin = true`)
✅ **Prevents self-harm** (admins can't delete their own account, but can delete any package)
✅ **Cascade deletes** (related data is cleaned up automatically)

⚠️ **No undo** (deletion is permanent, make backups!)

---

## Best Practices

### For Developers

1. **Prefer version bumps** over force re-uploads in production
2. **Use semantic versioning** (1.0.0 → 1.0.1 for fixes, not force replace)
3. **Test locally first** before publishing to production
4. **Force re-upload is for mistakes**, not regular updates

### For Admins

1. **Backup before deleting** (export package YAML first if valuable)
2. **Communicate with users** before deleting popular packages
3. **Consider yanking instead** of deleting (keeps version, marks as unavailable)
4. **Use delete for** malicious/broken/test content only

### For Package Consumers

1. **Pin versions in dependencies** (e.g., `"^1.0.0"` not `"latest"`)
2. **Verify checksums** when downloading (marketplace provides SHA256)
3. **Be aware force re-uploads can happen** (rare, but possible)

---

## Troubleshooting

### Force Re-upload Not Working

**Problem:** Still getting "Version already exists" error

**Solution:**
- Check you clicked "OK" in the confirmation dialog
- Check you own the package (correct persona)
- Check browser console for errors
- Try the API directly with `force: true`

### Admin Delete Fails

**Problem:** "User not authenticated" or "Permission denied"

**Solution:**
- Verify you're logged in as admin (`is_admin = true`)
- Check your JWT token is valid (not expired)
- Make sure you're using the admin endpoint URL

### File Not Deleted from Storage

**Problem:** Database record deleted but file still in S3/MinIO

**Solution:**
- Check storage service logs for errors
- Verify S3/MinIO credentials are correct
- Files are cleaned up on "best effort" basis (logged warning if fails)
- Manually delete orphaned files if needed

---

## Summary

✅ **Force re-upload** allows fixing mistakes without version bumps
✅ **Admin delete** enables content moderation and cleanup
✅ **Frontend auto-prompts** makes force re-upload user-friendly
✅ **Cascade deletes** keep database clean
✅ **Storage cleanup** removes orphaned files

Use responsibly! 🚀


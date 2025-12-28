# MinIO on Railway - Quick Setup Guide

## Step-by-Step Deployment

### 1. Create MinIO Service

1. **Open your Railway project**
2. **Click "New Service"**
3. **Select "Docker Image"**

### 2. Configure Docker Image

**Image:** `minio/minio:latest`

### 3. Set Start Command

**Go to:** Settings → Deploy → Custom Start Command

**Command:**
```
minio server /data --console-address ":9001"
```

⚠️ **Critical:** Must use `minio server` (not just `server`)

### 4. Add Environment Variables

**Go to:** Variables tab

**Add these variables:**
```
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your-secure-password-here
```

💡 **Tip:** Use a password with at least 8 characters for production

### 5. Add Persistent Volume

**Go to:** Settings → Volumes → Add Volume

**Configuration:**
- **Mount Path:** `/data`

⚠️ **This is critical!** Without a volume, your files will be lost on redeploy.

### 6. Deploy

Click **Deploy** and wait for service to be ready.

Railway will give you a public URL like: `https://minio-production-xxxxx.up.railway.app`

### 7. Create the Bucket

#### Option A: Using mc client (recommended)

```bash
# Download MinIO client
# Windows: https://dl.min.io/client/mc/release/windows-amd64/mc.exe
# Mac: brew install minio/stable/mc
# Linux: wget https://dl.min.io/client/mc/release/linux-amd64/mc

# Configure Railway MinIO
mc alias set railway https://your-minio-url.railway.app minioadmin your-password

# Create bucket
mc mb railway/prompt-gen-packages

# Verify
mc ls railway
```

#### Option B: Let your app auto-create it

Your marketplace app has `initializeStorage()` that can create buckets automatically. Just deploy with the right env vars and it should work.

### 8. Configure Marketplace Service

**In your marketplace service, go to Variables and add:**

#### Option A: Internal Network (Recommended) ⚡

Railway services in the **same project** can communicate via private networking:

```
S3_ENDPOINT=http://minio.railway.internal:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=your-secure-password-here
S3_REGION=us-east-1
```

**Benefits:**
- ✅ **Faster** - no public internet hop
- ✅ **Free** - no egress bandwidth charges
- ✅ **Private** - traffic stays within Railway network
- ✅ Use `http://` (no SSL needed for internal)
- ✅ Port `9000` must be specified (MinIO API port)

**How to find the internal URL:**
1. Go to your MinIO service in Railway
2. Look for "Private Networking" section
3. Copy the `servicename.railway.internal` URL
4. Add `:9000` for MinIO API port

**Common internal URLs:**
- `http://minio.railway.internal:9000`
- `http://your-minio-service-name.railway.internal:9000`

#### Option B: Public URL (If different projects or external access)

```
S3_ENDPOINT=https://your-minio-url.railway.app
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=your-secure-password-here
S3_REGION=us-east-1
```

**When to use:**
- Services in different Railway projects
- External services accessing MinIO
- Development/testing from local machine

⚠️ **Make sure:**
- `S3_ACCESS_KEY` matches `MINIO_ROOT_USER`
- `S3_SECRET_KEY` matches `MINIO_ROOT_PASSWORD`
- **Internal:** Use `http://` and include `:9000` port
- **Public:** Use `https://` (Railway provides HTTPS, no port needed)

### 9. Redeploy Marketplace

After setting the env vars, redeploy your marketplace service. It should now use MinIO for storage.

---

## Verification

### Check MinIO is Running

In Railway dashboard, MinIO service should show:
- ✅ **Status:** Deployed (green)
- ✅ **Logs:** Should show "API" and "Console" endpoints

### Check Bucket Exists

```bash
mc ls railway
# Should show: prompt-gen-packages
```

### Test from Marketplace

1. Login to your marketplace
2. Go to "Publish" and upload a package
3. Check MinIO: `mc ls railway/prompt-gen-packages`
4. You should see your package file!
5. Try downloading the package - should work

---

## Common Issues & Fixes

### ❌ "Executable `server` could not be found"

**Problem:** Start command is wrong

**Fix:** Use `minio server /data --console-address ":9001"` (with `minio` prefix)

### ❌ "Access Denied" errors from marketplace

**Problem:** Credentials don't match

**Fix:** 
- Check `S3_ACCESS_KEY` in marketplace = `MINIO_ROOT_USER` in MinIO
- Check `S3_SECRET_KEY` in marketplace = `MINIO_ROOT_PASSWORD` in MinIO

### ❌ "Bucket does not exist" errors

**Problem:** Bucket not created

**Fix:** Create it using one of the methods in Step 7 above

### ❌ Files disappear after redeploy

**Problem:** No persistent volume

**Fix:** Add a volume mounted to `/data` in MinIO service settings

### ❌ Can't connect to MinIO from marketplace

**Problem:** Wrong endpoint URL or protocol

**Fix - If using internal URL (`railway.internal`):**
- ✅ Use `http://` (not `https://`)
- ✅ Include port `:9000`
- ✅ Example: `http://minio.railway.internal:9000`
- ✅ Both services must be in the **same Railway project**
- ❌ Won't work from your local dev machine (use public URL for local)

**Fix - If using public URL:**
- ✅ Use `https://` (Railway provides HTTPS automatically)
- ✅ Don't include port (Railway proxy handles it)
- ✅ Example: `https://minio-production.up.railway.app`
- ❌ Don't use `http://` (will fail)

**Both cases:**
- Verify `S3_ACCESS_KEY` matches `MINIO_ROOT_USER`
- Verify `S3_SECRET_KEY` matches `MINIO_ROOT_PASSWORD`
- Check MinIO service is running (green status in Railway)

---

## Alternative: Use Cloudflare R2 (Recommended)

Instead of hosting MinIO yourself, consider using **Cloudflare R2**:

### Why R2?

✅ **Managed service** - no maintenance
✅ **S3-compatible** - same code works
✅ **No egress fees** - unlike AWS S3
✅ **Free tier:** 10GB storage, 1M requests/month
✅ **Global CDN** - faster downloads

### Setup R2

1. **Create Cloudflare account** (if you don't have one)
2. **Go to R2 dashboard**
3. **Create a bucket:** `prompt-gen-packages`
4. **Generate API tokens** (under "Manage R2 API Tokens")
5. **In Railway marketplace service, add env vars:**

```
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<your-r2-access-key>
S3_SECRET_KEY=<your-r2-secret-key>
S3_REGION=auto
```

That's it! Your marketplace will use R2 instead of self-hosted MinIO.

---

## Cost Comparison

### MinIO on Railway
- **Volume storage:** ~$0.25/GB/month
- **Network egress:** Included in Railway pricing
- **You manage:** Updates, security, backups

### Cloudflare R2
- **Storage:** $0.015/GB/month
- **Network egress:** FREE (no egress fees!)
- **Cloudflare manages:** Everything

For most use cases, **R2 is cheaper and easier** than self-hosting MinIO.

---

## Summary

✅ Use `minio server /data` as start command (not just `server`)
✅ Add volume to `/data` for persistence
✅ Create bucket after deploying MinIO
✅ Set matching credentials in both services
✅ Consider using Cloudflare R2 for production instead

Need help? Check the full guide in [STORAGE_SOLUTION.md](STORAGE_SOLUTION.md)


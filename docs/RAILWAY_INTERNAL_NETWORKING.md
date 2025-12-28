# Railway Internal Networking for MinIO

## Quick Answer

**Yes, you should use internal networking!** Services in the same Railway project can communicate via private URLs like `servicename.railway.internal`.

## Configuration

### MinIO Service (No changes needed)

Deploy MinIO normally - Railway automatically enables internal networking.

### Marketplace Service

**Use this in your environment variables:**

```env
S3_ENDPOINT=http://minio.railway.internal:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=your-password
S3_REGION=us-east-1
```

## Key Differences: Internal vs Public

| Aspect | Internal (`.railway.internal`) | Public (`.railway.app`) |
|--------|-------------------------------|-------------------------|
| **URL Format** | `http://minio.railway.internal:9000` | `https://minio-prod.railway.app` |
| **Protocol** | `http://` (no SSL needed) | `https://` (SSL required) |
| **Port** | `:9000` must be specified | No port (proxy handles it) |
| **Speed** | ⚡ Fast (private network) | 🌐 Slower (public internet) |
| **Cost** | ✅ Free (no egress charges) | 💸 Uses bandwidth quota |
| **Security** | 🔒 Private network only | 🌍 Public (but authenticated) |
| **Accessibility** | Same Railway project only | Anywhere with internet |

## When to Use Each

### Use Internal (`railway.internal`) ✅ **Recommended**

**For:**
- ✅ Marketplace backend → MinIO communication
- ✅ Production deployments
- ✅ Services in the same Railway project

**Why:**
- Faster (no public internet)
- Free bandwidth
- More secure
- Lower latency

### Use Public (`.railway.app`)

**For:**
- ❌ Local development (can't access `.railway.internal` from your machine)
- ❌ Services in different Railway projects
- ❌ External services accessing MinIO
- ❌ Manual testing/debugging with tools like `mc` client

## How Railway Internal Networking Works

### Automatic Private DNS

When you deploy services in the same Railway project:

1. **Each service gets a private DNS name:**
   - Format: `<service-name>.railway.internal`
   - Example: `minio.railway.internal`

2. **Services can resolve these names:**
   - Only within the same Railway project
   - Uses Railway's internal network
   - Bypasses public internet

3. **Traffic stays private:**
   - Never leaves Railway's infrastructure
   - No SSL needed (already encrypted at infrastructure level)
   - No bandwidth charges

### Finding Your Internal URL

**Method 1: Service Name**
- Usually just: `<service-name>.railway.internal`
- Example: `minio.railway.internal`

**Method 2: Railway Dashboard**
1. Go to your MinIO service
2. Look for "Settings" → "Networking"
3. Find "Private Networking" section
4. Copy the internal URL shown

**Method 3: Check Environment**
- Railway auto-injects: `RAILWAY_PRIVATE_DOMAIN`
- Your service might have this env var set

## Port Configuration

### MinIO Ports

MinIO uses two ports:

| Port | Purpose | Internal Access | Public Access |
|------|---------|----------------|---------------|
| **9000** | S3 API | `http://minio.railway.internal:9000` | Auto-mapped by Railway |
| **9001** | Web Console | Not typically exposed internally | `https://minio-xxx.railway.app` |

**For S3 API calls (what your app needs):**
- Internal: `http://minio.railway.internal:9000` ✅
- Public: `https://minio-production.railway.app` (no port)

**Why specify `:9000` for internal?**
- Internal URLs don't go through Railway's proxy
- You must specify the exact port the service listens on
- MinIO's S3 API listens on port 9000

**Why no port for public?**
- Railway's proxy automatically routes to the correct port
- HTTPS on 443 → forwards to your service's port 9000

## Common Mistakes

### ❌ Using HTTPS for internal

```env
# WRONG:
S3_ENDPOINT=https://minio.railway.internal:9000
```

```env
# RIGHT:
S3_ENDPOINT=http://minio.railway.internal:9000
```

**Why:** Internal network is already secure. SSL adds overhead and won't work.

### ❌ Forgetting the port

```env
# WRONG:
S3_ENDPOINT=http://minio.railway.internal
```

```env
# RIGHT:
S3_ENDPOINT=http://minio.railway.internal:9000
```

**Why:** Internal URLs don't use Railway's proxy, must specify port.

### ❌ Mixing internal and public

```env
# WRONG:
S3_ENDPOINT=https://minio.railway.internal:9000
```

Internal = `http://` + port `:9000`
Public = `https://` + no port

### ❌ Using internal from local dev

You can't access `.railway.internal` from your laptop:

```bash
# This won't work from your local machine:
curl http://minio.railway.internal:9000
# Error: Could not resolve host
```

**Solution:** Use public URL for local development, internal for production.

## Migration Guide

### From Public to Internal

**Before (public URL):**
```env
S3_ENDPOINT=https://minio-production-abc123.up.railway.app
```

**After (internal URL):**
```env
S3_ENDPOINT=http://minio.railway.internal:9000
```

**Steps:**
1. Update `S3_ENDPOINT` env var in Railway dashboard
2. Redeploy your marketplace service
3. Test upload/download functionality
4. Done! ✅

**Rollback if needed:**
Just change back to the public URL and redeploy.

## Testing Internal Networking

### Verify Internal DNS Resolution

**From within a Railway service:**

```bash
# SSH into your marketplace service (if Railway allows)
# Or add a debug endpoint

# Test DNS resolution:
nslookup minio.railway.internal
# Should resolve to internal IP (10.x.x.x)

# Test connectivity:
curl http://minio.railway.internal:9000/minio/health/live
# Should return: OK
```

### Verify Your App Uses Internal URL

**Check your app logs:**
- Look for S3 connection messages
- Should show: `http://minio.railway.internal:9000`
- Not: `https://minio-production.railway.app`

**Test upload/download:**
1. Upload a package via your marketplace
2. Check it appears in MinIO (via web console or `mc` client)
3. Download the package
4. Should work without errors

## Cost Savings

### Bandwidth Comparison

**Scenario:** 100GB of package downloads per month

**Using Public URL:**
- Marketplace → MinIO: ~100GB egress
- Cost: $5-10/month (depending on Railway plan)

**Using Internal URL:**
- Marketplace → MinIO: 0GB egress (internal)
- Cost: $0 💰

**Total savings:** ~$60-120/year per 100GB/month

## Debugging Connection Issues

### Problem: "Could not connect to MinIO"

**Check 1: Protocol**
```bash
# Internal should use http://
echo $S3_ENDPOINT
# Should show: http://minio.railway.internal:9000
```

**Check 2: Port**
```bash
# Internal must include :9000
echo $S3_ENDPOINT | grep :9000
# Should match
```

**Check 3: Same project**
- Both services in same Railway project?
- Check Railway dashboard

**Check 4: Service name**
```bash
# Verify exact service name
# In Railway dashboard, check MinIO service name
# Must match: <name>.railway.internal
```

### Problem: "Endpoint not found"

**Likely cause:** Service name mismatch

**Fix:**
1. Check MinIO service name in Railway dashboard
2. Use that exact name: `<service-name>.railway.internal`
3. Common names: `minio`, `storage`, `s3`

### Problem: Works locally, fails on Railway

**Cause:** Using internal URL from local dev

**Solution:**
- Local dev: Use public URL (`https://minio-xxx.railway.app`)
- Railway prod: Use internal URL (`http://minio.railway.internal:9000`)

**Or:** Use environment variable to switch:
```typescript
// In your app:
const endpoint = process.env.RAILWAY_ENVIRONMENT 
  ? 'http://minio.railway.internal:9000'  // Railway
  : 'http://localhost:9000';               // Local dev
```

## Best Practices

### ✅ Recommended Setup

**Local Development:**
```env
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
```

**Railway Production:**
```env
S3_ENDPOINT=http://minio.railway.internal:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<secure-key>
S3_SECRET_KEY=<secure-secret>
```

### ✅ Security

- ✅ Use internal networking for service-to-service
- ✅ Only expose public URL if needed for external access
- ✅ Use strong credentials even with internal networking
- ✅ Railway's internal network is isolated per project

### ✅ Performance

- ✅ Internal networking reduces latency by ~20-50ms per request
- ✅ Higher throughput (no public bandwidth limits)
- ✅ More reliable (fewer hops, less network jitter)

## Summary

**Yes, use `.railway.internal`!** It's:
- ⚡ **Faster** - Direct private network
- 💰 **Cheaper** - No bandwidth charges  
- 🔒 **Safer** - Traffic never leaves Railway
- ✅ **Easier** - Just works™ within same project

**Configuration:**
```env
S3_ENDPOINT=http://minio.railway.internal:9000
```

**Remember:**
- Use `http://` (not `https://`)
- Include `:9000` port
- Only works within same Railway project
- Use public URL for local dev

That's it! 🚀


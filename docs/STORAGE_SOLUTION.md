# Storage Solution Implementation Summary

## Problem

In production (Railway), uploaded package files were being stored in the local filesystem (`./storage` directory), which is **ephemeral** - files get deleted on container restart/redeploy. This caused "file not found" errors when trying to download previously uploaded packages.

## Solution: MinIO (S3-Compatible Storage)

Added **MinIO** as an S3-compatible object storage solution that provides persistent file storage.

### Why MinIO?

✅ **S3-compatible API** - works with existing AWS SDK code (no code changes needed)
✅ **Persistent storage** - data survives container restarts
✅ **Works everywhere** - same setup for local dev and production
✅ **Free & open source** - no vendor lock-in
✅ **Easy to set up** - single Docker container

## What Was Changed

### 1. Docker Compose (`docker-compose.yml`)

Added MinIO service:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin123
  ports:
    - "9000:9000"  # S3 API
    - "9001:9001"  # Web console
  volumes:
    - minio_data:/data
```

### 2. Environment Configuration (`.env.example`)

Updated with MinIO defaults:

```env
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_REGION=us-east-1
```

### 3. Setup Scripts

Created automated bucket setup:

- **`scripts/setup-minio.ps1`** - Windows PowerShell
- **`scripts/setup-minio.sh`** - Linux/Mac bash

These scripts:
- Wait for MinIO to be ready
- Download MinIO client (`mc`) if needed
- Create the `prompt-gen-packages` bucket
- Set public read policy for downloads

### 4. Documentation

- **`docs/MINIO_SETUP.md`** - Complete MinIO setup guide
- **`README.md`** - Updated quick start with MinIO steps

### 5. NPM Script

Added convenience script:

```bash
npm run storage:setup
```

## How It Works

### Existing Code (No Changes Needed!)

Your `src/services/storage.service.ts` already had the logic:

```typescript
const s3Client = config.s3.endpoint
  ? new AWS.S3({
      endpoint: config.s3.endpoint,
      // ... S3 config
    })
  : null;

const USE_S3 = !!s3Client;
```

If `S3_ENDPOINT` is set → use S3
If `S3_ENDPOINT` is empty → use local filesystem

### Storage Flow

**Publishing a package:**
1. User uploads YAML file
2. App validates and processes
3. `storageService.storePackage()` called
4. **If S3 configured:** Upload to MinIO via S3 API
5. **If no S3:** Save to `./storage` directory
6. Database stores metadata + storage path

**Downloading a package:**
1. User requests package
2. App looks up storage path in database
3. `storageService.retrievePackage()` called
4. **If S3 configured:** Download from MinIO
5. **If no S3:** Read from `./storage` directory
6. Return content to user

## Local Development Setup

### Quick Start

```bash
# 1. Start services (includes MinIO)
docker-compose up -d

# 2. Setup MinIO bucket (first time only)
npm run storage:setup
# OR: .\scripts\setup-minio.ps1

# 3. Copy .env.example to .env (already has MinIO config)
cp .env.example .env

# 4. Start app
npm run dev
```

### Verify Setup

1. **Check MinIO is running:**
   ```bash
   docker-compose ps
   ```
   Should show `minio` service running

2. **Access web console:**
   Open http://localhost:9001
   - Username: `minioadmin`
   - Password: `minioadmin123`

3. **Verify bucket exists:**
   In the web console, you should see `prompt-gen-packages` bucket

## Production Deployment (Railway)

### Option 1: Add MinIO Service to Railway

1. **In Railway dashboard, click "New Service" → "Docker Image"**

2. **Set the Docker image:**
   ```
   minio/minio:latest
   ```

3. **Set the start command** (under "Settings" → "Deploy" → "Custom Start Command"):
   ```
   minio server /data --console-address ":9001"
   ```
   
   ⚠️ **Important:** Use `minio server` (not just `server`) - the full command including the binary name.

4. **Add environment variables** (under "Variables" tab):
   ```
   MINIO_ROOT_USER=minioadmin
   MINIO_ROOT_PASSWORD=<generate-secure-password-minimum-8-chars>
   ```
   
   💡 **Security tip:** Generate a strong password for production!

5. **Add a volume** (under "Settings" → "Volumes"):
   - Mount path: `/data`
   - This ensures data persists across deploys

6. **Expose the service publicly:**
   - Railway will automatically expose port 9000 (MinIO's default)
   - You'll get a URL like `https://minio-production.up.railway.app`
   - Port 9001 (console) is optional - only expose if you want web access

7. **In your marketplace service, add environment variables:**
   
   **Recommended: Use internal networking (same Railway project)**
   ```
   S3_ENDPOINT=http://minio.railway.internal:9000
   S3_BUCKET=prompt-gen-packages
   S3_ACCESS_KEY=<secure-username>
   S3_SECRET_KEY=<secure-password>
   S3_REGION=us-east-1
   ```
   
   **Why internal networking?**
   - ✅ Faster (no public internet hop)
   - ✅ Free bandwidth (no egress charges)
   - ✅ More secure (traffic stays within Railway network)
   - ⚠️ Must use `http://` (not `https://`) and include port `:9000`
   
   **Alternative: Use public URL (if needed for external access)**
   ```
   S3_ENDPOINT=https://your-minio.railway.app
   S3_BUCKET=prompt-gen-packages
   S3_ACCESS_KEY=<secure-username>
   S3_SECRET_KEY=<secure-password>
   S3_REGION=us-east-1
   ```

8. **Create the bucket:**
   
   After MinIO deploys, you need to create the bucket. You have two options:
   
   **Option A: Use MinIO web console** (if you exposed port 9001):
   - Access your MinIO URL (Railway provides it)
   - Login with your credentials
   - Click "Create Bucket"
   - Name it `prompt-gen-packages`
   
   **Option B: Let your app create it automatically:**
   - Your `storage.service.ts` has `initializeStorage()` that creates buckets
   - Make sure this runs on startup (check `src/index.ts`)
   
   **Option C: Use mc client locally:**
   ```bash
   # Install MinIO client
   # Windows: download mc.exe from https://dl.min.io/client/mc/release/windows-amd64/mc.exe
   # Linux/Mac: wget https://dl.min.io/client/mc/release/linux-amd64/mc
   
   # Configure alias
   mc alias set railway https://minio-production.up.railway.app minioadmin <your-password>
   
   # Create bucket
   mc mb railway/prompt-gen-packages
   ```

#### Railway MinIO Troubleshooting

**"Executable `server` not found" error:**
- ✅ **Fix:** Use full command `minio server /data --console-address ":9001"`
- ❌ **Wrong:** `server /data` (missing the `minio` binary name)

**Can't connect to MinIO from marketplace:**
- Check the URL is using `https://` (Railway provides HTTPS automatically)
- Verify `S3_ACCESS_KEY` and `S3_SECRET_KEY` match `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`
- Check MinIO service is running (green status in Railway)

**Bucket doesn't exist:**
- Create it manually via options above
- Or verify `initializeStorage()` is called on app startup

**Files still disappear after deploy:**
- Verify you've added a **Volume** mounted to `/data`
- Without a volume, MinIO storage is ephemeral (same problem as before!)

### Option 2: Use External S3-Compatible Service (Recommended for Production)

For production, consider using a managed service:

#### Cloudflare R2 (Recommended)
- ✅ S3-compatible API
- ✅ No egress fees (unlike AWS S3)
- ✅ Global edge network
- ✅ Free tier: 10GB storage, 1M requests/month

Setup:
```env
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<r2-access-key>
S3_SECRET_KEY=<r2-secret-key>
S3_REGION=auto
```

#### AWS S3
```env
S3_ENDPOINT=  # Leave empty for AWS S3
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<aws-access-key>
S3_SECRET_KEY=<aws-secret-key>
S3_REGION=us-east-1
```

#### DigitalOcean Spaces
```env
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<spaces-key>
S3_SECRET_KEY=<spaces-secret>
S3_REGION=us-east-1
```

## Troubleshooting

### "File not found" errors in production

**Symptom:** Packages upload successfully but can't be downloaded

**Cause:** Either:
1. S3 not configured (using ephemeral filesystem)
2. S3 credentials incorrect
3. Bucket doesn't exist

**Fix:**
1. Set S3 environment variables in Railway
2. Verify credentials are correct
3. Create bucket manually or ensure auto-creation works

### MinIO won't start locally

**Symptom:** `docker-compose up` fails or MinIO container exits

**Cause:** Port 9000 or 9001 already in use

**Fix:**
```bash
# Windows - check ports
netstat -ano | findstr :9000
netstat -ano | findstr :9001

# Kill process using port
taskkill /PID <pid> /F

# Or change MinIO ports in docker-compose.yml
```

### Bucket setup script fails

**Symptom:** `setup-minio.ps1` times out or errors

**Cause:** MinIO not fully started

**Fix:**
```bash
# Wait for MinIO health check
docker-compose ps

# When healthy, create bucket manually:
# 1. Go to http://localhost:9001
# 2. Login with minioadmin / minioadmin123
# 3. Click "Create Bucket"
# 4. Name: prompt-gen-packages
```

### Can't access files from app

**Symptom:** App starts but uploads fail with S3 errors

**Cause:** Environment variables not loaded

**Fix:**
1. Verify `.env` file exists
2. Restart app after changing `.env`
3. Check logs for S3 connection errors

### Railway: Files work locally but not in production

**Symptom:** Everything works locally, fails on Railway

**Cause:** S3 environment variables not set in Railway

**Fix:**
1. Go to Railway project settings
2. Click your service
3. Go to "Variables" tab
4. Add all S3_* variables
5. Redeploy service

## Testing Storage

### Manual Test

```bash
# 1. Start services
docker-compose up -d
npm run storage:setup
npm run dev

# 2. Upload a package via API or frontend
# (You'll need to be authenticated)

# 3. Check MinIO web console
# Open http://localhost:9001
# Navigate to prompt-gen-packages bucket
# You should see your uploaded file

# 4. Download the package
# Should work without errors
```

### Verify Storage Type

Check application logs on startup:

```
✅ S3 bucket exists: prompt-gen-packages
📦 Storage initialized: S3 (http://localhost:9000)
```

OR (if no S3):

```
📦 Storage initialized: Local (./storage)
```

## Migration Notes

### Existing Packages

If you have packages that were uploaded before MinIO setup:

1. They're stored in `./storage` directory (locally) or lost (Railway)
2. Database still has records pointing to those files
3. Downloads will fail with "file not found"

**Options:**

A. **Re-upload packages** (recommended for small dataset)

B. **Migrate files to MinIO** (for large dataset):
   ```bash
   # If you have a backup of ./storage directory:
   # Use MinIO client to bulk upload
   mc cp --recursive ./storage/ local/prompt-gen-packages/
   ```

C. **Keep local storage** for dev, use MinIO only in production
   - Don't set S3_* vars in local `.env`
   - Set them only in Railway

## Architecture Diagram

```
┌──────────────────────────────────────┐
│         Frontend (Vue)               │
│   - Upload package YAML              │
│   - Request package download         │
└──────────────┬───────────────────────┘
               │ HTTP/REST
               │
┌──────────────▼───────────────────────┐
│      Backend API (Express)           │
│   - Process package                  │
│   - Validate & parse YAML            │
│   - Store metadata in DB             │
│   - Delegate file storage            │
└──────────┬───────────┬───────────────┘
           │           │
           │           │ S3 API calls
           │           │
           │     ┌─────▼──────┐
           │     │   MinIO    │
           │     │ (S3-compat)│
           │     │  Port 9000 │
           │     └─────┬──────┘
           │           │
           │           │ Persistent volume
           │           │
           │     ┌─────▼──────┐
           │     │ File Data  │
           │     │ (packages) │
DB queries │     └────────────┘
           │
    ┌──────▼──────┐
    │ PostgreSQL  │
    │  - Package  │
    │    metadata │
    │  - Versions │
    │  - Storage  │
    │    paths    │
    └─────────────┘
```

## Summary

✅ **Added MinIO** for persistent S3-compatible storage
✅ **Updated Docker Compose** with MinIO service
✅ **Created setup scripts** for automated bucket creation
✅ **Updated documentation** with setup instructions
✅ **No code changes needed** - existing storage service supports S3
✅ **Works locally and in production** with same configuration

Files are now **persistent** and survive container restarts! 🎉


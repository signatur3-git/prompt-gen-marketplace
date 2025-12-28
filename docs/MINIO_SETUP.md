# MinIO Setup Guide

MinIO is an S3-compatible object storage server that runs locally. It solves the file persistence problem in development and production environments.

## Quick Start (Local Development)

### 1. Start MinIO with Docker Compose

```bash
docker-compose up -d minio
```

This starts MinIO on:
- **API:** http://localhost:9000
- **Web Console:** http://localhost:9001

### 2. Create the Bucket

**Windows (PowerShell):**
```powershell
.\scripts\setup-minio.ps1
```

**Linux/Mac:**
```bash
chmod +x ./scripts/setup-minio.sh
./scripts/setup-minio.sh
```

### 3. Update Your `.env` File

```env
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_REGION=us-east-1
```

### 4. Restart Your Application

```bash
npm run dev
```

Your app will now store package files in MinIO instead of the ephemeral local filesystem.

## Web Console

Access the MinIO console at **http://localhost:9001**

- **Username:** `minioadmin`
- **Password:** `minioadmin123`

From here you can:
- Browse uploaded files
- Manage buckets
- View access logs
- Configure policies

## Production Deployment (Railway)

### Option 1: Railway MinIO Service (Recommended)

1. Add a new service in Railway from the MinIO template
2. Set environment variables in your marketplace service:

```env
S3_ENDPOINT=https://your-minio-service.railway.app
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<generated-access-key>
S3_SECRET_KEY=<generated-secret-key>
S3_REGION=us-east-1
```

### Option 2: External S3-Compatible Storage

Use any S3-compatible service:
- **Cloudflare R2** (recommended for production - no egress fees)
- **AWS S3**
- **DigitalOcean Spaces**
- **Backblaze B2**

Just set the appropriate `S3_ENDPOINT` and credentials.

## Why MinIO?

✅ **S3-compatible:** Works with existing AWS SDK code
✅ **Persistent:** Data survives container restarts
✅ **Portable:** Same setup works locally and in production
✅ **Free & Open Source:** No vendor lock-in
✅ **Fast:** Optimized for high-performance object storage

## Fallback to Local Filesystem

If you don't want to use S3/MinIO, leave `S3_ENDPOINT` empty in your `.env` file. The app will fall back to storing files in the `./storage` directory.

**Note:** This only works for development. In production (Railway), the filesystem is ephemeral and files will be lost on restart.

## Troubleshooting

### MinIO not starting?

Check if port 9000 or 9001 is already in use:

```bash
# Windows
netstat -ano | findstr :9000

# Linux/Mac
lsof -i :9000
```

### Bucket not created?

Create it manually via the web console:
1. Go to http://localhost:9001
2. Login with `minioadmin` / `minioadmin123`
3. Click "Create Bucket"
4. Name it `prompt-gen-packages`

### Can't connect from app?

Make sure:
- MinIO is running: `docker-compose ps`
- Environment variables are set in `.env`
- You've restarted your app after updating `.env`

## Architecture

```
┌─────────────────┐
│   Your App      │
│  (Express API)  │
└────────┬────────┘
         │
         │ S3 API calls
         │
    ┌────▼────────┐
    │   MinIO     │
    │  (S3-compat)│
    └────┬────────┘
         │
         │ Persistent volume
         │
    ┌────▼────────┐
    │  File Data  │
    │ (packages)  │
    └─────────────┘
```

When a package is published:
1. App receives YAML file
2. App calls `storageService.storePackage()`
3. Storage service uploads to MinIO via S3 API
4. MinIO stores file persistently
5. Database stores metadata + storage path

When a package is downloaded:
1. App looks up storage path in database
2. App calls `storageService.retrievePackage()`
3. Storage service downloads from MinIO
4. App returns content to user


# Storage Quick Reference

## 🚀 First Time Setup (Local Dev)

```bash
# 1. Start Docker services
docker-compose up -d

# 2. Setup MinIO bucket
npm run storage:setup

# 3. That's it! Your .env already has the right config
```

## 🔍 Verify Everything Works

```bash
# Check services are running
docker-compose ps

# Should show:
# ✅ postgres (port 5433)
# ✅ redis (port 6380)  
# ✅ minio (ports 9000, 9001)
```

## 🌐 Access MinIO Web Console

**URL:** http://localhost:9001
**Username:** `minioadmin`
**Password:** `minioadmin123`

## 📦 Environment Variables (`.env`)

```env
# S3 / Object Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_REGION=us-east-1
```

## ⚙️ For Railway Production

### Set these environment variables:

```env
# Option 1: Use Cloudflare R2 (recommended)
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<your-r2-key>
S3_SECRET_KEY=<your-r2-secret>
S3_REGION=auto

# Option 2: Deploy MinIO on Railway
S3_ENDPOINT=https://your-minio.railway.app
S3_BUCKET=prompt-gen-packages
S3_ACCESS_KEY=<secure-username>
S3_SECRET_KEY=<secure-password>
S3_REGION=us-east-1
```

## 🔧 Troubleshooting

### Can't access MinIO console?

```bash
# Check if port is in use
netstat -ano | findstr :9001

# Restart MinIO
docker-compose restart minio
```

### Bucket doesn't exist?

```bash
# Run setup script again
npm run storage:setup

# OR create manually at http://localhost:9001
```

### App says "Local storage" instead of "S3"?

```bash
# Check your .env file has S3_ENDPOINT set
cat .env | grep S3_ENDPOINT

# Restart your app
npm run dev
```

### Files disappear on Railway?

❌ **You're using local filesystem (ephemeral)**
✅ **Set S3_* environment variables in Railway**

## 📚 Full Docs

- **Setup Guide:** [docs/MINIO_SETUP.md](MINIO_SETUP.md)
- **Implementation:** [docs/STORAGE_SOLUTION.md](STORAGE_SOLUTION.md)

## 💡 Pro Tips

1. **Development:** Use MinIO (included in docker-compose)
2. **Production:** Use Cloudflare R2 or AWS S3
3. **Testing:** Use local filesystem (leave S3_ENDPOINT empty)
4. **Don't mix:** Choose S3 OR local, not both in same environment


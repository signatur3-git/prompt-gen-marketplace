# Testing Guide - Prompt Gen Marketplace

This guide explains how to test the marketplace locally using Docker Compose.

**Important:** Docker Compose uses PostgreSQL on **port 5433** (not 5432) to avoid conflicts with existing PostgreSQL installations.

---

## 🚀 Quick Start (5 Minutes)

**The fastest way to test locally:**

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start PostgreSQL + Redis
docker-compose up -d

# 3. Create .env file (REQUIRED!)
cp .env.example .env

# 4. Initialize / migrate the database schema
npm run migrate:up

# 5. Start the marketplace server
npm run dev

# 6. Test it's working
curl http://localhost:3000/health
```

**That's it!** The marketplace is now running with a full database and Redis.

**Note:** Step 3 is required! Without the `.env` file, the app will try to connect to a local PostgreSQL on port 5432 instead of the Docker container on port 5433.

---

## 📋 Step-by-Step Testing

### 1. Generate a Test Keypair

```bash
curl http://localhost:3000/api/v1/auth/keygen
```

**Response:**
```jsonc
{
  "public_key": "abc123...",
  "secret_key": "def456...",
  "pem": "-----BEGIN PROMPT-GEN MARKETPLACE KEYPAIR-----\n...",
  "warning": "⚠️ KEEP SECRET KEY PRIVATE!"
}
```

**Save these values!** You'll need them for the next steps.

### 2. Register a User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "public_key": "YOUR_PUBLIC_KEY_FROM_STEP_1"
  }'
```

**Response:**
```jsonc
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "public_key": "...",
    "created_at": "2025-12-22T17:00:00Z"
  }
}
```

### 3. Get Authentication Challenge

```bash
curl "http://localhost:3000/api/v1/auth/challenge?public_key=YOUR_PUBLIC_KEY"
```

**Response:**
```jsonc
{
  "challenge": "random-hex-string",
  "expires_at": "2025-12-22T17:05:00Z"
}
```

### 4. Sign the Challenge (Client-Side)

**Note:** In a real application, this would happen in your client (webapp/desktop). For testing, you can use the test script below.

**Create a file `test-auth.js`:**
```javascript
const nacl = require('tweetnacl');

const secretKeyHex = 'YOUR_SECRET_KEY_FROM_STEP_1';
const challenge = 'YOUR_CHALLENGE_FROM_STEP_3';

const secretKey = Buffer.from(secretKeyHex, 'hex');
const messageBytes = Buffer.from(challenge, 'utf8');
const signature = nacl.sign.detached(messageBytes, secretKey);
const signatureHex = Buffer.from(signature).toString('hex');

console.log('Signature:', signatureHex);
```

**Run it:**
```bash
node test-auth.js
```

### 5. Login with Signed Challenge

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "public_key": "YOUR_PUBLIC_KEY",
    "challenge": "YOUR_CHALLENGE",
    "signature": "YOUR_SIGNATURE_FROM_STEP_4"
  }'
```

**Response:**
```jsonc
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400,
  "user": { ... },
  "primary_persona": { ... }
}
```

**Save the token!** Use it for authenticated requests.

### 6. Test Authenticated Endpoints

**List your personas:**
```bash
curl http://localhost:3000/api/v1/personas \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create a namespace:**
```bash
curl -X POST http://localhost:3000/api/v1/namespaces \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-test-namespace",
    "protection_level": "protected",
    "description": "Testing namespace creation"
  }'
```

**Publish a package:**
```bash
curl -X POST http://localhost:3000/api/v1/packages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "yaml_content": "id: my-test-namespace.test-package\nversion: 1.0.0\nmetadata:\n  name: Test Package\n  description: A test package"
  }'
```

---

## 🔍 Inspecting the Database

While testing, you can inspect the database to see what's happening:

```bash
# Connect to PostgreSQL
docker exec -it rpg-marketplace-postgres psql -U postgres -d prompt_gen_marketplace

# List all users
SELECT id, public_key, email, created_at FROM users;

# List all personas
SELECT id, user_id, name, is_primary FROM personas;

# List all namespaces
SELECT id, name, owner_id, protection_level FROM namespaces;

# List all packages
SELECT id, namespace, name, created_at FROM packages;

# Exit
\q
```

---

## 🐛 Debugging

### Check Service Status

```bash
# Are containers running?
docker-compose ps

# Should show:
# rpg-marketplace-postgres   Up (healthy)
# rpg-marketplace-redis      Up (healthy)
```

### View Logs

```bash
# Server logs (npm run dev output)
# Check your terminal where you ran npm run dev

# PostgreSQL logs
docker-compose logs postgres

# Redis logs
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f
```

### Common Issues

**"Connection refused" error:**
```bash
# Wait for services to be healthy
docker-compose ps

# Check if ports are accessible
telnet localhost 5433  # PostgreSQL (note: using 5433, not 5432)
telnet localhost 6379  # Redis
```

**"Database does not exist" error:**
```bash
# Restart with fresh database
docker-compose down -v
docker-compose up -d

# Check if schema was loaded
docker exec rpg-marketplace-postgres psql -U postgres -d prompt_gen_marketplace -c "\dt"
```

**"Token expired" error:**
```bash
# Login again to get a new token (Step 3-5)
```

---

## 🧹 Cleanup

### Stop Services (Keep Data)

```bash
docker-compose down
```

Data is preserved in Docker volumes. Next time you run `docker-compose up -d`, your data will still be there.

### Complete Reset (Delete All Data)

```bash
# Stop and remove containers + volumes
docker-compose down -v

# Remove local storage
rm -rf storage/

# Start fresh
docker-compose up -d
```

---

## 📊 Running Tests

### Unit Tests (No Database Needed)

```bash
npm test
```

These test pure functions (crypto, validation) without needing a database.

### Integration Tests (Database Required)

```bash
# 1. Start services
docker-compose up -d

# 2. Run integration tests
npm run test:integration
```

These test the full API with a real database.

---

## 🎯 Testing Checklist

- [ ] Start docker-compose (`docker-compose up -d`)
- [ ] Start dev server (`npm run dev`)
- [ ] Generate keypair (`curl .../keygen`)
- [ ] Register user
- [ ] Get challenge
- [ ] Sign challenge
- [ ] Login (get token)
- [ ] Test authenticated endpoints
- [ ] Inspect database
- [ ] Run unit tests (`npm test`)
- [ ] Stop services (`docker-compose down`)

---

## 💡 Tips

**Tip 1:** Keep docker-compose running in the background while developing. You don't need to restart it unless you change the schema.

**Tip 2:** Use a tool like [Postman](https://www.postman.com/) or [Insomnia](https://insomnia.rest/) to test the API with a GUI instead of curl.

**Tip 3:** The `/api/v1/auth/keygen` endpoint is only for testing! In production, clients generate their own keypairs.

**Tip 4:** If you're getting weird errors, try a complete reset (`docker-compose down -v`).

---

## 🚀 What to Test

### Core Features (Implemented)
- ✅ User registration with keypair
- ✅ Challenge-response authentication
- ✅ Persona management (create, update, delete, set primary)
- ✅ Namespace management (create, update, protection levels)
- ✅ Package publishing with YAML validation
- ✅ Dependency resolution (semver matching, circular detection)
- ✅ Package download with checksums
- ✅ Package yanking

### Coming Soon (Phase 2)
- ⏳ OAuth 2.0 integration
- ⏳ Package search
- ⏳ Download statistics
- ⏳ Featured packages

---

**Happy Testing! 🎉**

If you run into issues, check the main README.md troubleshooting section or the logs with `docker-compose logs -f`.

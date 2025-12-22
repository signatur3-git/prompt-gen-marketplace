# Prompt Gen Marketplace

Package registry and discovery platform for the Prompt Gen ecosystem.

## 🔐 Security Features

- **Keypair-based authentication** (no passwords!)
- **Ed25519 cryptography** for challenge-response authentication
- **OAuth 2.0 with PKCE** for webapp integration
- **Multiple personas** per user account
- **Namespace protection** (public/protected/private)

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose (for PostgreSQL + Redis)

### Local Development Setup (Recommended)

**The easiest way to test locally is using Docker Compose**, which automatically sets up PostgreSQL and Redis with the correct schema:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL + Redis with Docker Compose:**
   ```bash
   docker-compose up -d
   ```
   
   This will:
   - ✅ Start PostgreSQL on port 5433
   - ✅ Start Redis on port 6379
   - ✅ Automatically initialize the database schema
   - ✅ Create the `prompt_gen_marketplace` database

3. **Create .env file (required):**
   ```bash
   cp .env.example .env
   ```
   
   The default values in `.env` work perfectly with docker-compose - no editing needed!

4. **Start development server:**
   ```bash
   npm run dev
   ```

   Server runs at `http://localhost:3000`

5. **Test the API:**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Generate test keypair
   curl http://localhost:3000/api/v1/auth/keygen
   ```

6. **Stop services when done:**
   ```bash
   docker-compose down
   ```

### Alternative: Manual PostgreSQL/Redis Setup

If you prefer to install PostgreSQL and Redis directly:

1. Install PostgreSQL 14+ and Redis 6+
2. Create database:
   ```bash
   psql -U postgres -c "CREATE DATABASE prompt_gen_marketplace;"
   psql -U postgres -d prompt_gen_marketplace -f database/schema.sql
   ```
3. Start Redis: `redis-server`
4. Update `.env` with your credentials
5. Run `npm run dev`

### Build for Production

```bash
npm run build
npm start
```

## 📚 API Documentation

### Authentication Endpoints

#### `POST /api/v1/auth/register`
Register a new user with their public key.

**Request:**
```json
{
  "public_key": "hex-encoded-ed25519-public-key",
  "email": "user@example.com"  // optional
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "public_key": "...",
    "email": "user@example.com",
    "created_at": "2025-12-22T12:00:00Z"
  }
}
```

#### `GET /api/v1/auth/challenge?public_key=...`
Get authentication challenge.

**Response:**
```json
{
  "challenge": "random-hex-string",
  "expires_at": "2025-12-22T12:05:00Z"
}
```

#### `POST /api/v1/auth/login`
Authenticate with signed challenge.

**Request:**
```json
{
  "public_key": "hex-encoded-public-key",
  "challenge": "challenge-from-previous-step",
  "signature": "hex-encoded-signature"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "expires_in": 86400,
  "user": { ... },
  "primary_persona": { ... }
}
```

#### `GET /api/v1/auth/keygen`
Generate a new keypair (for testing/development).

**Response:**
```json
{
  "public_key": "...",
  "secret_key": "...",
  "pem": "-----BEGIN PROMPT-GEN MARKETPLACE KEYPAIR-----\n...",
  "warning": "⚠️ KEEP SECRET KEY PRIVATE! This is for testing only."
}
```

### Persona Endpoints

All require `Authorization: Bearer <token>` header.

#### `GET /api/v1/personas`
List all personas for authenticated user.

#### `POST /api/v1/personas`
Create a new persona.

**Request:**
```json
{
  "name": "Jane Doe",
  "avatar_url": "https://...",  // optional
  "bio": "...",  // optional
  "website": "https://..."  // optional
}
```

#### `GET /api/v1/personas/:id`
Get persona details.

#### `PATCH /api/v1/personas/:id`
Update a persona.

#### `DELETE /api/v1/personas/:id`
Delete a persona (cannot delete primary if it's the only one).

#### `POST /api/v1/personas/:id/set-primary`
Set a persona as primary.

### Namespace Endpoints

#### `GET /api/v1/namespaces`
List namespaces (optional filters: `owner_id`, `protection_level`, `search`).

#### `POST /api/v1/namespaces` (authenticated)
Create/claim a namespace.

**Request:**
```json
{
  "name": "my-namespace",
  "protection_level": "protected",  // optional: public/protected/private
  "description": "..."  // optional
}
```

#### `GET /api/v1/namespaces/:name`
Get namespace details.

#### `PATCH /api/v1/namespaces/:name` (authenticated, owner only)
Update namespace.

## 🔑 Keypair Authentication Flow

### Client-Side (Registration)

```typescript
import * as ed25519 from '@noble/ed25519';

// 1. Generate keypair
const privateKey = ed25519.utils.randomPrivateKey();
const publicKey = await ed25519.getPublicKey(privateKey);

// 2. Save private key securely (user downloads it)
const privateKeyHex = Buffer.from(privateKey).toString('hex');
const publicKeyHex = Buffer.from(publicKey).toString('hex');

// 3. Register user
await fetch('http://localhost:3000/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ public_key: publicKeyHex })
});
```

### Client-Side (Login)

```typescript
// 1. Get challenge
const challengeRes = await fetch(
  `http://localhost:3000/api/v1/auth/challenge?public_key=${publicKeyHex}`
);
const { challenge } = await challengeRes.json();

// 2. Sign challenge with private key
const messageBytes = new TextEncoder().encode(challenge);
const signature = await ed25519.sign(messageBytes, privateKey);
const signatureHex = Buffer.from(signature).toString('hex');

// 3. Login with signed challenge
const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    public_key: publicKeyHex,
    challenge,
    signature: signatureHex
  })
});

const { token } = await loginRes.json();

// 4. Use token for authenticated requests
await fetch('http://localhost:3000/api/v1/personas', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🧪 Testing

### Unit Tests

Run the test suite (no database required):

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage report
npm run test:coverage
```

**Current test coverage:** 40 tests passing
- Crypto utilities (12 tests)
- Namespace validation (9 tests)
- Package validation (9 tests)
- Dependency resolver (10 tests)

### Integration Tests

Integration tests require a running database and Redis:

```bash
# 1. Start services
docker-compose up -d

# 2. Run integration tests
npm run test:integration

# 3. Stop services
docker-compose down
```

### Manual API Testing

With docker-compose running, you can test the API manually:

```bash
# 1. Start services
docker-compose up -d

# 2. Start dev server (in another terminal)
npm run dev

# 3. Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/auth/keygen

# 4. Register a user (use public_key from keygen)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"public_key":"YOUR_PUBLIC_KEY_HERE"}'

# 5. Get challenge
curl "http://localhost:3000/api/v1/auth/challenge?public_key=YOUR_PUBLIC_KEY_HERE"

# 6. ... sign challenge with secret key and login ...
```

### Database Inspection

To inspect the database while testing:

```bash
# Connect to PostgreSQL container
docker exec -it rpg-marketplace-postgres psql -U postgres -d prompt_gen_marketplace

# Example queries
SELECT * FROM users;
SELECT * FROM namespaces;
SELECT * FROM packages;
\q  # to exit
```

### Logs

View service logs:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 🔧 Troubleshooting

### Port Conflicts

If ports 5432 or 6379 are already in use:

```bash
# Check what's using the ports
# Windows:
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Linux/Mac:
lsof -i :5432
lsof -i :6379

# Option 1: Stop the conflicting service
# Option 2: Edit docker-compose.yml to use different ports:
#   "5433:5432"  # PostgreSQL on host port 5433
#   "6380:6379"  # Redis on host port 6380
```

### Database Not Initializing

If the database schema isn't loading:

```bash
# Stop and remove containers + volumes
docker-compose down -v

# Start fresh
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### Connection Errors

If you see "connection refused" errors:

1. Check services are running:
   ```bash
   docker-compose ps
   ```

2. Wait for health checks to pass:
   ```bash
   docker-compose logs postgres | grep "ready to accept"
   docker-compose logs redis | grep "Ready to accept"
   ```

3. Verify `.env` has correct values:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace
   REDIS_URL=redis://localhost:6379
   ```

### Clean Slate Reset

To completely reset everything:

```bash
# Stop services and remove all data
docker-compose down -v

# Remove local storage (if any)
rm -rf storage/

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start fresh
docker-compose up -d
npm run dev
```

---

## 📦 Database Schema

See `database/schema.sql` for the complete schema.

Key tables:
- `users` - User accounts (identified by public key)
- `user_keypairs` - Active and revoked keypairs
- `personas` - Multiple identities per user
- `namespaces` - Package namespaces with protection levels
- `packages` - Package metadata
- `package_versions` - Versioned package releases

## 🛠️ Development

### Project Structure

```
src/
├── config.ts              # Configuration
├── db.ts                  # Database client
├── redis.ts               # Redis client
├── crypto.ts              # Ed25519 utilities
├── app.ts                 # Express app
├── index.ts               # Server entry point
├── middleware/            # Express middleware
│   └── auth.middleware.ts
├── routes/                # API routes
│   ├── auth.routes.ts
│   ├── persona.routes.ts
│   └── namespace.routes.ts
└── services/              # Business logic
    ├── auth.service.ts
    ├── persona.service.ts
    └── namespace.service.ts
```

### Scripts

- `npm run dev` - Start development server (with auto-reload)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

## 🚧 Roadmap

### Core Features
- [x] Keypair-based authentication
- [x] Persona management
- [x] Namespace management
- [x] Package upload/download
- [x] Dependency resolution
- [ ] Package signing and verification

### OAuth Integration
- [ ] OAuth 2.0 authorization server
- [ ] PKCE flow for webapp integration
- [ ] Token management and refresh

### Discovery & Search
- [ ] Full-text search across packages
- [ ] Advanced filtering (tags, categories, etc.)
- [ ] Download statistics and trending packages
- [ ] Featured and recommended packages

### Marketplace Features
- [ ] Package reviews and ratings
- [ ] Version compatibility recommendations
- [ ] Automated security scanning
- [ ] Package deprecation workflow

See the [Issues](../../issues) page for detailed feature requests and bug reports.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to:
- Set up your development environment
- Submit pull requests
- Report bugs and request features

## 📄 License

MIT


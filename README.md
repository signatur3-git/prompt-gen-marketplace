# Prompt Gen Marketplace

Package registry and discovery platform for the Prompt Gen ecosystem.

## 🔐 Security Features

- **Keypair-based authentication** (no passwords!)
- **Ed25519 cryptography** for challenge-response authentication
- **OAuth 2.0 with PKCE** for webapp integration
- **Multiple personas** per user account
- **Namespace protection** (public/protected/private)

## 🔒 Authentication & session behavior

This app authenticates API requests using a **JWT access token** returned from `POST /api/v1/auth/login`.

- The token has a fixed lifetime (`expires_in` in the login response, currently `86400` seconds = **24 hours**).
- There is no server-side session store for access tokens (stateless JWT). “Staying signed in” is therefore mostly a **frontend storage** concern.

### Why you may be logged out after a restart

If the frontend does not persist the access token (in-memory only), closing/restarting your browser or OS will clear it and you’ll be logged out immediately.

If the token is persisted (e.g., `localStorage`/`sessionStorage`), you’ll stay signed in until the token expires.

### Potential future improvement: “Keep me signed in”

A common modern approach is to:

- keep the **access token short-lived** (e.g., 5–15 minutes)
- use a **refresh token** to obtain new access tokens
- store the refresh token in a more secure place (typically an **httpOnly, Secure cookie**) and rotate it

This enables a “Keep me signed in” checkbox:

- unchecked → memory-only token or session-scoped auth (logout on browser close)
- checked → refresh token cookie allows silent re-auth, with server-side revocation/rotation

This is generally considered safer than long-lived access tokens in `localStorage`, but it requires additional backend endpoints (refresh/revoke), storage for refresh token state (or rotation/jti tracking), and CSRF considerations when using cookies.

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose (for PostgreSQL + Redis)

### Local Development Setup (Recommended)

**The easiest way to test locally is using Docker Compose**, which automatically sets up PostgreSQL and Redis:

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start PostgreSQL + Redis with Docker Compose:**

   ```bash
   docker-compose up -d
   ```

3. **Create .env file (required):**

   ```bash
   cp .env.example .env
   ```

4. **Initialize / migrate the database schema:**

   ```bash
   npm run migrate:up
   ```

5. **Start development server:**

   ```bash
   npm run dev
   ```

   Server runs at `http://localhost:3000`

   Or start backend + frontend together:

   ```bash
   npm run dev:full
   ```

   - Backend API: `http://localhost:3000`
   - Frontend: `http://localhost:5174`

   > **Note:** Frontend uses port 5174 (not 5173) to avoid conflicting with external OAuth web apps that need port 5173 for callbacks.

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
   ```
3. Set `DATABASE_URL` in your `.env` (example):
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/prompt_gen_marketplace
   ```
4. Apply migrations:
   ```bash
   npm run migrate:up
   ```
5. Start Redis: `redis-server`
6. Update `.env` with your credentials
7. Run `npm run dev`

---

## 📦 Database Schema

The database schema is managed via migrations in `database/pgmigrations/`.

(You may also see `database/schema.sql` as a reference snapshot, but CI/production should use migrations.)

### Code Quality & CI

This project uses strict validation to catch issues early:

```bash
# Before committing, run:
npm run validate

# This checks:
# - Code formatting (Prettier)
# - Linting (ESLint for backend + frontend)
# - Type checking (TypeScript + vue-tsc)
# - Unit tests

# Auto-fix common issues:
npm run format        # Fix formatting
npm run lint:fix      # Fix backend lint issues
npm run lint:frontend:fix  # Fix frontend lint issues
```

**Important:** Local validation is as strict as CI to prevent push frustration!

See [CI_SETUP.md](CI_SETUP.md) for detailed CI/CD documentation.

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

```jsonc
{
  "public_key": "hex-encoded-ed25519-public-key",
  "email": "user@example.com", // optional
}
```

**Response:**

```jsonc
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "public_key": "...",
    "email": "user@example.com",
    "created_at": "2025-12-22T12:00:00Z",
  },
}
```

#### `GET /api/v1/auth/challenge?public_key=...`

Get authentication challenge.

**Response:**

```jsonc
{
  "challenge": "random-hex-string",
  "expires_at": "2025-12-22T12:05:00Z",
}
```

#### `POST /api/v1/auth/login`

Authenticate with signed challenge.

**Request:**

```jsonc
{
  "public_key": "hex-encoded-public-key",
  "challenge": "challenge-from-previous-step",
  "signature": "hex-encoded-signature",
}
```

**Response:**

```jsonc
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

```jsonc
{
  "public_key": "...",
  "secret_key": "...",
  "pem": "-----BEGIN PROMPT-GEN MARKETPLACE KEYPAIR-----\n...",
  "warning": "⚠️ KEEP SECRET KEY PRIVATE! This is for testing only.",
}
```

### OAuth 2.0 Endpoints

The marketplace implements **OAuth 2.0 Authorization Code flow with PKCE** for secure third-party application integration.

> **Note:** The marketplace has its own frontend that works perfectly. This OAuth integration is for **external applications** (like https://signatur3-git.github.io/prompt-gen-web) that want to integrate with the marketplace.

#### OAuth Client Configuration

The marketplace is pre-seeded with an OAuth client for the external web app:

- **Client ID:** `prompt-gen-web`
- **Client Name:** `Prompt Gen Web`
- **Redirect URIs:**
  - Local dev: `http://localhost:5173/oauth/callback`
  - Production: `https://signatur3-git.github.io/prompt-gen-web/oauth/callback`

⚠️ **Important:** The `redirect_uri` points to the **external web app's callback URL** (not the marketplace). The external web app needs to:
1. Create a `/oauth/callback` route to receive the authorization code
2. Exchange the code for an access token
3. Use the token to call marketplace APIs

**CORS Note:** For local development, the marketplace needs to allow CORS requests from the external web app. Set in `.env`:
```
CORS_ORIGIN=http://localhost:5174,http://localhost:5173
```

For production, update Railway environment variable to include the external web app's domain:
```
CORS_ORIGIN=https://prompt-gen-marketplace-production.up.railway.app,https://signatur3-git.github.io
```

#### OAuth Flow Summary

**See [OAuth Flow Documentation](./docs/oauth-flow.md) for a detailed explanation with diagrams.**

**Quick overview:**

1. Your web app generates PKCE `code_verifier` and `code_challenge`
2. Your web app redirects user to marketplace's authorization page (`/oauth/authorize`)
3. User sees marketplace's consent screen and approves/denies
4. Marketplace redirects back to **your web app's callback** with authorization `code`
5. Your web app exchanges code for access token at marketplace's `/api/v1/oauth/token` endpoint

**Key endpoints:**

- `GET /api/v1/oauth/authorize` - Authorization page
- `POST /api/v1/oauth/authorize` - User approval
- `POST /api/v1/oauth/token` - Exchange code for token
- `GET /api/v1/oauth/tokens` - List user's active tokens
- `DELETE /api/v1/oauth/tokens/:id` - Revoke a token

**Security notes:**

- ✅ Always use PKCE with `S256` (SHA-256)
- ✅ Validate `state` parameter for CSRF protection
- ✅ Authorization codes expire in 10 minutes
- ✅ Access tokens expire in 1 hour
- ✅ Codes are single-use only

### Persona Endpoints

All require `Authorization: Bearer <token>` header.

#### `GET /api/v1/personas`

List all personas for authenticated user.

#### `POST /api/v1/personas`

Create a new persona.

**Request:**

```jsonc
{
  "name": "Jane Doe",
  "avatar_url": "https://...", // optional
  "bio": "...", // optional
  "website": "https://...", // optional
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

```jsonc
{
  "name": "my-namespace",
  "protection_level": "protected", // optional: public/protected/private
  "description": "...", // optional
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
  body: JSON.stringify({ public_key: publicKeyHex }),
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
    signature: signatureHex,
  }),
});

const { token } = await loginRes.json();

// 4. Use token for authenticated requests
await fetch('http://localhost:3000/api/v1/personas', {
  headers: { Authorization: `Bearer ${token}` },
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

If ports 5432/5433 or 6379 are already in use:

```bash
# Check what's using the ports
# Windows:
netstat -ano | findstr :5432
netstat -ano | findstr :5433
netstat -ano | findstr :6379
netstat -ano | findstr :6380

# Linux/Mac:
lsof -i :5432
lsof -i :5433
lsof -i :6379
lsof -i :6380

# Option 1: Stop the conflicting service
# Option 2: Edit docker-compose.yml to use different ports
```

### Database Not Initializing

If your local database schema doesn’t match the current code:

- Preferred: apply migrations to the current DB:

  ```bash
  npm run migrate:up
  ```

- If you’re OK with losing local data (fastest/cleanest): reset the Docker volume and re-run migrations:

  ```bash
  docker-compose down -v
  docker-compose up -d
  npm run migrate:up
  npm run db:seed
  ```

### Connection Errors

If you see "connection refused" errors:

1. Check services are running:

   ```bash
   docker-compose ps
   ```

2. Verify `.env` has correct values:

   ```
   # Must match docker-compose.yml in this repo
   DATABASE_URL=postgresql://postgres:postgres@localhost:<HOST_POSTGRES_PORT>/prompt_gen_marketplace
   REDIS_URL=redis://localhost:<HOST_REDIS_PORT>
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

The database schema is managed via migrations in `database/pgmigrations/`.

(You may also see `database/schema.sql` as a reference snapshot, but CI/production should use migrations.)

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

## 🚄 Deployment (Railway)

This repo can be deployed to Railway as a single Node service.

### Recommended Railway commands

- **Build command:** `npm run build:all`
- **Start command:** `npm run start:with-migrations`

`start:with-migrations` runs `npm run migrate:up` against your `DATABASE_URL` before starting the server.

### Required environment variables

Railway will not automatically provision Postgres/Redis _unless you add them as plugins_.

You need to provide:

- `DATABASE_URL` (Railway Postgres plugin will provide this)
- `REDIS_URL` (Railway Redis plugin will provide this)
- `JWT_SECRET`

#### JWT secrets (how to generate)

These are **application secrets** (not related to Redis). They are used to sign auth tokens.

Generate a strong secret locally and copy it into Railway variables:

```bash
# Linux/macOS
openssl rand -base64 48

# Windows PowerShell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

Set the output as `JWT_SECRET`.

> Note: the code currently logs whether `JWT_REFRESH_SECRET` is set, but refresh tokens are not yet implemented in the backend. You can ignore `JWT_REFRESH_SECRET` for now unless you add refresh-token support.

### Database migrations

On a new deployment (fresh DB), migrations must be applied once:

- Automatic if you use `npm run start:with-migrations`
- Manual alternative: run `npm run migrate:up` in Railway against the configured `DATABASE_URL`

### Ports

Railway provides a `PORT` env var.

This app listens on `PORT` (default `3000`) and binds to `0.0.0.0` in production.

---

## 📄 License

MIT

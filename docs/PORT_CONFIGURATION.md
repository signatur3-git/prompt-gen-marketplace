# Port Configuration - Local Development

## Port Assignments

### Marketplace (This Repository)

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| Frontend (Vite dev) | 5174 | http://localhost:5174 |
| PostgreSQL (Docker) | 5433 | postgresql://localhost:5433 |
| Redis (Docker) | 6380 | redis://localhost:6380 |

### External Web App (OAuth Integration)

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite dev) | 5173 | http://localhost:5173 |
| OAuth Callback | 5173 | http://localhost:5173/oauth/callback |

## Why These Ports?

### Port 5174 for Marketplace Frontend

**Changed from 5173 to 5174** to avoid conflict with external web app.

**Reason:** The OAuth client is seeded with redirect URI `http://localhost:5173/oauth/callback`, which expects the external web app to be running on port 5173. We don't want to change the seed file because:

1. Port 5173 is Vite's default
2. External web app developers expect port 5173
3. Changing the seed would require updating all OAuth documentation
4. It's easier to change the marketplace's frontend port (internal)

### Port 5433 for PostgreSQL

**Changed from 5432** to avoid conflict with existing local PostgreSQL installations.

Standard PostgreSQL uses 5432, so many developers already have that port in use.

### Port 6380 for Redis

**Changed from 6379** to avoid conflict with existing local Redis installations.

Standard Redis uses 6379, so many developers already have that port in use.

## Configuration Files

### Changed Files

1. **`vite.config.ts`** - Set frontend dev server port to 5174
2. **`src/index.ts`** - Updated logging to show port 5174
3. **`src/config.ts`** - Updated CORS default to localhost:5174
4. **`.env`** - Updated CORS_ORIGIN to localhost:5174
5. **`.env.example`** - Updated CORS_ORIGIN to localhost:5174

### What DIDN'T Change

- **OAuth seed file** - Still uses port 5173 for external web app ✅
- **Backend API** - Still on port 3000 ✅
- **Docker compose** - Still uses 5433/6380 ✅

## Starting Local Development

### Just Backend
```bash
npm run dev
```
- Backend API: http://localhost:3000

### Backend + Frontend
```bash
npm run dev:full
```
- Backend API: http://localhost:3000
- Frontend: http://localhost:5174

### Testing OAuth Flow

1. Start marketplace:
   ```bash
   npm run dev:full
   ```

2. Start external web app (in its own repo):
   ```bash
   npm run dev
   ```
   This will run on http://localhost:5173

3. External web app can now:
   - Redirect to marketplace: http://localhost:3000/oauth/authorize
   - Receive callbacks at: http://localhost:5173/oauth/callback

## Production

In production, there's no conflict because:
- Marketplace serves its frontend from the same domain as the API
- External web app is on a completely different domain (GitHub Pages)

No port configuration needed for production! 🎉


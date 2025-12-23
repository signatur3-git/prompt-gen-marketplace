# OAuth Integration - Quick Reference

## The Issue You Hit

**Problem:** External web app → marketplace OAuth flow was broken

**Symptoms:**
1. "Missing header error" when redirecting to marketplace
2. After login, redirected to homepage instead of authorization page
3. OAuth flow never completed

## The Root Causes

### 1. Wrong Redirect URL
**External web app was redirecting to:** API endpoint (`/api/v1/oauth/authorize`)  
**Should redirect to:** Frontend route (`/oauth/authorize` on port 5174)

### 2. LoginPage Didn't Respect Redirect Parameter
**LoginPage always redirected to:** Homepage (`/`)  
**Should redirect to:** The `?redirect=` query parameter (preserves OAuth flow)

## The Fix

### ✅ Fixed in Marketplace (This Commit)

**File:** `frontend/src/pages/LoginPage.vue`

**Change:** After successful login, check for `?redirect=` parameter:

```typescript
// OLD CODE:
setTimeout(() => {
  router.push('/');  // Always goes to homepage
}, 1500);

// NEW CODE:
const redirectTo = (route.query.redirect as string) || '/dashboard';
setTimeout(() => {
  router.push(redirectTo);  // Respects redirect parameter
}, 1500);
```

Now when AuthorizePage redirects unauthenticated users to:
```
/login?redirect=/oauth/authorize?client_id=...
```

The login page will redirect BACK to the OAuth authorization page after login!

### ✅ What External Web App Must Do

**Redirect to marketplace FRONTEND, not API:**

```typescript
// ❌ WRONG - Don't do this:
window.location.href = 'http://localhost:3000/api/v1/oauth/authorize?...';

// ✅ CORRECT - Do this:
window.location.href = 'http://localhost:5174/oauth/authorize?...';
//                                         ^^^^
//                                    Frontend port!
```

## Complete Flow (After Fix)

```
1. External web app (localhost:5173)
   → User clicks "Connect to Marketplace"
   → Generates PKCE verifier/challenge
   → Redirects to: http://localhost:5174/oauth/authorize?client_id=...
                                      ^^^^
                                  FRONTEND port!

2. Marketplace frontend (localhost:5174)
   → Checks if user logged in
   → If NOT: redirects to /login?redirect=/oauth/authorize?...
                                    ↑
                          Saves OAuth params!

3. Marketplace login page
   → User uploads keypair
   → Signs challenge
   → Gets JWT token
   → Redirects to the saved redirect param (/oauth/authorize?...)
                                            ↑
                                    Now this works! ✅

4. Back at /oauth/authorize
   → User IS logged in now
   → Shows consent screen
   → User clicks "Authorize"
   → Redirects to: http://localhost:5173/oauth/callback?code=...

5. External web app callback
   → Exchanges code for access token
   → Stores token
   → Makes authenticated API calls
```

## Testing Checklist

### Start Services
```bash
# Terminal 1: Marketplace
npm run dev:full
# Backend: localhost:3000
# Frontend: localhost:5174

# Terminal 2: External web app
npm run dev
# Frontend: localhost:5173
```

### Test OAuth Flow

1. ✅ External web app redirects to `localhost:5174/oauth/authorize?...`
2. ✅ If not logged in → redirects to `localhost:5174/login?redirect=...`
3. ✅ After login → redirects back to `/oauth/authorize?...` (FIXED!)
4. ✅ Shows consent screen
5. ✅ Click Authorize → redirects to `localhost:5173/oauth/callback?code=...`
6. ✅ External web app exchanges code for token
7. ✅ Success!

## Key URLs Reference

### Local Development

| Service | URL | Purpose |
|---------|-----|---------|
| Marketplace Backend | `http://localhost:3000` | API endpoints |
| Marketplace Frontend | `http://localhost:5174` | OAuth authorization UI |
| External Web App | `http://localhost:5173` | Your app + callback |

### Production

| Service | URL | Purpose |
|---------|-----|---------|
| Marketplace | `https://prompt-gen-marketplace-production.up.railway.app` | API + Frontend |
| External Web App | `https://signatur3-git.github.io/prompt-gen-web` | Your app + callback |

In production, redirect to:
```typescript
window.location.href = 'https://prompt-gen-marketplace-production.up.railway.app/oauth/authorize?...';
```

The marketplace serves both API and frontend from the same domain in production!

## Common Mistakes

### ❌ Mistake 1: Wrong Port
```typescript
// Don't redirect to backend API port!
'http://localhost:3000/oauth/authorize'  // ❌
```

### ❌ Mistake 2: Wrong Endpoint
```typescript
// Don't redirect to API endpoint!
'http://localhost:5174/api/v1/oauth/authorize'  // ❌
```

### ✅ Correct
```typescript
// Redirect to frontend route!
'http://localhost:5174/oauth/authorize'  // ✅
```

## Documentation

For complete implementation details, see:
- **`docs/OAUTH_FLOW_COMPLETE.md`** - Full flow explanation with all scenarios
- **`docs/oauth-implementation-checklist.md`** - Step-by-step implementation guide
- **`docs/PORT_CONFIGURATION.md`** - Port assignments reference


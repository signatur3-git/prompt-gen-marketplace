# OAuth Implementation Checklist for Web App

## Understanding the Flow

The `redirect_uri` is **YOUR WEB APP's callback URL**, not the marketplace's URL.

### The Two Applications

1. **Marketplace** (http://localhost:3000 or https://prompt-gen-marketplace-production.up.railway.app)
   - Backend API + OAuth Authorization Server
   - Has its own frontend (works perfectly already!)
   - Shows the consent screen to users
   - Issues authorization codes and access tokens

2. **External Web App** (http://localhost:5173 or https://signatur3-git.github.io/prompt-gen-web)
   - Separate application that wants to integrate with marketplace
   - Needs to implement the OAuth client flow
   - Must have a `/oauth/callback` route to receive authorization codes

## What You Need to Implement in Your Web App

### 1. Create `/oauth/callback` Route

```typescript
// In your web app's router (e.g., Vue Router)
{
  path: '/oauth/callback',
  name: 'OAuthCallback',
  component: OAuthCallbackPage
}
```

### 2. Implement the OAuth Callback Handler

```typescript
// OAuthCallbackPage.vue or similar
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  // 1. Extract authorization code from URL
  const code = route.query.code as string;
  const state = route.query.state as string;
  const error = route.query.error as string;

  // 2. Check for errors (user denied)
  if (error) {
    console.error('Authorization failed:', error);
    router.push('/login?error=oauth_denied');
    return;
  }

  // 3. Verify state (CSRF protection)
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) {
    console.error('State mismatch - possible CSRF attack');
    router.push('/login?error=csrf');
    return;
  }

  // 4. Retrieve code_verifier we saved earlier
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
  if (!codeVerifier) {
    console.error('No code verifier found');
    router.push('/login?error=missing_verifier');
    return;
  }

  // 5. Exchange code for access token
  try {
    const response = await fetch('http://localhost:3000/api/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        client_id: 'prompt-gen-web',
        redirect_uri: `${window.location.origin}/oauth/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const data = await response.json();

    // 6. Store access token
    sessionStorage.setItem('marketplace_access_token', data.access_token);

    // 7. Clean up temporary OAuth data
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');

    // 8. Redirect to success page
    router.push('/dashboard');
  } catch (err) {
    console.error('Token exchange error:', err);
    router.push('/login?error=token_exchange');
  }
});
```

### 3. Initiate OAuth Flow (Login Button)

```typescript
// In your login page or "Connect to Marketplace" button
async function connectToMarketplace() {
  // 1. Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  // 2. Save for later
  sessionStorage.setItem('oauth_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  // 3. Build authorization URL - IMPORTANT: Use marketplace's FRONTEND URL, not API!
  //    This shows the marketplace's consent screen UI
  const authUrl = new URL('http://localhost:5174/oauth/authorize'); // ← Frontend port!
  authUrl.searchParams.set('client_id', 'prompt-gen-web');
  authUrl.searchParams.set('redirect_uri', `${window.location.origin}/oauth/callback`);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  // 4. Redirect user to marketplace consent screen
  window.location.href = authUrl.toString();
}

// Helper functions
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

### 4. Use Access Token for API Calls

```typescript
// Make authenticated requests to marketplace API
const token = sessionStorage.getItem('marketplace_access_token');

const response = await fetch('http://localhost:3000/api/v1/packages', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const packages = await response.json();
```

## Production Deployment

### The redirect URIs are already configured:

✅ **Local dev:** `http://localhost:5173/oauth/callback`  
✅ **Production:** `https://signatur3-git.github.io/prompt-gen-web/oauth/callback`

Both are already in the seed file and will be added when you run `npm run db:seed`.

### If you need to update production:

1. **Update the seed file** (`database/seed-oauth-clients.ts`) if the URL changes
2. **Re-seed the production database:**
   ```bash
   # On Railway or production environment
   npm run db:seed
   ```

3. **Update marketplace URL in the external web app** to point to production:
   ```typescript
   const MARKETPLACE_URL = process.env.VITE_MARKETPLACE_URL 
     || 'https://prompt-gen-marketplace-production.up.railway.app';
   ```

## Configuration Variables

### In the Marketplace

- `OAUTH_CLIENT_ID` (default: `prompt-gen-web`) - The client ID your web app uses
- `OAUTH_REDIRECT_URI` (default: `http://localhost:5173/oauth/callback`) - This is just a default; actual validation uses the seeded `redirect_uris` array

### In Your Web App

- `VITE_MARKETPLACE_URL` - Base URL of the marketplace API
- `VITE_OAUTH_CLIENT_ID` - Should be `prompt-gen-web`

## Security Checklist

- ✅ Always use PKCE with `S256` (SHA-256)
- ✅ Validate `state` parameter to prevent CSRF
- ✅ Store `code_verifier` in `sessionStorage` (not `localStorage`)
- ✅ Never expose `code_verifier` to URL or logs
- ✅ Handle authorization code immediately (expires in 10 minutes)
- ✅ Access tokens expire in 1 hour
- ✅ Clean up temporary OAuth data after successful token exchange

## ⚠️ Critical Warnings

### 1. Redirect to FRONTEND, Not API!

**❌ WRONG - This will fail:**
```typescript
// Don't redirect to the API endpoint!
window.location.href = 'http://localhost:3000/api/v1/oauth/authorize?...';
```

**✅ CORRECT - Use marketplace frontend URL:**
```typescript
// Redirect to the Vue frontend route that shows the consent screen
window.location.href = 'http://localhost:5174/oauth/authorize?...';
```

**Why?** The marketplace's frontend route `/oauth/authorize` renders the consent screen UI. The API endpoint `/api/v1/oauth/authorize` is only called by the frontend *after* the user clicks "Authorize".

### 2. User Must Be Logged In to Marketplace

If the user is not logged in to the marketplace:
1. Marketplace redirects to its login page
2. User logs in with their keypair
3. Marketplace redirects BACK to the authorization page
4. User sees consent screen and can approve

**For testing:** Make sure you have a marketplace account and can log in before testing OAuth!

### 3. Use Correct Ports in Development

- **Marketplace backend API:** `http://localhost:3000`
- **Marketplace frontend:** `http://localhost:5174` ← Authorization page
- **External web app:** `http://localhost:5173` ← Your callback

## Testing Locally

1. Start marketplace: `cd marketplace && npm run dev`
2. Start web app: `cd web-app && npm run dev`
3. In web app, click "Connect to Marketplace"
4. You'll be redirected to `http://localhost:3000/oauth/authorize`
5. Log in to marketplace (if not already)
6. Approve authorization
7. You'll be redirected back to `http://localhost:5173/oauth/callback?code=...`
8. Your callback handler exchanges code for token
9. You're now authenticated!

## Common Issues

### "Invalid redirect_uri"
- Make sure your web app's callback URL is in the `redirect_uris` array in the seed file
- Re-seed the database after updating

### "State mismatch"
- The `state` parameter must match what you saved before redirecting
- Check that `sessionStorage` isn't being cleared

### "Invalid code_verifier"
- Make sure you're storing the verifier before redirecting
- Verify you're retrieving the same verifier in the callback

### "Authorization code expired"
- Codes expire in 10 minutes
- User must complete the flow quickly
- Handle this gracefully by redirecting back to login


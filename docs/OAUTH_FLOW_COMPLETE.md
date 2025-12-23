# OAuth Flow - Complete Implementation Guide

## The Problem You Encountered

When the external web app redirects to the marketplace's OAuth authorization page, there are two issues:

1. **User must be logged in to the marketplace first**
2. **After login, the redirect back to the authorization page was going to homepage instead**

## The Correct Flow

### Scenario: User is NOT logged in to marketplace

```
┌─────────────────────────────────────────────────────────┐
│  External Web App (localhost:5173)                      │
│  User clicks "Connect to Marketplace"                   │
└─────────────────────────────────────────────────────────┘
              │
              │ 1. Generate PKCE verifier/challenge
              │    Save in sessionStorage
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Redirect to Marketplace Authorization                  │
│  http://localhost:3000/oauth/authorize?                │
│    client_id=prompt-gen-web&                           │
│    redirect_uri=http://localhost:5173/oauth/callback& │
│    code_challenge=...&                                  │
│    code_challenge_method=S256&                         │
│    state=...                                            │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Marketplace Frontend (localhost:5174)                  │
│  /oauth/authorize route (AuthorizePage.vue)           │
│                                                          │
│  ⚠️ Checks: Is user logged in?                          │
│     sessionStorage.getItem('marketplace_token')        │
│                                                          │
│  ❌ NOT logged in!                                       │
│  → Save OAuth params to sessionStorage                  │
│  → Redirect to /login?redirect=/oauth/authorize?...    │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Marketplace Login Page                                 │
│  User uploads keypair or pastes secret key             │
│  Signs challenge and gets JWT token                     │
│                                                          │
│  ✅ Login successful!                                    │
│  → Store token in sessionStorage                        │
│  → Check for ?redirect param                            │
│  → Redirect to saved OAuth authorization URL            │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Back to /oauth/authorize (AuthorizePage.vue)         │
│  ✅ Now user IS logged in (has token)                   │
│  → Shows consent screen                                 │
│  → User clicks "Authorize"                              │
│  → POST to /api/v1/oauth/authorize                     │
│  → Receives authorization code                          │
│  → Redirects to external web app callback              │
└─────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  External Web App Callback                              │
│  http://localhost:5173/oauth/callback?code=...&state=..│
│                                                          │
│  → Verify state                                         │
│  → Retrieve code_verifier from sessionStorage          │
│  → Exchange code for access token                       │
│  → Store access token                                   │
│  → Make authenticated API calls                         │
└─────────────────────────────────────────────────────────┘
```

## The Issues & Solutions

### Issue 1: "Missing Header Error"

**Problem:** External web app redirected to marketplace but didn't include required OAuth params.

**Solution:** External web app must redirect to:
```
http://localhost:3000/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...
```

NOT just:
```
http://localhost:3000/oauth/authorize
```

### Issue 2: "Login Redirected to Homepage"

**Problem:** LoginPage.vue doesn't respect the `?redirect=` query parameter.

**Current Code:**
```typescript
// After successful login - ALWAYS goes to homepage
setTimeout(() => {
  router.push('/');
}, 1500);
```

**What it SHOULD do:**
```typescript
// After successful login - check for redirect param
const redirectTo = route.query.redirect as string;
setTimeout(() => {
  router.push(redirectTo || '/dashboard');
}, 1500);
```

### Issue 3: AuthorizePage Loses OAuth Params on Redirect

**Problem:** When AuthorizePage redirects to login, it constructs:
```typescript
const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
```

This SHOULD work, but the LoginPage doesn't use it!

## Fixed Flow Implementation

### Step 1: External Web App - Initiate OAuth

```typescript
// In your external web app
async function connectToMarketplace() {
  // Generate PKCE
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  // Save for later
  sessionStorage.setItem('oauth_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  // Build authorization URL - MUST use marketplace's FRONTEND route
  const authUrl = new URL('http://localhost:5174/oauth/authorize'); // ← Frontend port!
  authUrl.searchParams.set('client_id', 'prompt-gen-web');
  authUrl.searchParams.set('redirect_uri', 'http://localhost:5173/oauth/callback');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  // Redirect user
  window.location.href = authUrl.toString();
}
```

### Step 2: Fix Marketplace LoginPage (NEEDED)

The LoginPage needs to respect the `?redirect=` parameter:

```typescript
// In LoginPage.vue - after successful login
const route = useRoute();
const redirectPath = route.query.redirect as string;

setTimeout(() => {
  if (redirectPath) {
    // Decode and navigate to the redirect URL (preserves OAuth params)
    router.push(decodeURIComponent(redirectPath));
  } else {
    // No redirect specified - go to dashboard
    router.push('/dashboard');
  }
}, 1500);
```

### Step 3: External Web App - Handle Callback

```typescript
// In your external web app's /oauth/callback route
onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  
  // Check for errors
  if (params.has('error')) {
    console.error('Authorization failed:', params.get('error'));
    return;
  }

  // Verify state
  const returnedState = params.get('state');
  const savedState = sessionStorage.getItem('oauth_state');
  if (returnedState !== savedState) {
    console.error('State mismatch - CSRF attack?');
    return;
  }

  // Get code
  const code = params.get('code');
  if (!code) {
    console.error('No authorization code received');
    return;
  }

  // Exchange code for token
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
  const response = await fetch('http://localhost:3000/api/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
      client_id: 'prompt-gen-web',
      redirect_uri: 'http://localhost:5173/oauth/callback',
      code_verifier: codeVerifier,
    }),
  });

  const { access_token } = await response.json();
  
  // Store token
  sessionStorage.setItem('marketplace_access_token', access_token);
  
  // Clean up
  sessionStorage.removeItem('oauth_state');
  sessionStorage.removeItem('oauth_code_verifier');
  
  // Success!
  router.push('/dashboard');
});
```

## Critical Points

### 1. ⚠️ Redirect to FRONTEND, not API

**WRONG:**
```typescript
// This won't show the consent screen UI!
window.location.href = 'http://localhost:3000/api/v1/oauth/authorize?...';
```

**CORRECT:**
```typescript
// This shows the marketplace's consent screen UI
window.location.href = 'http://localhost:5174/oauth/authorize?...';
```

The marketplace's **frontend route** `/oauth/authorize` renders the Vue page that:
- Checks if user is logged in
- Shows the consent screen
- Calls the API endpoint `/api/v1/oauth/authorize` when user clicks "Authorize"

### 2. ⚠️ Use Correct Ports

- **Marketplace backend (API):** http://localhost:3000
- **Marketplace frontend:** http://localhost:5174
- **External web app:** http://localhost:5173

### 3. ⚠️ User Must Be Logged In First

The authorization flow requires the user to:
1. Have a marketplace account (registered)
2. Be logged in to the marketplace (have JWT token)
3. Then authorize the external app

If not logged in, the marketplace will redirect to its login page, then back to the authorization page.

## Testing the Flow

### Prerequisites
```bash
# Terminal 1: Start marketplace
cd marketplace
npm run dev:full
# Backend: localhost:3000
# Frontend: localhost:5174

# Terminal 2: Start external web app
cd external-web-app
npm run dev
# Frontend: localhost:5173
```

### Test Steps

1. **In external web app (localhost:5173):**
   - Click "Connect to Marketplace"
   - Should redirect to `localhost:5174/oauth/authorize?...`

2. **On marketplace (localhost:5174):**
   - If not logged in → redirects to `localhost:5174/login?redirect=...`
   - Login with your keypair
   - **SHOULD** redirect back to `/oauth/authorize?...` (CURRENTLY BROKEN - needs fix)

3. **After login:**
   - See consent screen
   - Click "Authorize"
   - Redirects to `localhost:5173/oauth/callback?code=...&state=...`

4. **Back in external web app:**
   - Callback handler exchanges code for token
   - Stores token
   - Makes API calls with `Authorization: Bearer <token>`

## What Needs to be Fixed in Marketplace

**File:** `frontend/src/pages/LoginPage.vue`

**Current behavior:** Always redirects to `/` after login

**Needed behavior:** Check for `?redirect=` query param and use it

See the code fix in Step 2 above.

## Summary

The OAuth flow works like this:

1. **External web app** redirects to **marketplace frontend** `/oauth/authorize`
2. **Marketplace frontend** checks if user is logged in
3. If not, redirects to login page with `?redirect=/oauth/authorize?...`
4. **Login page** (after successful login) MUST redirect to the saved redirect param
5. Back at `/oauth/authorize`, now logged in, user sees consent screen
6. User approves, marketplace calls its own API `/api/v1/oauth/authorize`
7. API generates code and returns redirect URL
8. Marketplace frontend redirects to external web app callback
9. External web app exchanges code for token
10. External web app uses token for API calls

**The missing piece:** LoginPage doesn't respect the `?redirect=` parameter! 🔧


# OAuth 2.0 Flow - Prompt Gen Marketplace

## The Confusion: What is `redirect_uri`?

The `redirect_uri` is **NOT an endpoint on the marketplace backend**. It's an endpoint **on the web app (frontend)** where the authorization code gets sent back to.

## The Actual Flow

### Scenario: User wants to authorize an external web app to access their marketplace account

**Important:** This is for **external apps** integrating with the marketplace, not the marketplace's own frontend.

- **External Web App:** https://signatur3-git.github.io/prompt-gen-web (production) or http://localhost:5173 (local dev)
- **Marketplace:** https://prompt-gen-marketplace-production.up.railway.app (production) or http://localhost:3000 (local dev)

```
┌─────────────────────────────────────────────────┐
│   External Web App                              │
│   (https://signatur3-git.github.io/prompt-gen-web) │
│   or http://localhost:5173 (local dev)         │
└─────────────────────────────────────────────────┘
         │
         │ 1. User clicks "Connect to Marketplace"
         │    Web app redirects to marketplace authorization page
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Marketplace Backend + Frontend                             │
│  (e.g., http://localhost:3000)                             │
│                                                              │
│  GET /oauth/authorize?                                      │
│    client_id=prompt-gen-web&                               │
│    redirect_uri=http://localhost:5173/oauth/callback&     │  ← This is the WEB APP's callback!
│    code_challenge=...&                                      │
│    code_challenge_method=S256&                             │
│    state=...                                                │
│                                                              │
│  ┌──────────────────────────────────────┐                  │
│  │ 2. Shows authorization page          │                  │
│  │    "Allow 'Prompt Gen Web' to        │                  │
│  │     access your account?"            │                  │
│  │                                       │                  │
│  │    [Approve]  [Deny]                │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         │ 3. User clicks Approve                           │
│         │                                                    │
│         ▼                                                    │
│  POST /api/v1/oauth/authorize                              │
│    { approved: true, ... }                                 │
│         │                                                    │
│         │ 4. Backend generates authorization code          │
│         │                                                    │
│         ▼                                                    │
│  Response: {                                                │
│    "redirect_uri": "http://localhost:5173/oauth/callback?code=XYZ&state=..."  │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
         │
         │ 5. Frontend redirects user back to web app
         │    window.location.href = "http://localhost:5173/oauth/callback?code=XYZ"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Web App Callback Handler                                   │
│  (http://localhost:5173/oauth/callback)                    │
│                                                              │
│  6. Extracts code from URL query params                    │
│     const code = new URLSearchParams(location.search).get('code')  │
│                                                              │
│  7. Exchanges code for access token                        │
│     POST http://localhost:3000/api/v1/oauth/token          │
│     {                                                        │
│       grant_type: "authorization_code",                    │
│       code: "XYZ",                                          │
│       client_id: "prompt-gen-web",                         │
│       redirect_uri: "http://localhost:5173/oauth/callback", │
│       code_verifier: "..." (saved earlier)                 │
│     }                                                        │
│                                                              │
│  8. Receives access token                                  │
│     { "access_token": "...", "expires_in": 3600 }         │
│                                                              │
│  9. Stores token and makes API calls                       │
│     sessionStorage.setItem('token', access_token)          │
│                                                              │
│     fetch('http://localhost:3000/api/v1/packages', {      │
│       headers: {                                            │
│         Authorization: `Bearer ${access_token}`            │
│       }                                                      │
│     })                                                       │
└─────────────────────────────────────────────────────────────┘
```

## Key Points

### 1. Two Separate Applications

- **Marketplace** (http://localhost:3000)
  - Backend API + Authorization Server
  - Has a built-in frontend for showing the authorization page
  
- **Web App** (http://localhost:5173)
  - Your separate frontend application
  - Wants to access the marketplace API on behalf of the user

### 2. The `redirect_uri` Parameter

**What it is:** The URL on the **WEB APP** where the authorization code gets sent

**What it's NOT:** An endpoint on the marketplace backend

**Examples:**
- Local dev: `http://localhost:5173/oauth/callback`
- Production: `https://your-web-app.com/oauth/callback`

### 3. The `OAUTH_REDIRECT_URI` Config Variable

This is **only used for the marketplace's own built-in web client** if you were testing OAuth from within the marketplace's own frontend. It's a default/example value.

**For your external web app, you specify the redirect_uri when initiating the flow.**

## Production Configuration

### Web App Seed (Current)

```typescript
{
  client_id: 'prompt-gen-web',
  redirect_uris: [
    'http://localhost:5173/oauth/callback',  // Local dev
    'https://prompt-gen-marketplace-production.up.railway.app/oauth/callback'  // Production
  ]
}
```

### What This Means

**WRONG:** The production redirect URI is the marketplace's own domain ❌

**RIGHT:** The production redirect URI should be YOUR WEB APP's domain ✅

For example:
```typescript
{
  client_id: 'prompt-gen-web',
  redirect_uris: [
    'http://localhost:5173/oauth/callback',           // Local dev
    'https://my-actual-web-app.example.com/oauth/callback'  // Production
  ]
}
```

## Common Confusion

### "Why does the marketplace redirect back to itself?"

It doesn't! The current seed configuration has a **placeholder** production URL that happens to be the marketplace's domain. This needs to be updated to your actual web app's production domain once deployed.

### "What is the marketplace's authorization page?"

The marketplace has its own frontend (at `/oauth/authorize`) that shows a consent screen. This is part of the marketplace, not your web app. After the user approves, the marketplace redirects to **your web app's callback**.

## Implementation Checklist

For your web app to implement OAuth:

- [ ] Create a `/oauth/callback` route in your web app
- [ ] Generate PKCE verifier and challenge
- [ ] Redirect user to marketplace authorization page with challenge
- [ ] Handle callback with authorization code
- [ ] Exchange code for access token using verifier
- [ ] Store token and use for API requests
- [ ] Update production redirect_uri in seed file to your web app's domain

## Security Notes

- The `redirect_uri` must be pre-registered (in the seed file)
- The backend validates that the `redirect_uri` in the request matches a registered URI
- This prevents attackers from redirecting the authorization code to their own sites
- PKCE prevents code interception attacks (even if the code is stolen, the attacker doesn't have the verifier)


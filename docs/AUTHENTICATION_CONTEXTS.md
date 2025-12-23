# Authentication Contexts - Understanding the Separation

## Why OAuth Login ≠ Marketplace Frontend Login

### The Situation

You've successfully completed OAuth authentication from the external web app, and it can call the marketplace API. However, when you visit the marketplace's own frontend, it shows you as "not logged in."

**This is expected behavior!** Here's why:

## Two Separate Authentication Contexts

### 1. Marketplace Frontend Authentication

**URL:** `http://localhost:5174` (or production marketplace domain)  
**Method:** Keypair-based challenge-response (Ed25519)  
**Token Storage:** `sessionStorage.getItem('marketplace_token')`  
**Token Type:** JWT from `/api/v1/auth/login`

**Flow:**
1. User visits marketplace frontend
2. Clicks "Login"
3. Uploads keypair file or pastes secret key
4. Marketplace sends challenge
5. Frontend signs challenge with secret key
6. Marketplace verifies signature and returns JWT
7. JWT stored in sessionStorage
8. Frontend uses JWT for authenticated requests

### 2. OAuth Authentication (External Web App)

**URL:** `http://localhost:5173` (external web app)  
**Method:** OAuth 2.0 Authorization Code flow with PKCE  
**Token Storage:** Separate sessionStorage (different origin)  
**Token Type:** OAuth access token from `/api/v1/oauth/token`

**Flow:**
1. User clicks "Connect to Marketplace" in external web app
2. Redirects to marketplace authorization page (`localhost:5174/oauth/authorize`)
3. **Marketplace checks: Are you logged in?**
   - If YES: Shows authorization consent screen
   - If NO: Redirects to login page first
4. User approves access (clicks "Authorize")
5. Marketplace redirects back with authorization code
6. External web app exchanges code for access token
7. Access token stored in **external web app's sessionStorage**
8. External web app uses token for API calls

**Important:** The OAuth flow requires you to be logged into the marketplace frontend (step 3), but the resulting OAuth token is stored separately in the external web app.

## Why They're Separate

### 1. **Different Origins = Different Storage**

`sessionStorage` is **isolated per origin** (protocol + domain + port):

- `http://localhost:5173` has its own sessionStorage
- `http://localhost:5174` has its own sessionStorage

**They cannot share data!** This is a browser security feature (Same-Origin Policy).

### 2. **Different Authentication Methods**

- **Marketplace Frontend:** Direct keypair authentication (you control your private key)
- **OAuth:** Delegated authorization (external app acts on your behalf)

### 3. **Different Use Cases**

- **Marketplace Frontend:** You're using the marketplace directly
- **OAuth:** An external app is using the marketplace on your behalf

## What This Means in Practice

### The Confusing Scenario (What You Experienced)

**Timeline:**
1. ✅ You logged into marketplace frontend (keypair) → Token in sessionStorage
2. ✅ You initiated OAuth from external web app → Redirected to marketplace
3. ✅ Marketplace saw you were logged in → Showed authorization screen (no keypair needed!)
4. ✅ You approved → Got OAuth token in external web app
5. ❌ Later, you visited marketplace frontend → Shows "not logged in"

**What happened?** Your marketplace frontend sessionStorage was cleared between steps 4 and 5!

**Why?**
- **You closed the browser tab/window** (sessionStorage is cleared on tab close)
- **You restarted your browser** (sessionStorage doesn't persist)
- **You opened a new tab/window** (sessionStorage doesn't share between tabs)
- **The marketplace token expired** (24-hour expiration)

**Meanwhile:** The external web app still has its OAuth token (stored in its own sessionStorage), so it continues to work!

### Key Insight

During OAuth authorization (step 3), you were logged into the marketplace. But that marketplace login was stored in **sessionStorage**, which is:
- ✅ Temporary (cleared on tab close/browser restart)
- ✅ Tab-specific (doesn't share between tabs/windows)
- ✅ Origin-specific (marketplace's sessionStorage ≠ external app's sessionStorage)

So even though you were logged in during OAuth, that login state can disappear later while the OAuth token persists!

### Scenario 1: You Log In via OAuth
✅ External web app can call marketplace API  
⚠️ Marketplace frontend shows "not logged in" (if sessionStorage was cleared)

**What happened:** You logged into marketplace to authorize OAuth, but then the marketplace's sessionStorage was cleared.

**To access marketplace frontend:** Log in again at `http://localhost:5174/login`

### Scenario 2: You Log In to Marketplace Frontend
✅ Marketplace frontend works normally  
❌ External web app still needs OAuth authorization

**To authorize external app:** Complete the OAuth flow from the external web app

### Scenario 3: Both Are Needed
If you want to use both:
1. Log in to marketplace frontend (keypair login)
2. Separately, authorize the external web app via OAuth

Both authentications are independent!

## Is This a Bug?

**No, this is correct OAuth behavior!**

OAuth is designed for **cross-application authorization**, not single sign-on (SSO). The marketplace is correctly:

1. ✅ Allowing external apps to get delegated access via OAuth
2. ✅ Maintaining its own separate authentication for direct users
3. ✅ Keeping authentication contexts isolated by origin

## If You Want Single Sign-On (SSO)

If you want logging in to one to automatically log you into the other, you'd need to implement:

1. **Shared authentication system** (e.g., identity provider)
2. **Cross-origin token sharing** (requires secure mechanisms like:
   - Server-side session with cookies
   - OAuth as primary auth for both apps
   - Token exchange mechanisms)

This is more complex and typically only needed when:
- Multiple apps share the same identity provider
- You want "login once, access everywhere"
- You're building a unified ecosystem

## Current Architecture (By Design)

```
┌─────────────────────────────────┐
│  Marketplace Frontend           │
│  localhost:5174                 │
│                                 │
│  Login Method: Keypair          │
│  Storage: sessionStorage        │
│  Token: JWT (keypair auth)      │
└─────────────────────────────────┘
         │
         │ Both call same API
         ▼
┌─────────────────────────────────┐
│  Marketplace API                │
│  localhost:3000                 │
│                                 │
│  Accepts:                       │
│  - JWT tokens (keypair auth)    │
│  - OAuth access tokens          │
└─────────────────────────────────┘
         ▲
         │ Both call same API
         │
┌─────────────────────────────────┐
│  External Web App               │
│  localhost:5173                 │
│                                 │
│  Login Method: OAuth 2.0        │
│  Storage: separate sessionStorage│
│  Token: OAuth access token      │
└─────────────────────────────────┘
```

Both frontends call the same API, but maintain separate authentication!

## Summary

**Question:** "Why am I not logged into the marketplace frontend after OAuth login?"

**Answer:** You WERE logged in during OAuth (that's how you authorized the external app), but the marketplace's **sessionStorage was cleared afterward** (tab close, browser restart, or new tab). Meanwhile, the external web app still has its OAuth token in its own separate sessionStorage.

**Why this is confusing:**
1. During OAuth, marketplace checks if you're logged in (sessionStorage)
2. If logged in → Shows authorization screen (no keypair needed)
3. You approve → External app gets OAuth token
4. Later, marketplace frontend appears logged out because its sessionStorage was cleared
5. External app still works because its OAuth token is stored separately!

**Key Point:** The marketplace and external web app have completely separate sessionStorage. Clearing one doesn't affect the other.

**This is intentional and secure.** OAuth provides delegated access for external apps, not automatic login to the marketplace's own UI.

**To use both:**
1. Use OAuth for external web app integration ✅ (already working!)
2. Log in to marketplace frontend whenever you want to use it directly ✅ (re-login after sessionStorage clears)


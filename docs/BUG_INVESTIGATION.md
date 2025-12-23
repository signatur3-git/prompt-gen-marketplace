# CRITICAL BUG INVESTIGATION

## The Bug Report

**User Reports:**
- Not logged into marketplace (sees "Login" not "Dashboard" at localhost:5174)
- Starting OAuth flow from external web app
- **BUG:** Shows consent screen WITHOUT asking for keypair first

**Expected Behavior:**
If not logged in → Should redirect to login page → Ask for keypair → Then show consent

**Actual Behavior:**
If not logged in → Shows consent screen immediately (WRONG!)

## Possible Causes

### 1. sessionStorage Still Has Data
Even though the navbar shows "not logged in", maybe sessionStorage still has `marketplace_user` data?

**How to check:**
```javascript
// In browser console at localhost:5174
console.log('marketplace_user:', sessionStorage.getItem('marketplace_user'));
console.log('marketplace_token:', sessionStorage.getItem('marketplace_token'));
```

### 2. The Navbar Check vs AuthPage Check Are Different
Maybe `App.vue` checks token differently than `AuthorizePage.vue`?

**App.vue checks:**
```typescript
const token = sessionStorage.getItem('marketplace_token');
isLoggedIn.value = !!token;
```

**AuthorizePage checks:**
```typescript
const userData = sessionStorage.getItem('marketplace_user');
if (!userData) { redirect to login }
```

**Possible bug:** Token is null but user data still exists?

### 3. Timing Issue
Maybe the check happens before sessionStorage is read?

### 4. Error in Flow
Maybe the catch block is swallowing the redirect?

## Debugging Steps

### Step 1: Check sessionStorage Right Now

**Action:** Open localhost:5174, open DevTools console, run:
```javascript
console.log({
  token: sessionStorage.getItem('marketplace_token'),
  user: sessionStorage.getItem('marketplace_user'),
  all: Object.keys(sessionStorage)
});
```

**Expected if truly logged out:**
```javascript
{
  token: null,
  user: null,
  all: []
}
```

**If different:** There's stale data in sessionStorage!

### Step 2: Check What AuthorizePage Actually Sees

**Action:** Add debug logging to AuthorizePage

**In `frontend/src/pages/AuthorizePage.vue` line 119, temporarily add:**
```typescript
// Get user info
const userData = sessionStorage.getItem('marketplace_user');
console.log('🔍 DEBUG: userData =', userData);
console.log('🔍 DEBUG: all sessionStorage =', Object.keys(sessionStorage));

if (!userData) {
  console.log('🔍 DEBUG: No userData, should redirect to login');
  const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  router.push(loginUrl);
  return;
}
console.log('🔍 DEBUG: userData found, continuing to consent screen');
```

### Step 3: Reproduce the Bug

**Action:**
1. Make sure you're logged out (see "Login" in navbar)
2. Clear sessionStorage manually: `sessionStorage.clear()`
3. Verify: `Object.keys(sessionStorage)` returns `[]`
4. Start OAuth flow from external web app
5. Watch console logs

**Expected:** Should redirect to login  
**Actual (bug):** Shows consent screen

## Hypothesis

**I suspect:** The navbar shows "Login" because `marketplace_token` is null, but `marketplace_user` still exists in sessionStorage (stale data).

**Why this could happen:**
- Token expired or was deleted
- But user data wasn't cleared at the same time
- AuthorizePage only checks `marketplace_user`, not `marketplace_token`
- So it thinks you're logged in!

**The bug:** AuthorizePage should check BOTH token and user data, or better yet, just check the token and fetch user data from the API.

## Proposed Fix

### Option 1: Check Token Instead of User Data

```typescript
// Get token
const token = sessionStorage.getItem('marketplace_token');
if (!token) {
  // Not logged in - redirect to login
  const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  router.push(loginUrl);
  return;
}

// Get user info (or fetch from API if needed)
const userData = sessionStorage.getItem('marketplace_user');
user.value = userData ? JSON.parse(userData) : null;
```

### Option 2: Validate Token with Backend

```typescript
// Check if user is logged in by validating token
const token = sessionStorage.getItem('marketplace_token');
if (!token) {
  router.push('/login?redirect=...');
  return;
}

// Try to fetch user info with token
try {
  const userRes = await fetch('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!userRes.ok) {
    // Token is invalid
    sessionStorage.clear();
    router.push('/login?redirect=...');
    return;
  }
  user.value = await userRes.json();
} catch (err) {
  router.push('/login?redirect=...');
  return;
}
```

### Option 3: Check Both and Clear Inconsistent State

```typescript
// Get user info
const userData = sessionStorage.getItem('marketplace_user');
const token = sessionStorage.getItem('marketplace_token');

// If either is missing, clear both and redirect
if (!userData || !token) {
  sessionStorage.removeItem('marketplace_user');
  sessionStorage.removeItem('marketplace_token');
  const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  router.push(loginUrl);
  return;
}

user.value = JSON.parse(userData);
```

## Action Required

Please run the debugging steps above and report what you see in:
1. sessionStorage contents at localhost:5174
2. Console logs when starting OAuth flow
3. Whether you see the redirect to login or go straight to consent

This will help me identify the exact bug and implement the correct fix!


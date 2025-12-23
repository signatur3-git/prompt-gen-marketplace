# Critical Discovery: sessionStorage is Different Between Tabs!

## What User Reported

**Tab 1 (logged in):**
```javascript
sessionStorage.getItem('marketplace_token')
// Returns: "eyJhbGciOiJ..."  ✅ Has token
```

**Tab 2 (logged out):**
```javascript
sessionStorage.getItem('marketplace_token')
// Returns: null  ❌ No token
```

## This Should Be IMPOSSIBLE!

sessionStorage is shared across all tabs from the **same origin** (protocol + domain + port).

If both tabs are on `http://localhost:5174`, they MUST share the same sessionStorage.

## Possible Explanations

### 1. **Tabs Are On Different URLs**

Even a small difference makes them separate origins:

❌ Different:
- Tab 1: `http://localhost:5174` 
- Tab 2: `https://localhost:5174` (https vs http)

❌ Different:
- Tab 1: `http://localhost:5174`
- Tab 2: `http://localhost:5173` (different port)

✅ Same origin (should share storage):
- Tab 1: `http://localhost:5174/home`
- Tab 2: `http://localhost:5174/login`
- (Path doesn't matter, only protocol + domain + port)

### 2. **One Tab is in Private/Incognito Mode**

Private mode has separate storage from normal mode.

### 3. **Different Browser Profiles**

If using different Chrome profiles, they have separate storage.

### 4. **Browser Bug or Extension Interference**

Some extensions can isolate storage per tab.

## Immediate Debug Steps

### In BOTH tabs, run this in console:

```javascript
console.log({
  url: window.location.href,
  origin: window.location.origin,
  protocol: window.location.protocol,
  hostname: window.location.hostname,
  port: window.location.port,
  token: sessionStorage.getItem('marketplace_token'),
  isPrivate: (function() {
    try {
      sessionStorage.setItem('test', '1');
      sessionStorage.removeItem('test');
      return false;
    } catch(e) {
      return true;
    }
  })()
});
```

This will show us:
- Exact URL of each tab
- Whether they're on the same origin
- Whether either is in private mode

## My Hypothesis

**I bet the tabs are NOT on the exact same origin.**

Most likely:
- Tab 1: `http://localhost:5174` (with trailing slash or path)
- Tab 2: `http://localhost:5173` (different port - external web app?)

Or:
- One tab went through the OAuth flow and landed on a slightly different URL
- The other tab was opened directly

## The Solution (Once We Confirm)

If tabs are on **different origins**, they CAN'T share sessionStorage by design. This is browser security.

**Options:**
1. Make sure both tabs navigate to exact same origin
2. Use `localStorage` instead (also origin-bound, but persists)
3. Use cookies (can be shared across subdomains if configured)
4. Implement a proper token refresh/validation system

## User's Actual Results

**Both tabs report EXACTLY the same URL:**
- Tab 1 (logged in): `http://localhost:5174/`
- Tab 2 (logged out): `http://localhost:5174/`

**Yet they have different sessionStorage:**
- Tab 1: Has `marketplace_token` ✅
- Tab 2: `marketplace_token` is null ❌

**This violates browser sessionStorage spec!** Same origin MUST share sessionStorage.

## Possible Causes (Very Unusual)

### 1. **Browser Container/Profile Separation**
- Firefox Multi-Account Containers
- Chrome with different profiles
- Brave with different profiles

### 2. **sessionStorage vs localStorage Confusion**
Maybe one is using localStorage and one is using sessionStorage?

### 3. **Browser Extension Interference**
Some privacy/security extensions can isolate storage per tab.

### 4. **Service Worker or Cache Issue**
Maybe a service worker is intercepting storage access?

### 5. **The Tabs Were Opened At Different Times**
- Tab 2 was opened BEFORE login
- Tab 1 was opened AFTER login
- sessionStorage was cleared between opening the tabs
- Tab 2 never got the update

## Advanced Diagnostic

**Please run this in BOTH tabs:**

```javascript
// Full diagnostic
const diagnostic = {
  url: window.location.href,
  origin: window.location.origin,
  
  // Check ALL storage
  sessionStorage_keys: Object.keys(sessionStorage),
  sessionStorage_length: sessionStorage.length,
  localStorage_keys: Object.keys(localStorage),
  localStorage_length: localStorage.length,
  
  // Check for token in both
  session_token: sessionStorage.getItem('marketplace_token'),
  local_token: localStorage.getItem('marketplace_token'),
  
  // Browser info
  userAgent: navigator.userAgent,
  
  // Try to modify storage
  canWriteSession: (function() {
    try {
      sessionStorage.setItem('test_write', 'test');
      const result = sessionStorage.getItem('test_write') === 'test';
      sessionStorage.removeItem('test_write');
      return result;
    } catch(e) {
      return false;
    }
  })()
};

console.log('=== DIAGNOSTIC ===');
console.log(JSON.stringify(diagnostic, null, 2));
console.log('==================');
```

## My Current Theory

**Tab 2 was opened in the past, before you logged in.**

Timeline:
1. Yesterday: Opened Tab 2 → No login → No token in sessionStorage
2. Today: Logged in via Tab 1 or external OAuth → Token stored
3. **But Tab 2's sessionStorage is from yesterday's session!**

**Why?** Each browser tab can have its own sessionStorage "session" in some browsers. The session only syncs when:
- The tab is refreshed/reloaded
- The tab navigates to a new page
- Storage events fire (but may not always work)

## The Real Fix: Force Tab Refresh

**Try this in Tab 2:**
1. Hard refresh (Ctrl+Shift+R)
2. Check `sessionStorage.getItem('marketplace_token')` again
3. Does it NOW have the token?

If YES, then the issue is that Tab 2 had an old sessionStorage "snapshot" and needed a refresh to sync.

## Next Step

**Please run that diagnostic script in BOTH tabs and tell me the results.**

Especially interested in:
- `sessionStorage_keys` - what keys exist in each tab?
- `canWriteSession` - can both tabs write to sessionStorage?
- What happens after hard refresh of Tab 2?


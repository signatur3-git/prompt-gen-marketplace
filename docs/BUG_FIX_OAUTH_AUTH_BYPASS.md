# OAuth Authentication Bypass Bug - FIXED

## The Bug

**Reported By User:**
- User is NOT logged into marketplace (sees "Login" button, not "Dashboard")
- User starts OAuth flow from external web app  
- **BUG:** Consent screen appears WITHOUT asking for keypair
- **EXPECTED:** Should redirect to login page and ask for keypair first

## Root Cause

### The Problem: Inconsistent sessionStorage State

**App.vue (Navbar)** checks:
```typescript
const token = sessionStorage.getItem('marketplace_token');
isLoggedIn.value = !!token;  // Only checks token
```

**AuthorizePage.vue (OAuth)** was checking:
```typescript
const userData = sessionStorage.getItem('marketplace_user');
if (!userData) { redirect to login }  // Only checked user data
```

### How This Caused the Bug

**Scenario:**
1. User logs in → Both `marketplace_token` and `marketplace_user` stored
2. Token expires or gets deleted somehow → `marketplace_token` = null
3. But `marketplace_user` remains in sessionStorage (stale data)
4. Navbar sees no token → Shows "Login" button ✅
5. OAuth flow checks user data → Finds stale user → Shows consent ❌ **BUG!**

### Why This is Dangerous

An unauthenticated user could see the consent screen and potentially:
- Click "Authorize" without being logged in
- The backend API call would fail (because no valid token)
- But the UX is broken and confusing

## The Fix

### Updated AuthorizePage.vue

**Changed from:**
```typescript
// Only checked user data
const userData = sessionStorage.getItem('marketplace_user');
if (!userData) {
  router.push('/login?redirect=...');
  return;
}
const token = sessionStorage.getItem('marketplace_token');
```

**Changed to:**
```typescript
// Check BOTH user data AND token
const userData = sessionStorage.getItem('marketplace_user');
const token = sessionStorage.getItem('marketplace_token');

// If either is missing, clear both and redirect
if (!userData || !token) {
  // Clear any stale data to prevent inconsistent state
  sessionStorage.removeItem('marketplace_user');
  sessionStorage.removeItem('marketplace_token');
  
  // Redirect to login
  router.push('/login?redirect=...');
  return;
}
```

### Why This Fix Works

1. ✅ Checks BOTH token and user data (consistent with navbar logic)
2. ✅ Clears inconsistent state when found
3. ✅ Forces login if either is missing
4. ✅ Prevents showing consent screen when not authenticated

## Testing the Fix

### Before Fix (Buggy Behavior)
```
1. User not logged in (no token, but has stale user data)
2. Start OAuth flow
3. ❌ Shows consent screen (BUG!)
4. User clicks "Authorize"
5. API call fails (no valid token)
```

### After Fix (Correct Behavior)
```
1. User not logged in (no token, or no user data, or both missing)
2. Start OAuth flow
3. ✅ Detects missing/inconsistent auth state
4. ✅ Clears stale sessionStorage
5. ✅ Redirects to login page
6. ✅ User logs in with keypair
7. ✅ Redirects back to OAuth consent screen
8. ✅ User clicks "Authorize"
9. ✅ API call succeeds (valid token)
```

## Additional Improvements to Consider

### 1. Synchronize Login State Checks

Consider creating a shared auth utility:
```typescript
// utils/auth.ts
export function isAuthenticated(): boolean {
  const token = sessionStorage.getItem('marketplace_token');
  const user = sessionStorage.getItem('marketplace_user');
  return !!(token && user);
}

export function clearAuth(): void {
  sessionStorage.removeItem('marketplace_token');
  sessionStorage.removeItem('marketplace_user');
}
```

Use everywhere:
- App.vue navbar
- AuthorizePage
- DashboardPage  
- Any auth-protected page

### 2. Add Token Expiration Check

```typescript
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
```

### 3. Implement Token Refresh

Currently tokens expire after 24 hours. Could add:
- Refresh tokens (longer-lived)
- Silent token renewal
- Better UX for expiration

## Security Impact

**Severity:** Medium

**Impact:**
- ❌ User could see OAuth consent screen when not authenticated
- ✅ Backend API still protected (requires valid token)
- ❌ Confusing UX could lead to user frustration
- ✅ No actual security breach (API validates tokens)

**Classification:** UX bug with potential security implications (authentication bypass in UI only, not in API)

## Status

✅ **FIXED** in commit [current changes]

**Files Changed:**
- `frontend/src/pages/AuthorizePage.vue` - Added dual check for token and user data

**Testing Required:**
1. ✅ Build succeeds
2. ⏳ Manual test: Start OAuth flow when not logged in
3. ⏳ Verify redirect to login page
4. ⏳ Complete login and verify return to consent screen

## Lessons Learned

1. **Always check ALL required auth components** (token + user data)
2. **Clear stale state** when inconsistencies are detected
3. **Keep auth checks consistent** across all components
4. **Consider centralized auth utilities** for consistency
5. **Test edge cases** like partial logout or stale sessions

## Related Issues

- None currently tracked
- Consider creating auth utility library for future consistency


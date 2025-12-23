# The sessionStorage Mystery - Visual Timeline

## What Actually Happened

```
TIME: Morning (Tab 1)
┌──────────────────────────────────────────────┐
│ You: Visit marketplace frontend             │
│ URL: http://localhost:5174/login            │
│                                              │
│ Action: Upload keypair, sign challenge      │
│ Result: JWT token stored in sessionStorage  │
│                                              │
│ sessionStorage (localhost:5174):            │
│   marketplace_token: "jwt_abc123..."        │
│   marketplace_user: {...}                   │
└──────────────────────────────────────────────┘

TIME: Morning (Same Tab 1)
┌──────────────────────────────────────────────┐
│ You: Switch to external web app             │
│ URL: http://localhost:5173                  │
│                                              │
│ Action: Click "Connect to Marketplace"      │
│ Result: Redirected to marketplace           │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Marketplace: Check auth                     │
│ URL: http://localhost:5174/oauth/authorize │
│                                              │
│ Check: sessionStorage.getItem('...token')   │
│ Result: FOUND! ✅ User is logged in          │
│                                              │
│ Show: Authorization consent screen          │
│ Display: "Allow Prompt Gen Web to access?"  │
│ Button: [Authorize] [Deny]                  │
└──────────────────────────────────────────────┘

TIME: Morning (Still Tab 1)
┌──────────────────────────────────────────────┐
│ You: Click "Authorize"                      │
│                                              │
│ Result: Redirected back to external web app │
│ URL: http://localhost:5173/oauth/callback? │
│      code=xyz123&state=...                  │
│                                              │
│ External app: Exchange code for token       │
│ POST /api/v1/oauth/token                    │
│                                              │
│ sessionStorage (localhost:5173):            │
│   oauth_access_token: "oauth_xyz789..."     │
└──────────────────────────────────────────────┘

┌─────────────── SOMETHING HAPPENS ───────────┐
│  One of:                                     │
│  • You closed the tab                        │
│  • You restarted browser                     │
│  • You opened a new tab/window               │
│  • Token expired (24 hours)                  │
└──────────────────────────────────────────────┘

TIME: Later (New Tab 2)
┌──────────────────────────────────────────────┐
│ You: Visit marketplace frontend             │
│ URL: http://localhost:5174                  │
│                                              │
│ Marketplace: Check auth                     │
│ Check: sessionStorage.getItem('...token')   │
│ Result: NULL ❌ Not found!                   │
│                                              │
│ Why: sessionStorage was CLEARED              │
│                                              │
│ sessionStorage (localhost:5174):            │
│   (empty)                                   │
│                                              │
│ Display: "Not logged in" / Login button     │
└──────────────────────────────────────────────┘

TIME: Later (External web app still works!)
┌──────────────────────────────────────────────┐
│ External web app still calling API           │
│ URL: http://localhost:5173                  │
│                                              │
│ Making requests with OAuth token:           │
│ Authorization: Bearer oauth_xyz789...        │
│                                              │
│ sessionStorage (localhost:5173):            │
│   oauth_access_token: "oauth_xyz789..." ✅  │
│   (Still there! Different origin!)          │
│                                              │
│ Result: API calls work fine ✅              │
└──────────────────────────────────────────────┘
```

## The Key Realization

### Two Completely Independent Storage Areas

```
┌─────────────────────────────────┐
│  Browser Tab/Window             │
│                                 │
│  ┌───────────────────────────┐ │
│  │ Origin: localhost:5174     │ │
│  │                            │ │
│  │ sessionStorage:            │ │
│  │ ┌────────────────────────┐ │ │
│  │ │ marketplace_token: ... │ │ │
│  │ │ marketplace_user: ...  │ │ │
│  │ └────────────────────────┘ │ │
│  │                            │ │
│  │ Cleared when:              │ │
│  │ • Tab closes               │ │
│  │ • Browser restarts         │ │
│  │ • New tab opened           │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │ Origin: localhost:5173     │ │
│  │                            │ │
│  │ sessionStorage:            │ │
│  │ ┌────────────────────────┐ │ │
│  │ │ oauth_access_token:... │ │ │
│  │ └────────────────────────┘ │ │
│  │                            │ │
│  │ INDEPENDENT!               │ │
│  │ Persists even if           │ │
│  │ localhost:5174 cleared!    │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

## Why This Happens

### sessionStorage Characteristics

| Behavior | Description |
|----------|-------------|
| **Per-origin** | `localhost:5173` ≠ `localhost:5174` (different ports = different origins) |
| **Per-tab** | Not shared between tabs/windows |
| **Temporary** | Cleared when tab closes or browser restarts |
| **Session-scoped** | Doesn't persist across browser sessions |

### What This Means

During OAuth flow:
1. ✅ You had marketplace token in Tab 1
2. ✅ Authorization worked (checked sessionStorage)
3. ✅ OAuth token saved in external app's origin

After OAuth flow:
1. ❌ Marketplace sessionStorage cleared (tab closed/new tab/restart)
2. ✅ External app sessionStorage still intact (different origin!)

## The Confusion Explained

**You expected:** "I just authorized via marketplace, so marketplace should show me as logged in"

**What actually happened:** You were logged into marketplace when you authorized, but that login was in sessionStorage which got cleared later.

**Why external app still works:** It stores its OAuth token in a completely separate sessionStorage (different origin).

## Solutions

### If You Want to Stay Logged In to Marketplace

**Option 1:** Keep the marketplace tab open  
**Option 2:** Use `localStorage` instead of `sessionStorage` (persists across sessions)  
**Option 3:** Implement "Remember me" with refresh tokens  
**Option 4:** Just log in again when needed (current behavior)

### Current Behavior is Actually Secure

- ✅ Short-lived sessions (sessionStorage clears automatically)
- ✅ OAuth tokens are separate from direct login
- ✅ Closing tab = automatic logout
- ✅ Less risk of leaving logged-in session unattended

## Bottom Line

**You did nothing wrong!** The marketplace frontend appearing logged out after OAuth is a side effect of:
1. OAuth happening while you were logged in (in sessionStorage)
2. sessionStorage being cleared afterward (normal browser behavior)
3. External app keeping its OAuth token (separate origin = separate storage)

This is **correct behavior**, just surprising if you don't know about sessionStorage isolation!


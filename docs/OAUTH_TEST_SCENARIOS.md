# OAuth Flow Test Scenarios

## Let's Determine What's Actually Happening

### Test 1: Check Current Marketplace Login State

**Action:** Open `http://localhost:5174` in your browser

**Expected Results:**

#### If You See "Login" Button:
- ❌ You are NOT logged into marketplace
- sessionStorage is empty for `localhost:5174`
- **Prediction:** Starting OAuth flow will ask for keypair

#### If You See "Dashboard" Button:
- ✅ You ARE logged into marketplace
- sessionStorage has `marketplace_token`
- **Prediction:** Starting OAuth flow will show consent screen (no keypair)

---

### Test 2: Start OAuth Flow from External Web App

**Action:** In external web app, click "Connect to Marketplace"

**Possible Outcomes:**

#### Outcome A: Redirected to Marketplace Login Page
- URL: `http://localhost:5174/login?redirect=/oauth/authorize?...`
- Page shows: Keypair upload / paste interface
- **This means:** You're NOT logged into marketplace
- **My explanation was:** ✅ CORRECT

#### Outcome B: See Authorization Consent Screen
- URL: `http://localhost:5174/oauth/authorize?...`
- Page shows: "Allow Prompt Gen Web to access...?" with [Authorize] [Deny]
- **This means:** You ARE logged into marketplace
- **My explanation was:** ❌ WRONG (or incomplete)

---

### Test 3: Check sessionStorage (Browser DevTools)

**Action:** 
1. Open `http://localhost:5174`
2. Open DevTools (F12)
3. Go to Application/Storage → Session Storage → `http://localhost:5174`
4. Look for `marketplace_token` and `marketplace_user`

**What This Tells Us:**

#### If Keys Exist:
```
marketplace_token: "eyJhbGciOiJ..."
marketplace_user: "{\"id\":\"...\"}"
```
- You ARE logged into marketplace
- Token is still valid
- My explanation needs correction

#### If Keys Don't Exist:
```
(empty)
```
- You are NOT logged into marketplace
- sessionStorage was cleared
- My explanation is correct

---

## Possible Explanations for Each Scenario

### Scenario 1: You're Still Logged Into Marketplace

**How this could happen:**
- You kept the browser tab open
- You're using the same browser window
- Token hasn't expired yet (24-hour lifetime)

**What this means:**
- OAuth flow will work without keypair (just consent)
- External web app has separate OAuth token
- Both are working independently

**Why marketplace appears "logged out" to you:**
- Maybe you checked in a different tab/window?
- Maybe you're looking at different UI indicators?

### Scenario 2: You're NOT Logged Into Marketplace

**How this could happen:**
- You closed the browser tab
- You restarted browser
- You opened a new window/tab
- Token expired

**What this means:**
- OAuth flow WILL ask for keypair first
- Then show consent screen
- Then give OAuth token to external app

**This confirms:** My sessionStorage clearing explanation

### Scenario 3: Something Else Is Going On

**Possibilities:**
- localStorage is being used somewhere (persists)
- Cookies are being used (persists, shared across tabs)
- Service worker is caching something
- Browser extension is interfering

---

## What I Need From You

Please run these tests and tell me:

1. **Test 1 Result:** When you open `localhost:5174` right now, do you see "Login" or "Dashboard"?

2. **Test 2 Result:** If you start OAuth flow right now, do you see:
   - A) Marketplace login page (keypair prompt)
   - B) Authorization consent screen (no keypair)

3. **Test 3 Result:** What's in sessionStorage for `localhost:5174`?
   - Empty?
   - Has `marketplace_token`?

---

## My Current Hypothesis

**I suspect:** When you said "marketplace never asked for keypair during OAuth", you were actually still logged into the marketplace at that time. But now, if you try again, it WILL ask for keypair because your sessionStorage was cleared.

**If I'm wrong:** There's another authentication mechanism I'm missing (cookies, localStorage, or something else).

**Let's find out together!** 🔍


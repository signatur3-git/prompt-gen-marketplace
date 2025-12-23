# Desktop App OAuth Integration

This document describes how desktop applications can integrate with the Prompt Gen Marketplace using OAuth 2.0.

## OAuth Client Configuration

**Client ID:** `prompt-gen-desktop`  
**Client Name:** `Prompt Gen Desktop`

### Registered Redirect URIs

1. **Local HTTP Server:** `http://localhost:51234/oauth/callback`
   - Start a temporary local HTTP server on port 51234
   - Receive the authorization code via HTTP callback
   - Close the server after receiving the code

2. **Deep Link:** `promptgen://oauth/callback`
   - Register a custom URL scheme handler in your desktop app
   - The operating system will launch your app with the callback URL
   - Extract the authorization code from the URL parameters

## OAuth Flow for Desktop Apps

### Step 1: Generate PKCE Challenge

```javascript
// Generate random code verifier (43-128 characters, base64url encoded)
const codeVerifier = crypto.randomBytes(32).toString('base64url');

// Create SHA-256 hash of verifier for code challenge
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');
```

### Step 2: Build Authorization URL

```javascript
const authUrl = new URL('https://prompt-gen-marketplace-production.up.railway.app/oauth/authorize');
authUrl.searchParams.set('client_id', 'prompt-gen-desktop');
authUrl.searchParams.set('redirect_uri', 'http://localhost:51234/oauth/callback'); // or promptgen://oauth/callback
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('scope', 'read:packages write:packages');
authUrl.searchParams.set('state', generateRandomState()); // CSRF protection
```

### Step 3: Open Browser

Open the authorization URL in the user's default browser:

```javascript
// Node.js example
import { exec } from 'child_process';

// Windows
exec(`start ${authUrl.toString()}`);

// macOS
exec(`open ${authUrl.toString()}`);

// Linux
exec(`xdg-open ${authUrl.toString()}`);
```

### Step 4: Receive Authorization Code

#### Option A: Local HTTP Server (Recommended for Development)

```javascript
import http from 'http';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:51234');
  
  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    if (error) {
      res.writeHead(400);
      res.end(`Authorization failed: ${error}`);
      server.close();
      return;
    }
    
    // Validate state parameter (CSRF protection)
    if (state !== expectedState) {
      res.writeHead(400);
      res.end('Invalid state parameter');
      server.close();
      return;
    }
    
    // Success! Show user-friendly message
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>Authorization Successful!</h1>
          <p>You can close this window and return to the app.</p>
          <script>window.close();</script>
        </body>
      </html>
    `);
    
    // Exchange code for token
    exchangeCodeForToken(code, codeVerifier);
    
    // Close server after a short delay
    setTimeout(() => server.close(), 1000);
  }
});

server.listen(51234);
```

#### Option B: Deep Link (For Installed Apps)

1. Register the `promptgen://` URL scheme handler in your app

**Windows (Registry):**
```reg
[HKEY_CLASSES_ROOT\promptgen]
@="URL:Prompt Gen Protocol"
"URL Protocol"=""
[HKEY_CLASSES_ROOT\promptgen\shell\open\command]
@="\"C:\\Path\\To\\YourApp.exe\" \"%1\""
```

**macOS (Info.plist):**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>promptgen</string>
    </array>
    <key>CFBundleURLName</key>
    <string>Prompt Gen OAuth</string>
  </dict>
</array>
```

**Linux (.desktop file):**
```ini
[Desktop Entry]
Exec=yourapp %u
MimeType=x-scheme-handler/promptgen
```

2. Handle the callback in your app's startup code:

```javascript
// Parse command-line arguments or URL events
function handleOAuthCallback(callbackUrl) {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // Validate and exchange code...
}
```

### Step 5: Exchange Code for Access Token

```javascript
async function exchangeCodeForToken(code, codeVerifier) {
  const response = await fetch(
    'https://prompt-gen-marketplace-production.up.railway.app/api/v1/oauth/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        client_id: 'prompt-gen-desktop',
        redirect_uri: 'http://localhost:51234/oauth/callback', // Must match Step 2
        code_verifier: codeVerifier, // PKCE verifier
      }),
    }
  );
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${data.error_description}`);
  }
  
  // Store the access token securely
  const accessToken = data.access_token;
  const expiresIn = data.expires_in; // Seconds until expiration (3600 = 1 hour)
  
  console.log('Access token received:', accessToken);
  console.log('Expires in:', expiresIn, 'seconds');
  
  return accessToken;
}
```

### Step 6: Use Access Token

```javascript
async function listPackages(accessToken) {
  const response = await fetch(
    'https://prompt-gen-marketplace-production.up.railway.app/api/v1/packages',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  const packages = await response.json();
  return packages;
}
```

## Security Best Practices

1. **Always use PKCE with S256:** Never use 'plain' code challenge method
2. **Validate state parameter:** Protect against CSRF attacks
3. **Store tokens securely:** Use OS-provided secure storage (Keychain, Credential Manager, etc.)
4. **Handle token expiration:** Tokens expire after 1 hour - prompt user to re-authenticate
5. **Don't log tokens:** Never log access tokens or code verifiers
6. **Close local server:** Always close the local HTTP server after receiving the callback
7. **Handle errors gracefully:** User might deny authorization - show appropriate messages

## Testing Locally

For local development, use:
- Marketplace URL: `http://localhost:5174` (or `http://localhost:3000` for API only)
- Client ID: `prompt-gen-desktop` (same as production)
- Redirect URI: `http://localhost:51234/oauth/callback`

The OAuth client is automatically seeded when you run:
```bash
npm run start:with-migrations
```

Or manually:
```bash
npm run db:seed
```

## CORS Configuration

The local HTTP server callback (`http://localhost:51234`) is already configured in CORS settings. If you need to add additional origins, update the `CORS_ORIGIN` environment variable:

**Local development (.env):**
```
CORS_ORIGIN=http://localhost:5174,http://localhost:5173,http://localhost:51234
```

**Production (Railway):**
CORS settings are configured in Railway's environment variables.

**Note:** Deep link URIs (`promptgen://`) don't require CORS configuration as they are handled by the operating system.

## Troubleshooting

### "Invalid redirect_uri" error
- Make sure the `redirect_uri` parameter exactly matches one of the registered URIs
- Check for trailing slashes or protocol differences (http vs https)

### "Invalid code verifier" error
- Ensure you're using the same `code_verifier` that generated the `code_challenge`
- Verify that the code challenge method is 'S256'
- Check that the verifier is base64url encoded (not base64)

### Local server times out
- Verify port 51234 is not already in use
- Check firewall settings
- Try using a different port (and update redirect URI accordingly)

### Deep link doesn't launch app
- Verify URL scheme is properly registered
- Check app permissions
- Test with a simple deep link URL first

## Example Implementation

See the `prompt-gen-web` repository for a reference implementation of the OAuth flow (web-based, but similar concepts apply).

For desktop-specific examples:
- **Electron:** Use `shell.openExternal()` and handle protocol events
- **Tauri:** Use `open::that()` and register custom protocol handler
- **.NET:** Use `Process.Start()` and register protocol in registry/Info.plist
- **Qt:** Use `QDesktopServices::openUrl()` and handle custom URL scheme events


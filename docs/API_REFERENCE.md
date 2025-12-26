# API Reference

Complete API documentation for the Prompt Gen Marketplace.

**Base URL:** `https://prompt-gen-marketplace-production.up.railway.app` (production) or `http://localhost:3000` (local)

---

## Table of Contents

- [Authentication](#authentication)
- [OAuth 2.0](#oauth-20)
- [Personas](#personas)
- [Namespaces](#namespaces)
- [Packages](#packages)
- [Admin](#admin-endpoints)

---

## Authentication

All authenticated endpoints require an `Authorization: Bearer <token>` header.

### Register User

**`POST /api/v1/auth/register`**

Register a new user with their Ed25519 public key.

**Request Body:**

```json
{
  "public_key": "hex-encoded-ed25519-public-key",
  "persona_name": "Your Name"
}
```

- `public_key` (optional): If provided, user manages their own keypair. If omitted, server generates one.
- `persona_name` (required): Name for the default persona.

**Response (200 OK):**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "public_key": "...",
    "created_at": "2025-01-01T00:00:00Z"
  },
  "keyfile": "-----BEGIN PROMPT-GEN MARKETPLACE KEYPAIR-----\n...",
  "warning": "⚠️ Save this keypair file securely!"
}
```

**Note:** The `keyfile` field is only present if the server generated the keypair (no `public_key` provided).

---

### Get Challenge

**`GET /api/v1/auth/challenge?public_key=<hex-public-key>`**

Get a challenge string for challenge-response authentication.

**Query Parameters:**
- `public_key` (required): Hex-encoded Ed25519 public key

**Response (200 OK):**

```json
{
  "challenge": "random-hex-string",
  "expires_at": "2025-01-01T00:05:00Z"
}
```

**Note:** Challenge expires in 5 minutes.

---

### Login

**`POST /api/v1/auth/login`**

Authenticate by signing the challenge with your private key.

**Request Body:**

```json
{
  "public_key": "hex-encoded-public-key",
  "challenge": "challenge-from-previous-step",
  "signature": "hex-encoded-ed25519-signature"
}
```

**Response (200 OK):**

```json
{
  "token": "jwt-access-token",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "public_key": "...",
    "created_at": "..."
  },
  "primary_persona": {
    "id": "uuid",
    "name": "Your Name",
    "is_primary": true,
    "bio": null,
    "avatar_url": null,
    "website": null,
    "created_at": "..."
  }
}
```

**Note:** Token expires in 24 hours (86400 seconds).

---

### Logout

**`POST /api/v1/auth/logout`**

Logout (client should discard the token).

**Authentication:** Required

**Response (200 OK):**

```json
{
  "message": "Logged out successfully"
}
```

**Note:** This is primarily for client-side token cleanup. The server doesn't maintain a session.

---

### Generate Keypair (Testing Only)

**`GET /api/v1/auth/keygen`**

Generate a test keypair for development.

**⚠️ WARNING:** Only use for testing! In production, users should generate their own keypairs client-side.

**Response (200 OK):**

```json
{
  "public_key": "hex-encoded-public-key",
  "secret_key": "hex-encoded-secret-key",
  "pem": "-----BEGIN PROMPT-GEN MARKETPLACE KEYPAIR-----\n...",
  "warning": "⚠️ KEEP SECRET KEY PRIVATE! This is for testing only."
}
```

---

## OAuth 2.0

OAuth 2.0 Authorization Code flow with PKCE for third-party application integration.

See [OAuth Flow Documentation](./oauth-flow.md) for detailed flow explanation.

### Authorization Page

**`GET /api/v1/oauth/authorize`**

Display the authorization consent page.

**Query Parameters:**
- `client_id` (required): OAuth client ID
- `redirect_uri` (required): Callback URL for the client app
- `response_type` (required): Must be `code`
- `code_challenge` (required): PKCE code challenge (base64url-encoded SHA256 hash)
- `code_challenge_method` (required): Must be `S256`
- `scope` (required): Space-separated scopes (e.g., `read:packages write:packages`)
- `state` (recommended): CSRF protection token

**Response:** HTML page with consent form (requires user to be logged in).

---

### Approve Authorization

**`POST /api/v1/oauth/authorize`**

User approves or denies the authorization request.

**Authentication:** Required (user must be logged in)

**Request Body:**

```json
{
  "client_id": "prompt-gen-web",
  "redirect_uri": "http://localhost:5173/oauth/callback",
  "code_challenge": "base64url-encoded-string",
  "scope": "read:packages write:packages",
  "state": "csrf-token",
  "approve": true
}
```

**Response (302 Redirect):**

Redirects to `redirect_uri` with authorization code:
```
http://localhost:5173/oauth/callback?code=AUTH_CODE&state=csrf-token
```

Or if denied:
```
http://localhost:5173/oauth/callback?error=access_denied&state=csrf-token
```

---

### Exchange Code for Token

**`POST /api/v1/oauth/token`**

Exchange authorization code for access token.

**Request Body:**

```json
{
  "grant_type": "authorization_code",
  "code": "authorization-code-from-callback",
  "redirect_uri": "http://localhost:5173/oauth/callback",
  "client_id": "prompt-gen-web",
  "code_verifier": "original-pkce-verifier"
}
```

**Response (200 OK):**

```json
{
  "access_token": "jwt-token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read:packages write:packages"
}
```

**Note:** Access tokens expire in 1 hour (3600 seconds).

---

### Revoke Token

**`POST /api/v1/oauth/revoke`**

Revoke an OAuth access token.

**Authentication:** Required

**Request Body:**

```json
{
  "token": "access-token-to-revoke"
}
```

**Response (200 OK):**

```json
{
  "message": "Token revoked successfully"
}
```

---

### List Active Tokens

**`GET /api/v1/oauth/tokens`**

List active OAuth tokens for the authenticated user.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "tokens": [
    {
      "id": "uuid",
      "client_id": "prompt-gen-web",
      "scope": "read:packages write:packages",
      "created_at": "2025-01-01T00:00:00Z",
      "expires_at": "2025-01-01T01:00:00Z"
    }
  ]
}
```

---

## Personas

Personas are public identities associated with a user account. Each user can have multiple personas and one must be set as primary.

### List User's Personas

**`GET /api/v1/personas`**

List all personas for the authenticated user.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "personas": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Jane Doe",
      "is_primary": true,
      "bio": "Developer bio",
      "avatar_url": "https://example.com/avatar.jpg",
      "website": "https://example.com",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Create Persona

**`POST /api/v1/personas`**

Create a new persona.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "Jane Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "bio": "Software developer and open source contributor",
  "website": "https://example.com"
}
```

**Response (201 Created):**

```json
{
  "persona": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Jane Doe",
    "is_primary": false,
    "bio": "Software developer and open source contributor",
    "avatar_url": "https://example.com/avatar.jpg",
    "website": "https://example.com",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Get Persona (Owner Only)

**`GET /api/v1/personas/:id`**

Get full persona details (requires ownership).

**Authentication:** Required (must own the persona)

**Response (200 OK):**

```json
{
  "persona": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Jane Doe",
    "is_primary": true,
    "bio": "Developer bio",
    "avatar_url": "https://example.com/avatar.jpg",
    "website": "https://example.com",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Get Public Persona Info

**`GET /api/v1/personas/public/:id`**

Get public persona information (no authentication required).

**Authentication:** None

**Response (200 OK):**

```json
{
  "persona": {
    "id": "uuid",
    "name": "Jane Doe",
    "bio": "Developer bio",
    "avatar_url": "https://example.com/avatar.jpg",
    "website": "https://example.com"
  }
}
```

**Note:** Only returns public fields. Does not include `user_id`, `is_primary`, or `created_at`.

---

### Update Persona

**`PATCH /api/v1/personas/:id`**

Update a persona's information.

**Authentication:** Required (must own the persona)

**Request Body:**

```json
{
  "name": "Jane Smith",
  "bio": "Updated bio",
  "avatar_url": "https://example.com/new-avatar.jpg",
  "website": "https://newsite.com"
}
```

**Response (200 OK):**

```json
{
  "persona": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Jane Smith",
    "is_primary": true,
    "bio": "Updated bio",
    "avatar_url": "https://example.com/new-avatar.jpg",
    "website": "https://newsite.com",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Delete Persona

**`DELETE /api/v1/personas/:id`**

Delete a persona.

**Authentication:** Required (must own the persona)

**Restrictions:**
- Cannot delete your only persona
- Cannot delete primary persona (set another as primary first)

**Response (200 OK):**

```json
{
  "message": "Persona deleted successfully"
}
```

---

### Set Primary Persona

**`POST /api/v1/personas/:id/set-primary`**

Set a persona as your primary persona.

**Authentication:** Required (must own the persona)

**Response (200 OK):**

```json
{
  "persona": {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Jane Doe",
    "is_primary": true,
    "bio": "...",
    "avatar_url": "...",
    "website": "...",
    "created_at": "..."
  }
}
```

---

## Namespaces

Namespaces organize packages and control access. They can be public, protected, or private.

### List Namespaces

**`GET /api/v1/namespaces`**

List namespaces with optional filters.

**Authentication:** Optional (private namespaces only visible to owner)

**Query Parameters:**
- `owner_id` (optional): Filter by owner user ID
- `protection_level` (optional): Filter by protection level (`public`, `protected`, `private`)
- `search` (optional): Search namespace names and descriptions

**Response (200 OK):**

```json
{
  "namespaces": [
    {
      "id": "uuid",
      "name": "my-namespace",
      "owner_id": "uuid",
      "protection_level": "protected",
      "description": "My awesome packages",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### Create/Claim Namespace

**`POST /api/v1/namespaces`**

Create or claim a namespace.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "my-namespace",
  "protection_level": "protected",
  "description": "My awesome packages"
}
```

- `name` (required): Namespace name (lowercase, alphanumeric, hyphens)
- `protection_level` (optional): `public`, `protected`, or `private` (default: `protected`)
- `description` (optional): Namespace description

**Response (201 Created):**

```json
{
  "namespace": {
    "id": "uuid",
    "name": "my-namespace",
    "owner_id": "uuid",
    "protection_level": "protected",
    "description": "My awesome packages",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Get Namespace

**`GET /api/v1/namespaces/:name`**

Get namespace details.

**Authentication:** Optional (required for private namespaces)

**Response (200 OK):**

```json
{
  "namespace": {
    "id": "uuid",
    "name": "my-namespace",
    "owner_id": "uuid",
    "protection_level": "protected",
    "description": "My awesome packages",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Update Namespace

**`PATCH /api/v1/namespaces/:name`**

Update namespace information.

**Authentication:** Required (must be owner)

**Request Body:**

```json
{
  "protection_level": "public",
  "description": "Updated description"
}
```

**Response (200 OK):**

```json
{
  "namespace": {
    "id": "uuid",
    "name": "my-namespace",
    "owner_id": "uuid",
    "protection_level": "public",
    "description": "Updated description",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  }
}
```

---

## Packages

Package management and discovery.

### List Packages

**`GET /api/v1/packages`**

List packages with optional filters and pagination.

**Authentication:** Optional (private namespace packages only visible to owner)

**Query Parameters:**
- `namespace` (optional): Filter by namespace
- `author` (optional): Filter by author persona ID
- `search` (optional): Search in package name and description
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK):**

```json
{
  "packages": [
    {
      "id": "uuid",
      "namespace": "my-namespace",
      "name": "my-package",
      "description": "Package description",
      "author_persona_id": "uuid",
      "author_persona": {
        "id": "uuid",
        "name": "Jane Doe",
        "avatar_url": "https://example.com/avatar.jpg",
        "bio": "Developer bio",
        "website": "https://example.com"
      },
      "version_count": 5,
      "latest_version": "1.2.3",
      "content_counts": {
        "rulebooks": 3,
        "rules": 15,
        "prompt_sections": 8,
        "datatypes": 12
      },
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ],
  "total": 127,
  "page": {
    "limit": 50,
    "offset": 0
  }
}
```

**Note:** 
- The response includes enriched author information and version statistics. No additional API calls needed.
- `total` represents the total count of packages matching the filters (for pagination).
- `page` shows the current pagination parameters.
- `content_counts` provides statistics from the latest version's manifest:
  - `rulebooks` - Number of rulebooks defined
  - `rules` - Total number of rules across all rulebooks
  - `prompt_sections` - Number of prompt sections defined
  - `datatypes` - Number of custom datatypes defined
- **Legacy packages:** If a package doesn't have a `locked_manifest` or has no versions, all content counts will be `0`. This is expected for older packages that were published before manifest tracking was implemented.

---

### List User's Packages

**`GET /api/v1/packages/me`**

List packages published by the authenticated user.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "packages": [
    {
      "id": "uuid",
      "namespace": "my-namespace",
      "name": "my-package",
      "description": "My package",
      "author_persona_id": "uuid",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-15T00:00:00Z"
    }
  ],
  "total": 5
}
```

---

### Publish Package

**`POST /api/v1/packages`**

Publish a new package or new version of existing package.

**Authentication:** Required

**Request:** Multipart form data

- `file` (required): YAML package file
- `persona_id` (optional): Persona ID to publish as (defaults to primary persona)

**Response (201 Created):**

```json
{
  "message": "Package published successfully",
  "package": {
    "id": "uuid",
    "namespace": "my-namespace",
    "name": "my-package",
    "description": "Package description",
    "author_persona_id": "uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  },
  "version": {
    "id": "uuid",
    "package_id": "uuid",
    "version": "1.0.0",
    "description": "Initial release",
    "file_size_bytes": 12345,
    "checksum_sha256": "sha256-hash",
    "published_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Get Package Details

**`GET /api/v1/packages/:namespace/:name`**

Get package details with all versions.

**Authentication:** Optional (required for private namespace packages)

**Response (200 OK):**

```json
{
  "id": "uuid",
  "namespace": "my-namespace",
  "name": "my-package",
  "description": "Package description",
  "author_persona_id": "uuid",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T00:00:00Z",
  "versions": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "version": "1.2.3",
      "description": "Latest release",
      "file_size_bytes": 12345,
      "checksum_sha256": "sha256-hash",
      "published_at": "2025-01-15T00:00:00Z",
      "yanked_at": null,
      "yank_reason": null
    }
  ],
  "author_persona": {
    "id": "uuid",
    "name": "Jane Doe",
    "bio": "...",
    "avatar_url": "...",
    "website": "..."
  },
  "latest_version": "1.2.3"
}
```

---

### Get Package Version

**`GET /api/v1/packages/:namespace/:name/:version`**

Get specific package version details.

**Authentication:** Optional (required for private namespace packages)

**Response (200 OK):**

```json
{
  "id": "uuid",
  "package_id": "uuid",
  "version": "1.2.3",
  "description": "Release description",
  "yaml_content": "...",
  "locked_manifest": { ... },
  "signature": "...",
  "file_size_bytes": 12345,
  "checksum_sha256": "sha256-hash",
  "storage_path": "...",
  "published_at": "2025-01-15T00:00:00Z",
  "yanked_at": null,
  "yank_reason": null
}
```

---

### Download Package Version

**`GET /api/v1/packages/:namespace/:name/:version/download`**

Download a package version (YAML file).

**Authentication:** Optional (required for private namespace packages)

**Response (200 OK):** YAML file content

**Headers:**
- `Content-Type: text/yaml`
- `Content-Disposition: attachment; filename="namespace-name-version.yaml"`

**Note:** This endpoint increments download statistics.

---

### Yank Package Version

**`POST /api/v1/packages/:namespace/:name/:version/yank`**

Yank a package version (mark as unavailable for new installations).

**Authentication:** Required (must be package owner)

**Request Body:**

```json
{
  "reason": "Critical security vulnerability"
}
```

**Response (200 OK):**

```json
{
  "message": "Version yanked successfully"
}
```

**Note:** Yanked versions remain downloadable for existing dependencies but won't be used for new installations.

---

## Admin Endpoints

Administrative endpoints require admin privileges.

### List All Users

**`GET /api/v1/admin/users`**

List all users with their personas.

**Authentication:** Required (admin only)

**Response (200 OK):**

```json
{
  "users": [
    {
      "id": "uuid",
      "public_key": "...",
      "email": "user@example.com",
      "is_admin": false,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z",
      "personas": [
        {
          "id": "uuid",
          "name": "Jane Doe",
          "is_primary": true,
          "bio": "...",
          "avatar_url": "...",
          "website": "...",
          "created_at": "..."
        }
      ]
    }
  ]
}
```

---

### Get Platform Statistics

**`GET /api/v1/admin/stats`**

Get platform-wide statistics.

**Authentication:** Required (admin only)

**Response (200 OK):**

```json
{
  "stats": {
    "total_users": 42,
    "total_personas": 58,
    "total_namespaces": 35,
    "total_packages": 127
  }
}
```

---

### Grant/Revoke Admin

**`PATCH /api/v1/admin/users/:userId/admin`**

Grant or revoke admin privileges for a user.

**Authentication:** Required (admin only)

**Request Body:**

```json
{
  "is_admin": true
}
```

**Response (200 OK):**

```json
{
  "message": "User admin status updated",
  "user": {
    "id": "uuid",
    "public_key": "...",
    "is_admin": true
  }
}
```

---

### Delete User

**`DELETE /api/v1/admin/users/:userId`**

Delete a user and all their data.

**Authentication:** Required (admin only)

**⚠️ WARNING:** This is destructive and cannot be undone. Deletes:
- User account
- All personas
- All namespaces owned by user
- All packages published by user

**Response (200 OK):**

```json
{
  "message": "User deleted successfully"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

---

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Limit:** 100 requests per 15 minutes per IP address
- **Headers:** Rate limit info included in response headers
  - `X-RateLimit-Limit` - Request limit
  - `X-RateLimit-Remaining` - Requests remaining
  - `X-RateLimit-Reset` - Time when limit resets (Unix timestamp)

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response.

---

## CORS

CORS is configured to allow requests from approved origins. See `.env` configuration:

```
CORS_ORIGIN=http://localhost:5174,http://localhost:5173,https://signatur3-git.github.io
```

For production deployments, configure the `CORS_ORIGIN` environment variable with your application's domain.


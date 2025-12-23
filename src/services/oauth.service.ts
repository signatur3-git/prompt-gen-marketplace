import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db';

/**
 * OAuth 2.0 Authorization Service
 * Implements Authorization Code flow with PKCE
 */

export interface OAuthClient {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  created_at: Date;
}

export interface AuthorizationCode {
  id: string;
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: Date;
  created_at: Date;
}

export interface AccessToken {
  id: string;
  token_hash: string;
  user_id: string;
  client_id: string;
  scope: string | null;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

/**
 * Get OAuth client by client_id
 */
export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const clients = await query<OAuthClient>('SELECT * FROM oauth_clients WHERE client_id = $1', [
    clientId,
  ]);
  return clients[0] || null;
}

/**
 * Validate redirect URI against client's registered URIs
 */
export function validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}

/**
 * Generate authorization code
 */
export async function createAuthorizationCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  codeChallengeMethod: string
): Promise<string> {
  const code = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await query(
    `INSERT INTO oauth_authorization_codes (
        id,
        code,
        user_id,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method,
        expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [uuidv4(), code, userId, clientId, redirectUri, codeChallenge, codeChallengeMethod, expiresAt]
  );

  return code;
}

/**
 * Validate PKCE code verifier against challenge
 */
export function validatePKCE(codeChallenge: string, codeVerifier: string, method: string): boolean {
  if (method === 'S256') {
    // SHA-256 hash of verifier should match challenge
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  } else if (method === 'plain') {
    // Plain method: verifier must match challenge
    return codeVerifier === codeChallenge;
  }
  return false;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<{ accessToken: string; tokenRecord: AccessToken }> {
  // Get authorization code
  const codes = await query<AuthorizationCode>(
    'SELECT * FROM oauth_authorization_codes WHERE code = $1 AND client_id = $2',
    [code, clientId]
  );

  if (codes.length === 0) {
    throw new Error('Invalid authorization code');
  }

  const authCode = codes[0];

  // Check if expired
  if (new Date() > new Date(authCode.expires_at)) {
    throw new Error('Authorization code expired');
  }

  // Validate redirect URI matches
  if (authCode.redirect_uri !== redirectUri) {
    throw new Error('Redirect URI mismatch');
  }

  // Validate PKCE
  if (!validatePKCE(authCode.code_challenge, codeVerifier, authCode.code_challenge_method)) {
    throw new Error('Invalid code verifier');
  }

  // Delete used authorization code
  await query('DELETE FROM oauth_authorization_codes WHERE code = $1', [code]);

  // Create access token
  const accessToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = sha256Base64Url(accessToken);
  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `INSERT INTO oauth_access_tokens (id, token_hash, user_id, client_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenId, tokenHash, authCode.user_id, clientId, expiresAt]
  );

  const tokenRecord: AccessToken = {
    id: tokenId,
    token_hash: tokenHash,
    user_id: authCode.user_id,
    client_id: clientId,
    scope: null,
    expires_at: expiresAt,
    created_at: new Date(),
    revoked_at: null,
  };

  return { accessToken, tokenRecord };
}

/**
 * Validate access token
 */
export async function validateAccessToken(accessToken: string): Promise<AccessToken | null> {
  const tokenHash = sha256Base64Url(accessToken);
  const tokens = await query<AccessToken>(
    'SELECT * FROM oauth_access_tokens WHERE token_hash = $1 AND revoked_at IS NULL',
    [tokenHash]
  );

  if (tokens.length === 0) {
    return null;
  }

  const token = tokens[0];

  // Check if expired
  if (new Date() > new Date(token.expires_at)) {
    await query('UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE id = $1', [token.id]);
    return null;
  }

  return token;
}

/**
 * Revoke access token
 */
export async function revokeToken(accessToken: string): Promise<void> {
  const tokenHash = sha256Base64Url(accessToken);
  await query('UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE token_hash = $1', [
    tokenHash,
  ]);
}

/**
 * Get user's active tokens
 */
export async function getUserTokens(userId: string): Promise<AccessToken[]> {
  return await query<AccessToken>(
    `SELECT * FROM oauth_access_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
}

/**
 * Revoke all tokens for a user and client
 */
export async function revokeUserClientTokens(userId: string, clientId: string): Promise<void> {
  await query(
    'UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL',
    [userId, clientId]
  );
}

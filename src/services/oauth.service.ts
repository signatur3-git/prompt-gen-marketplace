import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

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
  token: string;
  user_id: string;
  client_id: string;
  expires_at: Date;
  created_at: Date;
}

/**
 * Get OAuth client by client_id
 */
export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const clients = await query<OAuthClient>(
    'SELECT * FROM oauth_clients WHERE client_id = $1',
    [clientId]
  );
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
    `INSERT INTO oauth_codes (id, code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [uuidv4(), code, clientId, userId, redirectUri, codeChallenge, codeChallengeMethod, expiresAt]
  );

  return code;
}

/**
 * Validate PKCE code verifier against challenge
 */
export function validatePKCE(
  codeChallenge: string,
  codeVerifier: string,
  method: string
): boolean {
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
): Promise<AccessToken> {
  // Get authorization code
  const codes = await query<AuthorizationCode>(
    'SELECT * FROM oauth_codes WHERE code = $1 AND client_id = $2',
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
  await query('DELETE FROM oauth_codes WHERE code = $1', [code]);

  // Create access token
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `INSERT INTO access_tokens (id, token, user_id, client_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenId, token, authCode.user_id, clientId, expiresAt]
  );

  return {
    id: tokenId,
    token,
    user_id: authCode.user_id,
    client_id: clientId,
    expires_at: expiresAt,
    created_at: new Date(),
  };
}

/**
 * Validate access token
 */
export async function validateAccessToken(token: string): Promise<AccessToken | null> {
  const tokens = await query<AccessToken>(
    'SELECT * FROM access_tokens WHERE token = $1',
    [token]
  );

  if (tokens.length === 0) {
    return null;
  }

  const accessToken = tokens[0];

  // Check if expired
  if (new Date() > new Date(accessToken.expires_at)) {
    await query('DELETE FROM access_tokens WHERE token = $1', [token]);
    return null;
  }

  return accessToken;
}

/**
 * Revoke access token
 */
export async function revokeToken(token: string): Promise<void> {
  await query('DELETE FROM access_tokens WHERE token = $1', [token]);
}

/**
 * Get user's active tokens
 */
export async function getUserTokens(userId: string): Promise<AccessToken[]> {
  return await query<AccessToken>(
    `SELECT * FROM access_tokens 
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
}

/**
 * Revoke all tokens for a user and client
 */
export async function revokeUserClientTokens(userId: string, clientId: string): Promise<void> {
  await query(
    'DELETE FROM access_tokens WHERE user_id = $1 AND client_id = $2',
    [userId, clientId]
  );
}


import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import * as oauthService from '../services/oauth.service.js';

const router = Router();

/**
 * GET /api/v1/oauth/authorize
 * Authorization endpoint - shows authorization page to user
 *
 * Query params:
 * - client_id: OAuth client ID
 * - redirect_uri: Where to redirect after authorization
 * - code_challenge: PKCE code challenge
 * - code_challenge_method: 'S256' or 'plain'
 * - state: Client state (optional)
 */
router.get(
  '/authorize',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { client_id, redirect_uri, code_challenge, code_challenge_method, state } = req.query;

      // Validate required parameters
      if (!client_id || typeof client_id !== 'string') {
        res.status(400).json({ error: 'client_id is required' });
        return;
      }

      if (!redirect_uri || typeof redirect_uri !== 'string') {
        res.status(400).json({ error: 'redirect_uri is required' });
        return;
      }

      if (!code_challenge || typeof code_challenge !== 'string') {
        res.status(400).json({ error: 'code_challenge is required (PKCE)' });
        return;
      }

      if (!code_challenge_method || typeof code_challenge_method !== 'string') {
        res.status(400).json({ error: 'code_challenge_method is required (PKCE)' });
        return;
      }

      if (code_challenge_method !== 'S256' && code_challenge_method !== 'plain') {
        res.status(400).json({ error: 'code_challenge_method must be S256 or plain' });
        return;
      }

      // Get client
      const client = await oauthService.getClient(client_id);
      if (!client) {
        res.status(400).json({ error: 'Invalid client_id' });
        return;
      }

      // Validate redirect URI
      if (!oauthService.validateRedirectUri(client, redirect_uri)) {
        res.status(400).json({ error: 'Invalid redirect_uri' });
        return;
      }

      // Return client info for authorization page
      res.json({
        client: {
          client_id: client.client_id,
          client_name: client.client_name,
        },
        redirect_uri,
        code_challenge,
        code_challenge_method,
        state: state || null,
      });
    } catch (error: any) {
      console.error('OAuth authorize error:', error);
      res.status(500).json({ error: 'Failed to process authorization request' });
    }
  }
);

/**
 * POST /api/v1/oauth/authorize
 * User grants authorization
 *
 * Body:
 * - client_id: OAuth client ID
 * - redirect_uri: Where to redirect
 * - code_challenge: PKCE code challenge
 * - code_challenge_method: 'S256' or 'plain'
 * - approved: boolean (true = approve, false = deny)
 * - state: Client state (optional)
 */
router.post(
  '/authorize',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { client_id, redirect_uri, code_challenge, code_challenge_method, approved, state } =
        req.body;

      // Validate required parameters
      if (!client_id) {
        res.status(400).json({ error: 'client_id is required' });
        return;
      }

      if (!redirect_uri) {
        res.status(400).json({ error: 'redirect_uri is required' });
        return;
      }

      // Get client
      const client = await oauthService.getClient(client_id);
      if (!client) {
        res.status(400).json({ error: 'Invalid client_id' });
        return;
      }

      // Validate redirect URI
      if (!oauthService.validateRedirectUri(client, redirect_uri)) {
        res.status(400).json({ error: 'Invalid redirect_uri' });
        return;
      }

      // Check if user denied
      if (!approved) {
        // Redirect with error
        const errorUrl = new URL(redirect_uri);
        errorUrl.searchParams.set('error', 'access_denied');
        errorUrl.searchParams.set('error_description', 'User denied authorization');
        if (state) errorUrl.searchParams.set('state', state);

        res.json({ redirect_uri: errorUrl.toString() });
        return;
      }

      // Generate authorization code
      const code = await oauthService.createAuthorizationCode(
        userId,
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method
      );

      // Build redirect URI with code
      const successUrl = new URL(redirect_uri);
      successUrl.searchParams.set('code', code);
      if (state) successUrl.searchParams.set('state', state);

      res.json({ redirect_uri: successUrl.toString() });
    } catch (error: any) {
      console.error('OAuth authorization grant error:', error);
      res.status(500).json({ error: 'Failed to grant authorization' });
    }
  }
);

/**
 * POST /api/v1/oauth/token
 * Exchange authorization code for access token
 *
 * Body:
 * - grant_type: 'authorization_code'
 * - code: Authorization code
 * - client_id: OAuth client ID
 * - redirect_uri: Must match original redirect_uri
 * - code_verifier: PKCE code verifier
 */
router.post('/token', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { grant_type, code, client_id, redirect_uri, code_verifier } = req.body;

    // Validate grant type
    if (grant_type !== 'authorization_code') {
      res
        .status(400)
        .json({
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code is supported',
        });
      return;
    }

    // Validate required parameters
    if (!code) {
      res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
      return;
    }

    if (!client_id) {
      res
        .status(400)
        .json({ error: 'invalid_request', error_description: 'client_id is required' });
      return;
    }

    if (!redirect_uri) {
      res
        .status(400)
        .json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
      return;
    }

    if (!code_verifier) {
      res
        .status(400)
        .json({ error: 'invalid_request', error_description: 'code_verifier is required (PKCE)' });
      return;
    }

    // Exchange code for token
    const accessToken = await oauthService.exchangeCodeForToken(
      code,
      code_verifier,
      client_id,
      redirect_uri
    );

    // Return token
    res.json({
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: Math.floor((accessToken.expires_at.getTime() - Date.now()) / 1000),
    });
  } catch (error: any) {
    console.error('OAuth token exchange error:', error);

    if (error.message === 'Invalid authorization code') {
      res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
    } else if (error.message === 'Authorization code expired') {
      res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
    } else if (error.message === 'Invalid code verifier') {
      res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Invalid code verifier (PKCE failed)' });
    } else {
      res
        .status(500)
        .json({ error: 'server_error', error_description: 'Failed to exchange code for token' });
    }
  }
});

/**
 * POST /api/v1/oauth/revoke
 * Revoke an access token
 *
 * Body:
 * - token: Access token to revoke
 */
router.post('/revoke', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    await oauthService.revokeToken(token);

    res.json({ message: 'Token revoked successfully' });
  } catch (error: any) {
    console.error('OAuth revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

/**
 * GET /api/v1/oauth/tokens
 * Get user's active tokens (requires auth)
 */
router.get(
  '/tokens',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const tokens = await oauthService.getUserTokens(userId);

      res.json({ tokens });
    } catch (error: any) {
      console.error('Get tokens error:', error);
      res.status(500).json({ error: 'Failed to get tokens' });
    }
  }
);

export default router;

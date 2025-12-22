import { Router, Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import * as crypto from '../crypto.js';
import { query } from '../db.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 * - If public_key provided: User generated their own keypair (client-side)
 * - If no public_key: Server generates keypair (server-side, recommended)
 * - persona_name: Name for the default persona (required)
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { public_key, persona_name } = req.body;

    if (!persona_name || typeof persona_name !== 'string' || !persona_name.trim()) {
      res.status(400).json({ error: 'persona_name is required' });
      return;
    }

    let userPublicKey: string;
    let keyfileContent: string | undefined;

    if (public_key) {
      // Client-side generation: User provides public key
      userPublicKey = public_key;
    } else {
      // Server-side generation: Generate keypair for user
      const keypair = crypto.generateKeyPair();
      userPublicKey = keypair.publicKey;

      // Format as PEM for download
      keyfileContent = crypto.formatKeyPairAsPEM(keypair);
    }

    const user = await authService.registerUser(userPublicKey, undefined);

    // Update the default persona name
    await query('UPDATE personas SET name = $1 WHERE user_id = $2 AND is_primary = true', [
      persona_name.trim(),
      user.id,
    ]);

    const response: any = {
      message: 'User registered successfully',
      user: {
        id: user.id,
        public_key: user.public_key,
        created_at: user.created_at,
      },
      persona: {
        name: persona_name.trim(),
      },
    };

    // If server generated the keypair, include it in response
    if (keyfileContent) {
      response.keyfile = {
        filename: `marketplace-key-${user.id}.pem`,
        content: keyfileContent,
      };
      response.warning = '⚠️ CRITICAL: Save this key file! We cannot recover it if you lose it.';
    }

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

/**
 * GET /api/v1/auth/challenge
 * Get authentication challenge for a public key
 */
router.get('/challenge', async (req: Request, res: Response): Promise<void> => {
  try {
    const { public_key } = req.query;

    if (!public_key || typeof public_key !== 'string') {
      res.status(400).json({ error: 'public_key query parameter is required' });
      return;
    }

    const challenge = await authService.generateAuthChallenge(public_key);

    res.json(challenge);
  } catch (error: any) {
    console.error('Challenge generation error:', error);
    res.status(400).json({ error: error.message || 'Challenge generation failed' });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate with signed challenge
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { public_key, challenge, signature } = req.body;

    if (!public_key || !challenge || !signature) {
      res.status(400).json({ error: 'public_key, challenge, and signature are required' });
      return;
    }

    const authToken = await authService.authenticateWithChallenge(public_key, challenge, signature);

    res.json(authToken);
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout (client-side only, just invalidate token on client)
 */
router.post('/logout', async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/v1/auth/keygen
 * Generate a new keypair (for testing/development)
 */
router.get('/keygen', async (_req: Request, res: Response): Promise<void> => {
  try {
    const keyPair = crypto.generateKeyPair();
    const pem = crypto.formatKeyPairAsPEM(keyPair);

    res.json({
      public_key: keyPair.publicKey,
      secret_key: keyPair.secretKey,
      pem,
      warning: '⚠️ KEEP SECRET KEY PRIVATE! This is for testing only.',
    });
  } catch (error: any) {
    console.error('Keygen error:', error);
    res.status(500).json({ error: 'Keypair generation failed' });
  }
});

export default router;

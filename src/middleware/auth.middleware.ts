import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: string;  // From JWT payload
    id?: string;      // Alias for convenience
    public_key: string;
    persona_id: string;
    is_admin?: boolean;
  };
}

/**
 * Middleware to authenticate requests using JWT
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = await authService.verifyToken(token);

    // Attach user info to request, add id alias
    req.user = { ...decoded, id: decoded.user_id };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Export authenticate as requireAuth for backward compatibility
export const requireAuth = authenticate;

/**
 * Optional authentication - attaches user if token is present, but doesn't require it
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');

      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = await authService.verifyToken(token);
        req.user = { ...decoded, id: decoded.user_id };
      }
    }

    next();
  } catch (error) {
    // Ignore errors, just continue without user
    next();
  }
}


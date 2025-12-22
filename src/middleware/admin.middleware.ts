import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';

/**
 * Middleware to require admin privileges
 * Must be used AFTER auth middleware
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Check if user is authenticated
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if user is admin
  if (!req.user.is_admin) {
    res.status(403).json({
      error: 'Admin access required',
      message: 'You do not have permission to access this resource'
    });
    return;
  }

  next();
}


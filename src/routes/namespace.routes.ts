import { Router, Response } from 'express';
import * as namespaceService from '../services/namespace.service.js';
import {
  authenticate,
  optionalAuthenticate,
  AuthenticatedRequest,
} from '../middleware/auth.middleware.js';
import { getErrorMessage } from '../types/index.js';

const router = Router();

/**
 * GET /api/v1/namespaces
 * List namespaces (optionally filtered)
 */
router.get(
  '/',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { owner_id, protection_level, search } = req.query;

      const namespaces = await namespaceService.getNamespaces({
        owner_id: owner_id as string | undefined,
        protection_level: protection_level as any,
        search: search as string | undefined,
      });

      // Filter out private namespaces if user is not the owner
      const userId = req.user?.id;
      const filtered = namespaces.filter((ns) => {
        if (ns.protection_level === 'private') {
          return userId && ns.owner_id === userId;
        }
        return true;
      });

      res.json({ namespaces: filtered });
    } catch (error: any) {
      console.error('List namespaces error:', error);
      res.status(500).json({ error: 'Failed to list namespaces' });
    }
  }
);

/**
 * POST /api/v1/namespaces
 * Create/claim a namespace
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const { name, protection_level, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const namespace = await namespaceService.createNamespace({
      name,
      owner_id: userId,
      protection_level,
      description,
    });

    res.status(201).json({ namespace });
  } catch (error: unknown) {
    console.error('Create namespace error:', error);
    res.status(400).json({ error: getErrorMessage(error) || 'Failed to create namespace' });
  }
});

/**
 * GET /api/v1/namespaces/:name
 * Get namespace details
 */
router.get(
  '/:name',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name } = req.params;
      const namespace = await namespaceService.getNamespaceByName(name);

      if (!namespace) {
        res.status(404).json({ error: 'Namespace not found' });
        return;
      }

      // Check if user can view this namespace
      const userId = req.user?.id || null;
      const canView = await namespaceService.canViewNamespace(name, userId);

      if (!canView) {
        res.status(403).json({ error: 'Forbidden: This namespace is private' });
        return;
      }

      res.json({ namespace });
    } catch (error: any) {
      console.error('Get namespace error:', error);
      res.status(500).json({ error: 'Failed to get namespace' });
    }
  }
);

/**
 * PATCH /api/v1/namespaces/:name
 * Update namespace (owner only)
 */
router.patch(
  '/:name',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const { protection_level, description } = req.body;

      const namespace = await namespaceService.updateNamespace(name, userId, {
        protection_level,
        description,
      });

      res.json({ namespace });
    } catch (error: unknown) {
      console.error('Update namespace error:', error);
      res.status(400).json({ error: getErrorMessage(error) || 'Failed to update namespace' });
    }
  }
);

export default router;

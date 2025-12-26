import { Router, Response, Request } from 'express';
import * as personaService from '../services/persona.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getErrorMessage } from '../types/index.js';

const router = Router();

/**
 * GET /api/v1/personas/public/:id
 * Get public persona details (no authentication required)
 */
router.get('/public/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const persona = await personaService.getPublicPersonaById(id);

    if (!persona) {
      res.status(404).json({ error: 'Persona not found' });
      return;
    }

    res.json({ persona });
  } catch (error: unknown) {
    console.error('Get public persona error:', error);
    res.status(500).json({ error: 'Failed to get persona' });
  }
});

/**
 * GET /api/v1/personas
 * List all personas for the authenticated user
 */
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const personas = await personaService.getPersonasByUserId(userId);

    res.json({ personas });
  } catch (error: unknown) {
    console.error('List personas error:', error);
    res.status(500).json({ error: 'Failed to list personas' });
  }
});

/**
 * POST /api/v1/personas
 * Create a new persona
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const { name, avatar_url, bio, website } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const persona = await personaService.createPersona({
      user_id: userId,
      name,
      avatar_url,
      bio,
      website,
    });

    res.status(201).json({ persona });
  } catch (error: unknown) {
    console.error('Create persona error:', error);
    res.status(400).json({ error: getErrorMessage(error) || 'Failed to create persona' });
  }
});

/**
 * GET /api/v1/personas/:id
 * Get persona details
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const persona = await personaService.getPersonaById(id);

      if (!persona) {
        res.status(404).json({ error: 'Persona not found' });
        return;
      }

      // Verify ownership
      if (persona.user_id !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.json({ persona });
    } catch (error: unknown) {
      console.error('Get persona error:', error);
      res.status(500).json({ error: 'Failed to get persona' });
    }
  }
);

/**
 * PATCH /api/v1/personas/:id
 * Update a persona
 */
router.patch(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      const { name, avatar_url, bio, website } = req.body;

      const persona = await personaService.updatePersona(id, userId, {
        name,
        avatar_url,
        bio,
        website,
      });

      res.json({ persona });
    } catch (error: unknown) {
      console.error('Update persona error:', error);
      res.status(400).json({ error: getErrorMessage(error) || 'Failed to update persona' });
    }
  }
);

/**
 * DELETE /api/v1/personas/:id
 * Delete a persona
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await personaService.deletePersona(id, userId);

      res.json({ message: 'Persona deleted successfully' });
    } catch (error: unknown) {
      console.error('Delete persona error:', error);
      res.status(400).json({ error: getErrorMessage(error) || 'Failed to delete persona' });
    }
  }
);

/**
 * POST /api/v1/personas/:id/set-primary
 * Set a persona as primary
 */
router.post(
  '/:id/set-primary',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const persona = await personaService.setPrimaryPersona(id, userId);

      res.json({ persona });
    } catch (error: unknown) {
      console.error('Set primary persona error:', error);
      res.status(400).json({ error: getErrorMessage(error) || 'Failed to set primary persona' });
    }
  }
);

export default router;

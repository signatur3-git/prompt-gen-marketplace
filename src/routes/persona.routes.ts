import { Router, Response } from 'express';
import * as personaService from '../services/persona.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

// All persona routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/personas
 * List all personas for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const personas = await personaService.getPersonasByUserId(userId);

    res.json({ personas });
  } catch (error: any) {
    console.error('List personas error:', error);
    res.status(500).json({ error: 'Failed to list personas' });
  }
});

/**
 * POST /api/v1/personas
 * Create a new persona
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error: any) {
    console.error('Create persona error:', error);
    res.status(400).json({ error: error.message || 'Failed to create persona' });
  }
});

/**
 * GET /api/v1/personas/:id
 * Get persona details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error: any) {
    console.error('Get persona error:', error);
    res.status(500).json({ error: 'Failed to get persona' });
  }
});

/**
 * PATCH /api/v1/personas/:id
 * Update a persona
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  } catch (error: any) {
    console.error('Update persona error:', error);
    res.status(400).json({ error: error.message || 'Failed to update persona' });
  }
});

/**
 * DELETE /api/v1/personas/:id
 * Delete a persona
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    await personaService.deletePersona(id, userId);

    res.json({ message: 'Persona deleted successfully' });
  } catch (error: any) {
    console.error('Delete persona error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete persona' });
  }
});

/**
 * POST /api/v1/personas/:id/set-primary
 * Set a persona as primary
 */
router.post('/:id/set-primary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const persona = await personaService.setPrimaryPersona(id, userId);

    res.json({ persona });
  } catch (error: any) {
    console.error('Set primary persona error:', error);
    res.status(400).json({ error: error.message || 'Failed to set primary persona' });
  }
});

export default router;

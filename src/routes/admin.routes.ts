import { Router, Response } from 'express';
import { query } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';

const router = Router();

/**
 * GET /api/v1/admin/users
 * List all users with their personas (admin only)
 */
router.get(
  '/users',
  requireAuth,
  requireAdmin,
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Get all users
      const users = await query(
        `SELECT 
        id, 
        public_key, 
        email, 
        is_admin,
        created_at, 
        updated_at 
      FROM users 
      ORDER BY created_at DESC`
      );

      // Get all personas grouped by user
      const usersWithPersonas = await Promise.all(
        users.map(async (user) => {
          const personas = await query(
            `SELECT 
            id, 
            name, 
            is_primary, 
            bio, 
            avatar_url, 
            website,
            created_at 
          FROM personas 
          WHERE user_id = $1 
          ORDER BY is_primary DESC, created_at ASC`,
            [user.id]
          );

          return {
            ...user,
            personas,
          };
        })
      );

      res.json({
        users: usersWithPersonas,
        total: usersWithPersonas.length,
      });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

/**
 * GET /api/v1/admin/stats
 * Get marketplace statistics (admin only)
 */
router.get(
  '/stats',
  requireAuth,
  requireAdmin,
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const [userCount] = await query('SELECT COUNT(*) as count FROM users');
      const [personaCount] = await query('SELECT COUNT(*) as count FROM personas');
      const [packageCount] = await query(
        "SELECT COUNT(DISTINCT namespace || '.' || name) as count FROM packages"
      );
      const [namespaceCount] = await query('SELECT COUNT(*) as count FROM namespaces');

      res.json({
        stats: {
          users: parseInt(userCount.count),
          personas: parseInt(personaCount.count),
          packages: parseInt(packageCount.count),
          namespaces: parseInt(namespaceCount.count),
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

/**
 * PATCH /api/v1/admin/users/:userId/admin
 * Grant or revoke admin privileges (admin only)
 */
router.patch(
  '/users/:userId/admin',
  requireAuth,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { is_admin } = req.body;

      if (typeof is_admin !== 'boolean') {
        res.status(400).json({ error: 'is_admin must be a boolean' });
        return;
      }

      // Prevent self-demotion
      if (userId === req.user!.id && !is_admin) {
        res.status(400).json({
          error: 'Cannot remove your own admin privileges',
          message: 'You cannot demote yourself. Another admin must do this.',
        });
        return;
      }

      const result = await query(
        'UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [is_admin, userId]
      );

      if (result.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        message: `User ${is_admin ? 'promoted to' : 'demoted from'} admin`,
        user: {
          id: result[0].id,
          public_key: result[0].public_key,
          is_admin: result[0].is_admin,
        },
      });
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      res.status(500).json({ error: 'Failed to update admin status' });
    }
  }
);

/**
 * DELETE /api/v1/admin/users/:userId
 * Delete a user and all their data (admin only, DANGEROUS)
 */
router.delete(
  '/users/:userId',
  requireAuth,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      // Prevent self-deletion
      if (userId === req.user!.id) {
        res.status(400).json({
          error: 'Cannot delete your own account',
          message: 'You cannot delete yourself. Another admin must do this.',
        });
        return;
      }

      // Check if user exists
      const users = await query('SELECT id FROM users WHERE id = $1', [userId]);
      if (users.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Delete user (CASCADE will handle personas, packages, etc.)
      await query('DELETE FROM users WHERE id = $1', [userId]);

      res.json({
        message: 'User deleted successfully',
        deleted_user_id: userId,
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

export default router;

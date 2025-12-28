import { Router, Response } from 'express';
import { query } from '../db.js';
import { AuthenticatedRequest, optionalAuthenticate } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /api/v1/debug/status
 * Check database connection and schema status
 */
router.get('/status', async (_req, res: Response): Promise<void> => {
  try {
    // Check database connection
    const connectionTest = await query('SELECT NOW() as time, version() as version');

    // Check if packages table exists and has display_name
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'packages'
      ORDER BY ordinal_position
    `);

    // Check package count
    const packageCount = await query('SELECT COUNT(*) as count FROM packages');

    // Check recent migrations
    const migrations = await query(`
      SELECT name, run_on
      FROM pgmigrations
      ORDER BY run_on DESC
      LIMIT 10
    `);

    res.json({
      status: 'ok',
      database: {
        connected: true,
        time: connectionTest[0].time,
        version: connectionTest[0].version,
      },
      packages_table: {
        exists: columns.length > 0,
        columns: columns.map((c: any) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable,
        })),
        has_display_name: columns.some((c: any) => c.column_name === 'display_name'),
        record_count: parseInt(packageCount[0].count, 10),
      },
      migrations: {
        total: migrations.length,
        recent: migrations.map((m: any) => ({
          name: m.name,
          run_on: m.run_on,
        })),
        has_display_name_migration: migrations.some((m: any) => m.name.includes('display-name')),
      },
    });
  } catch (error: unknown) {
    console.error('[DEBUG] Status check error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

/**
 * GET /api/v1/debug/packages
 * Get raw package data for debugging
 */
router.get(
  '/packages',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 5, 20);

      // Get raw package data
      const packages = await query(
        `SELECT id, namespace, name, display_name, description, created_at, updated_at
       FROM packages
       ORDER BY created_at DESC
       LIMIT $1`,
        [limit]
      );

      // Get sample with all columns
      const samplePackage = packages[0];

      res.json({
        total: packages.length,
        sample: samplePackage,
        packages: packages,
        query_info: {
          limit,
          columns_returned: samplePackage ? Object.keys(samplePackage) : [],
        },
      });
    } catch (error: unknown) {
      console.error('[DEBUG] Packages query error:', error);
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/v1/debug/env
 * Check environment configuration (safe info only)
 */
router.get('/env', (_req, res: Response): Promise<void> | void => {
  res.json({
    node_env: process.env.NODE_ENV,
    has_database_url: !!process.env.DATABASE_URL,
    database_url_prefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
    has_redis_url: !!process.env.REDIS_URL,
    port: process.env.PORT,
    railway_project: process.env.RAILWAY_PROJECT_ID ? 'yes' : 'no',
    railway_service: process.env.RAILWAY_SERVICE_ID ? 'yes' : 'no',
  });
});

export default router;

import { Router, Response } from 'express';
import { createHash } from 'crypto';
import * as packageService from '../services/package.service.js';
import * as packageValidator from '../services/package-validator.service.js';
import * as storageService from '../services/storage.service.js';
import * as namespaceService from '../services/namespace.service.js';
import * as personaService from '../services/persona.service.js';
import * as dependencyResolver from '../services/dependency-resolver.service.js';
import {
  authenticate,
  optionalAuthenticate,
  AuthenticatedRequest,
} from '../middleware/auth.middleware.js';
import { getErrorMessage } from '../types/index.js';

const router = Router();

/**
 * GET /api/v1/packages
 * List packages (with optional filters)
 */
router.get(
  '/',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { namespace, author, search, limit, offset } = req.query;

      const filters = {
        namespace: namespace as string | undefined,
        author_persona_id: author as string | undefined,
        search: search as string | undefined,
      };

      // Get paginated packages
      const packages = await packageService.listPackagesEnriched({
        ...filters,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      // Filter out packages in private namespaces if user doesn't own them
      const userId = req.user?.id;
      const filtered = await Promise.all(
        packages.map(async (pkg) => {
          const canView = await namespaceService.canViewNamespace(pkg.namespace, userId || null);
          return canView ? pkg : null;
        })
      );

      const visiblePackages = filtered.filter((pkg) => pkg !== null);

      // Get total count of packages matching filters
      // Note: This includes all packages matching filters, not filtered by namespace visibility
      // For a more accurate count, we'd need to filter by namespaces the user can view
      const totalCount = await packageService.countPackages(filters);

      res.json({
        packages: visiblePackages,
        total: totalCount,
        page: {
          limit: limit ? parseInt(limit as string, 10) : 50,
          offset: offset ? parseInt(offset as string, 10) : 0,
        },
      });
    } catch (error: unknown) {
      console.error('List packages error:', error);
      res.status(500).json({ error: 'Failed to list packages' });
    }
  }
);

/**
 * GET /api/v1/packages/me
 * Get packages published by the current user
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Get user's personas
    const personas = await personaService.getPersonasByUserId(userId);
    const personaIds = personas.map((p) => p.id);

    // Get packages published by any of user's personas
    const packages = await packageService.listPackages({
      author_persona_id: personaIds.length > 0 ? personaIds[0] : undefined,
      limit: 1000,
      offset: 0,
    });

    // Filter to only packages by this user's personas
    const userPackages = packages.filter((pkg) => personaIds.includes(pkg.author_persona_id));

    res.json({
      packages: userPackages,
      total: userPackages.length,
    });
  } catch (error: unknown) {
    console.error('Get user packages error:', error);
    res.status(500).json({ error: 'Failed to get user packages' });
  }
});

/**
 * POST /api/v1/packages
 * Publish a package (create package + version)
 */
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { yaml_content, persona_id } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!yaml_content) {
      res.status(400).json({ error: 'yaml_content is required' });
      return;
    }

    // Validate YAML
    const validation = packageValidator.validatePackage(yaml_content);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid package format',
        validation_errors: validation.errors,
      });
      return;
    }

    const parsed = validation.parsed!;
    const { namespace, name } = packageValidator.parsePackageId(parsed.id);

    // Check if user can publish to this namespace
    const canPublish = await namespaceService.canPublishToNamespace(namespace, userId);
    if (!canPublish) {
      res.status(403).json({
        error: `Cannot publish to namespace '${namespace}'. Either it is protected/private and you don't own it, or it is reserved.`,
      });
      return;
    }

    // Verify persona ownership
    const usePersonaId = persona_id || req.user!.persona_id;
    const persona = await personaService.getPersonaById(usePersonaId);
    if (!persona || persona.user_id !== userId) {
      res.status(403).json({ error: 'Invalid or unauthorized persona' });
      return;
    }

    // Auto-claim namespace if it doesn't exist
    let ns = await namespaceService.getNamespaceByName(namespace);
    if (!ns) {
      ns = await namespaceService.autoClaimNamespace(namespace, userId);
      console.info(`✅ Auto-claimed namespace: ${namespace}`);
    }

    // Create package if it doesn't exist
    let pkg = await packageService.getPackage(namespace, name);
    if (!pkg) {
      pkg = await packageService.createPackage({
        namespace,
        name,
        description: parsed.metadata?.description,
        author_persona_id: usePersonaId,
      });
      console.info(`✅ Created package: ${namespace}.${name}`);
    } else {
      // Verify ownership for existing package
      if (pkg.author_persona_id !== usePersonaId) {
        const pkgPersona = await personaService.getPersonaById(pkg.author_persona_id);
        if (pkgPersona?.user_id !== userId) {
          res.status(403).json({ error: 'You do not own this package' });
          return;
        }
      }
    }

    // Calculate checksum and generate storage path
    const checksum = packageValidator.calculateChecksum(yaml_content);
    const storagePath = packageValidator.generateStoragePath(namespace, name, parsed.version);

    // Check if version already exists
    const existingVersion = await packageService.getPackageVersion(namespace, name, parsed.version);
    if (existingVersion) {
      res.status(409).json({ error: `Version ${parsed.version} already exists` });
      return;
    }

    // Extract dependencies
    const dependencies = packageValidator.extractDependencies(parsed);

    // Resolve dependencies and generate locked manifest for dependency tracking
    const { manifest, errors: resolutionErrors } = await dependencyResolver.resolveDependencies(
      parsed.id,
      parsed.version,
      dependencies
    );

    if (resolutionErrors.length > 0) {
      res.status(400).json({
        error: 'Dependency resolution failed',
        resolution_errors: resolutionErrors,
      });
      return;
    }

    const lockedManifest = manifest!;

    // Compute local content counts (entities in this package only, not dependencies)
    const contentCounts = {
      rulebooks: 0,
      rules: 0,
      prompt_sections: 0,
      datatypes: 0,
    };

    if (parsed.namespaces) {
      for (const namespace of Object.values(parsed.namespaces)) {
        const ns = namespace as any;
        if (ns.rulebooks && typeof ns.rulebooks === 'object') {
          contentCounts.rulebooks += Object.keys(ns.rulebooks).length;
        }
        if (ns.rules && typeof ns.rules === 'object') {
          contentCounts.rules += Object.keys(ns.rules).length;
        }
        if (ns.prompt_sections && typeof ns.prompt_sections === 'object') {
          contentCounts.prompt_sections += Object.keys(ns.prompt_sections).length;
        }
        if (ns.datatypes && typeof ns.datatypes === 'object') {
          contentCounts.datatypes += Object.keys(ns.datatypes).length;
        }
      }
    }

    // TODO: Sign package (would need user's secret key, which we don't have server-side)
    // For now, use a placeholder signature
    const signature = 'unsigned'; // In production, client signs before upload

    // Store package in S3/local storage
    await storageService.storePackage(storagePath, yaml_content);

    // Publish version
    const version = await packageService.publishVersion({
      package_id: pkg.id,
      version: parsed.version,
      description: parsed.metadata?.description,
      yaml_content,
      locked_manifest: lockedManifest,
      content_counts: contentCounts,
      signature,
      checksum_sha256: checksum,
      storage_path: storagePath,
      dependencies,
    });

    console.info(`✅ Published version: ${namespace}.${name}@${parsed.version}`);

    res.status(201).json({
      message: 'Package published successfully',
      package: pkg,
      version: {
        ...version,
        yaml_content: undefined, // Don't return full content
      },
    });
  } catch (error: unknown) {
    console.error('Publish package error:', error);
    res.status(400).json({ error: getErrorMessage(error) || 'Failed to publish package' });
  }
});

/**
 * GET /api/v1/packages/:namespace/:name
 * Get package details with all versions
 */
router.get(
  '/:namespace/:name',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;

      // Check view permissions
      const userId = req.user?.id || null;
      const canView = await namespaceService.canViewNamespace(namespace, userId);
      if (!canView) {
        res.status(403).json({ error: 'This package is private' });
        return;
      }

      const pkg = await packageService.getPackageWithVersions(namespace, name);
      if (!pkg) {
        res.status(404).json({ error: 'Package not found' });
        return;
      }

      // Get namespace info for protection level
      const namespaceInfo = await namespaceService.getNamespaceByName(namespace);

      // Get statistics
      const stats = await packageService.getPackageStats(pkg.id);

      // Load dependencies for each version
      const versionsWithDeps = await Promise.all(
        pkg.versions.map(async (v) => {
          const deps = await packageService.getDependencies(v.id);
          return {
            ...v,
            yaml_content: undefined, // Remove large content
            locked_manifest: undefined, // Remove large manifest
            dependencies: deps.map((d) => ({
              package: `${d.depends_on_namespace}.${d.depends_on_name}`,
              version: d.version_constraint,
              resolved_version: d.resolved_version,
            })),
          };
        })
      );

      res.json({
        package: {
          ...pkg,
          protection_level: namespaceInfo?.protection_level || 'public',
          versions: versionsWithDeps,
        },
        stats,
      });
    } catch (error: unknown) {
      console.error('Get package error:', error);
      res.status(500).json({ error: 'Failed to get package' });
    }
  }
);

/**
 * GET /api/v1/packages/:namespace/:name/:version
 * Get specific version details
 */
router.get(
  '/:namespace/:name/:version',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;

      // Check view permissions
      const userId = req.user?.id || null;
      const canView = await namespaceService.canViewNamespace(namespace, userId);
      if (!canView) {
        res.status(403).json({ error: 'This package is private' });
        return;
      }

      const packageVersion = await packageService.getPackageVersion(namespace, name, version);
      if (!packageVersion) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      // Get dependencies
      const dependencies = await packageService.getDependencies(packageVersion.id);

      res.json({
        version: {
          ...packageVersion,
          yaml_content: undefined, // Don't include content here, use /download endpoint
        },
        dependencies,
      });
    } catch (error: unknown) {
      console.error('Get version error:', error);
      res.status(500).json({ error: 'Failed to get version' });
    }
  }
);

/**
 * GET /api/v1/packages/:namespace/:name/:version/download
 * Download package YAML
 */
router.get(
  '/:namespace/:name/:version/download',
  optionalAuthenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;

      // Check view permissions
      const userId = req.user?.id || null;
      const canView = await namespaceService.canViewNamespace(namespace, userId);
      if (!canView) {
        res.status(403).json({ error: 'This package is private' });
        return;
      }

      const packageVersion = await packageService.getPackageVersion(namespace, name, version);
      if (!packageVersion) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      if (packageVersion.yanked_at) {
        res.status(410).json({
          error: 'This version has been yanked',
          reason: packageVersion.yank_reason,
          yanked_at: packageVersion.yanked_at,
        });
        return;
      }

      // Retrieve from storage
      const content = await storageService.retrievePackage(packageVersion.storage_path);

      // Record download (hash IP for privacy)
      const ipHash = createHash('sha256')
        .update(req.ip || 'unknown')
        .digest('hex');
      await packageService.recordDownload(
        packageVersion.id,
        ipHash,
        req.headers['user-agent'] || null
      );

      // Return YAML content
      res.setHeader('Content-Type', 'application/x-yaml');
      res.setHeader('Content-Disposition', `attachment; filename="${name}-${version}.yaml"`);
      res.setHeader('X-Checksum-SHA256', packageVersion.checksum_sha256);
      res.send(content);
    } catch (error: unknown) {
      console.error('Download package error:', error);
      res.status(500).json({ error: 'Failed to download package' });
    }
  }
);

/**
 * POST /api/v1/packages/:namespace/:name/:version/yank
 * Yank a version (mark as unavailable)
 */
router.post(
  '/:namespace/:name/:version/yank',
  authenticate,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;

      if (!reason) {
        res.status(400).json({ error: 'reason is required' });
        return;
      }

      // Get package
      const pkg = await packageService.getPackage(namespace, name);
      if (!pkg) {
        res.status(404).json({ error: 'Package not found' });
        return;
      }

      // Verify ownership
      const persona = await personaService.getPersonaById(pkg.author_persona_id);
      if (persona?.user_id !== userId) {
        res.status(403).json({ error: 'You do not own this package' });
        return;
      }

      // Yank version
      await packageService.yankVersion(pkg.id, version, reason);

      res.json({ message: 'Version yanked successfully' });
    } catch (error: unknown) {
      console.error('Yank version error:', error);
      res.status(400).json({ error: getErrorMessage(error) || 'Failed to yank version' });
    }
  }
);

export default router;

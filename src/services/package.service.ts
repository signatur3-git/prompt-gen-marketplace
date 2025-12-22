import { query, getClient } from '../db.js';
import type { Persona } from './auth.service.js';

export interface Package {
  id: string;
  namespace: string;
  name: string;
  description: string | null;
  author_persona_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface PackageVersion {
  id: string;
  package_id: string;
  version: string;
  description: string | null;
  yaml_content: string;
  locked_manifest: any;
  signature: string;
  file_size_bytes: number;
  checksum_sha256: string;
  storage_path: string;
  published_at: Date;
  yanked_at: Date | null;
  yank_reason: string | null;
}

export interface PackageDependency {
  id: string;
  package_version_id: string;
  depends_on_namespace: string;
  depends_on_name: string;
  version_constraint: string;
  resolved_version: string | null;
  created_at: Date;
}

export interface PackageWithVersions extends Package {
  versions: PackageVersion[];
  author_persona: Persona;
  latest_version: string | null;
}

export interface CreatePackageInput {
  namespace: string;
  name: string;
  description?: string;
  author_persona_id: string;
}

export interface PublishVersionInput {
  package_id: string;
  version: string;
  description?: string;
  yaml_content: string;
  locked_manifest: any;
  signature: string;
  checksum_sha256: string;
  storage_path: string;
  dependencies: Array<{
    namespace: string;
    name: string;
    version_constraint: string;
  }>;
}

/**
 * Get package by namespace and name
 */
export async function getPackage(namespace: string, name: string): Promise<Package | null> {
  const packages = await query<Package>(
    'SELECT * FROM packages WHERE namespace = $1 AND name = $2',
    [namespace, name]
  );
  return packages[0] || null;
}

/**
 * Get package with all versions and author info
 */
export async function getPackageWithVersions(
  namespace: string,
  name: string
): Promise<PackageWithVersions | null> {
  const pkg = await getPackage(namespace, name);
  if (!pkg) return null;

  // Get versions
  const versions = await query<PackageVersion>(
    `SELECT * FROM package_versions 
     WHERE package_id = $1 
     ORDER BY published_at DESC`,
    [pkg.id]
  );

  // Get author persona
  const personas = await query<Persona>('SELECT * FROM personas WHERE id = $1', [
    pkg.author_persona_id,
  ]);

  const latestVersion = versions.find((v) => !v.yanked_at)?.version || null;

  return {
    ...pkg,
    versions,
    author_persona: personas[0],
    latest_version: latestVersion,
  };
}

/**
 * Get package version
 */
export async function getPackageVersion(
  namespace: string,
  name: string,
  version: string
): Promise<PackageVersion | null> {
  const versions = await query<PackageVersion>(
    `SELECT pv.* FROM package_versions pv
     JOIN packages p ON pv.package_id = p.id
     WHERE p.namespace = $1 AND p.name = $2 AND pv.version = $3`,
    [namespace, name, version]
  );
  return versions[0] || null;
}

/**
 * List packages with pagination and filters
 */
export async function listPackages(filters?: {
  namespace?: string;
  author_persona_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Package[]> {
  let sql = 'SELECT * FROM packages WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.namespace) {
    sql += ` AND namespace = $${paramIndex++}`;
    params.push(filters.namespace);
  }

  if (filters?.author_persona_id) {
    sql += ` AND author_persona_id = $${paramIndex++}`;
    params.push(filters.author_persona_id);
  }

  if (filters?.search) {
    sql += ` AND (name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(filters.limit);
  }

  if (filters?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(filters.offset);
  }

  return await query<Package>(sql, params);
}

/**
 * Create a new package
 */
export async function createPackage(input: CreatePackageInput): Promise<Package> {
  // Check if package already exists
  const existing = await getPackage(input.namespace, input.name);
  if (existing) {
    throw new Error('Package already exists');
  }

  const packages = await query<Package>(
    `INSERT INTO packages (namespace, name, description, author_persona_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.namespace, input.name, input.description || null, input.author_persona_id]
  );

  return packages[0];
}

/**
 * Publish a new version of a package
 */
export async function publishVersion(input: PublishVersionInput): Promise<PackageVersion> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if version already exists
    const existingVersions = await client.query<PackageVersion>(
      `SELECT * FROM package_versions WHERE package_id = $1 AND version = $2`,
      [input.package_id, input.version]
    );

    if (existingVersions.rows.length > 0) {
      throw new Error('Version already exists');
    }

    // Calculate file size
    const fileSizeBytes = Buffer.from(input.yaml_content, 'utf8').length;

    // Insert version
    const versionResult = await client.query<PackageVersion>(
      `INSERT INTO package_versions (
        package_id, version, description, yaml_content, locked_manifest,
        signature, file_size_bytes, checksum_sha256, storage_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.package_id,
        input.version,
        input.description || null,
        input.yaml_content,
        JSON.stringify(input.locked_manifest),
        input.signature,
        fileSizeBytes,
        input.checksum_sha256,
        input.storage_path,
      ]
    );

    const version = versionResult.rows[0];

    // Insert dependencies
    for (const dep of input.dependencies) {
      await client.query(
        `INSERT INTO package_dependencies (
          package_version_id, depends_on_namespace, depends_on_name, version_constraint
        )
        VALUES ($1, $2, $3, $4)`,
        [version.id, dep.namespace, dep.name, dep.version_constraint]
      );
    }

    await client.query('COMMIT');

    return version;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get dependencies for a package version
 */
export async function getDependencies(packageVersionId: string): Promise<PackageDependency[]> {
  return await query<PackageDependency>(
    'SELECT * FROM package_dependencies WHERE package_version_id = $1',
    [packageVersionId]
  );
}

/**
 * Yank a package version (mark as unavailable for new installations)
 */
export async function yankVersion(
  packageId: string,
  version: string,
  reason: string
): Promise<void> {
  const result = await query(
    `UPDATE package_versions 
     SET yanked_at = NOW(), yank_reason = $1
     WHERE package_id = $2 AND version = $3 AND yanked_at IS NULL`,
    [reason, packageId, version]
  );

  if (result.length === 0) {
    throw new Error('Version not found or already yanked');
  }
}

/**
 * Unyank a package version (restore availability)
 */
export async function unyankVersion(packageId: string, version: string): Promise<void> {
  const result = await query(
    `UPDATE package_versions 
     SET yanked_at = NULL, yank_reason = NULL
     WHERE package_id = $1 AND version = $2 AND yanked_at IS NOT NULL`,
    [packageId, version]
  );

  if (result.length === 0) {
    throw new Error('Version not found or not yanked');
  }
}

/**
 * Get package statistics
 */
export async function getPackageStats(packageId: string): Promise<{
  total_downloads: number;
  downloads_last_30_days: number;
  version_count: number;
}> {
  // Total downloads
  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM download_stats ds
     JOIN package_versions pv ON ds.package_version_id = pv.id
     WHERE pv.package_id = $1`,
    [packageId]
  );

  // Downloads last 30 days
  const recentResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM download_stats ds
     JOIN package_versions pv ON ds.package_version_id = pv.id
     WHERE pv.package_id = $1 AND ds.downloaded_at > NOW() - INTERVAL '30 days'`,
    [packageId]
  );

  // Version count
  const versionResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM package_versions WHERE package_id = $1`,
    [packageId]
  );

  return {
    total_downloads: parseInt(totalResult[0].count, 10),
    downloads_last_30_days: parseInt(recentResult[0].count, 10),
    version_count: parseInt(versionResult[0].count, 10),
  };
}

/**
 * Record a package download
 */
export async function recordDownload(
  packageVersionId: string,
  ipHash: string,
  userAgent: string | null
): Promise<void> {
  await query(
    `INSERT INTO download_stats (package_version_id, ip_hash, user_agent)
     VALUES ($1, $2, $3)`,
    [packageVersionId, ipHash, userAgent || null]
  );
}

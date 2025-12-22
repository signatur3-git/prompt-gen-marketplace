import semver from 'semver';
import * as packageService from './package.service.js';

export interface DependencyNode {
  package: string; // namespace.name
  version: string; // exact resolved version
  dependencies: DependencyNode[];
}

export interface LockedDependency {
  package: string;
  version: string; // exact version
  checksum: string;
  dependencies: string[]; // List of dependency package IDs
}

export interface LockedManifest {
  package: string;
  version: string;
  resolved_at: string; // ISO timestamp
  dependencies: LockedDependency[];
}

export interface ResolutionError {
  type: 'not_found' | 'version_conflict' | 'circular_dependency' | 'yanked';
  package: string;
  constraint?: string;
  message: string;
  path?: string[]; // Dependency path for circular deps
}

/**
 * Resolve dependencies and generate a locked manifest
 */
export async function resolveDependencies(
  packageId: string,
  version: string,
  dependencies: Array<{ namespace: string; name: string; version_constraint: string }>
): Promise<{ manifest: LockedManifest | null; errors: ResolutionError[] }> {
  const errors: ResolutionError[] = [];
  const resolved = new Map<string, { version: string; checksum: string }>();
  const visiting = new Set<string>(); // For circular dependency detection

  // Helper to get package full ID
  const getPackageId = (namespace: string, name: string) => `${namespace}.${name}`;

  // Recursive resolver
  async function resolve(
    namespace: string,
    name: string,
    constraint: string,
    path: string[]
  ): Promise<boolean> {
    const pkgId = getPackageId(namespace, name);
    const pathKey = `${pkgId}@${constraint}`;

    // Check for circular dependency
    if (visiting.has(pathKey)) {
      errors.push({
        type: 'circular_dependency',
        package: pkgId,
        constraint,
        message: `Circular dependency detected: ${[...path, pkgId].join(' → ')}`,
        path: [...path, pkgId],
      });
      return false;
    }

    // Already resolved?
    if (resolved.has(pkgId)) {
      const existing = resolved.get(pkgId)!;
      // Check if existing version satisfies constraint
      if (semver.satisfies(existing.version, constraint)) {
        return true;
      } else {
        errors.push({
          type: 'version_conflict',
          package: pkgId,
          constraint,
          message: `Version conflict: ${pkgId} needs ${constraint} but ${existing.version} is already resolved`,
        });
        return false;
      }
    }

    visiting.add(pathKey);

    try {
      // Get package
      const pkg = await packageService.getPackage(namespace, name);
      if (!pkg) {
        errors.push({
          type: 'not_found',
          package: pkgId,
          constraint,
          message: `Package not found: ${pkgId}`,
        });
        return false;
      }

      // Get package with versions
      const pkgWithVersions = await packageService.getPackageWithVersions(namespace, name);
      if (!pkgWithVersions || pkgWithVersions.versions.length === 0) {
        errors.push({
          type: 'not_found',
          package: pkgId,
          constraint,
          message: `No versions found for package: ${pkgId}`,
        });
        return false;
      }

      // Filter out yanked versions
      const availableVersions = pkgWithVersions.versions
        .filter(v => !v.yanked_at)
        .map(v => v.version);

      // Find best matching version
      const matchingVersion = semver.maxSatisfying(availableVersions, constraint);
      if (!matchingVersion) {
        errors.push({
          type: 'not_found',
          package: pkgId,
          constraint,
          message: `No version of ${pkgId} satisfies ${constraint}. Available: ${availableVersions.join(', ')}`,
        });
        return false;
      }

      // Get the specific version
      const pkgVersion = await packageService.getPackageVersion(namespace, name, matchingVersion);
      if (!pkgVersion) {
        errors.push({
          type: 'not_found',
          package: pkgId,
          constraint,
          message: `Version ${matchingVersion} not found for ${pkgId}`,
        });
        return false;
      }

      // Check if yanked (shouldn't happen since we filtered, but double-check)
      if (pkgVersion.yanked_at) {
        errors.push({
          type: 'yanked',
          package: pkgId,
          constraint,
          message: `Version ${matchingVersion} of ${pkgId} has been yanked: ${pkgVersion.yank_reason}`,
        });
        return false;
      }

      // Mark as resolved (before resolving dependencies to handle cycles)
      resolved.set(pkgId, {
        version: matchingVersion,
        checksum: pkgVersion.checksum_sha256,
      });

      // Resolve dependencies of this package
      const deps = await packageService.getDependencies(pkgVersion.id);
      for (const dep of deps) {
        const success = await resolve(
          dep.depends_on_namespace,
          dep.depends_on_name,
          dep.version_constraint,
          [...path, pkgId]
        );
        if (!success) {
          return false; // Propagate failure
        }
      }

      return true;
    } finally {
      visiting.delete(pathKey);
    }
  }

  // Resolve all top-level dependencies
  for (const dep of dependencies) {
    await resolve(dep.namespace, dep.name, dep.version_constraint, [packageId]);
  }

  // If there were errors, return them
  if (errors.length > 0) {
    return { manifest: null, errors };
  }

  // Build locked manifest
  const lockedDeps: LockedDependency[] = [];
  for (const [pkgId, { version: resolvedVersion, checksum }] of resolved.entries()) {
    const [namespace, name] = pkgId.split('.');
    const pkgVersion = await packageService.getPackageVersion(namespace, name, resolvedVersion);
    const deps = await packageService.getDependencies(pkgVersion!.id);

    lockedDeps.push({
      package: pkgId,
      version: resolvedVersion,
      checksum,
      dependencies: deps.map(d => getPackageId(d.depends_on_namespace, d.depends_on_name)),
    });
  }

  const manifest: LockedManifest = {
    package: packageId,
    version,
    resolved_at: new Date().toISOString(),
    dependencies: lockedDeps,
  };

  return { manifest, errors: [] };
}

/**
 * Verify a locked manifest (check if all dependencies are still available and match checksums)
 */
export async function verifyLockedManifest(manifest: LockedManifest): Promise<{
  valid: boolean;
  errors: ResolutionError[];
}> {
  const errors: ResolutionError[] = [];

  for (const dep of manifest.dependencies) {
    const [namespace, name] = dep.package.split('.');
    const pkgVersion = await packageService.getPackageVersion(namespace, name, dep.version);

    if (!pkgVersion) {
      errors.push({
        type: 'not_found',
        package: dep.package,
        message: `Package version ${dep.package}@${dep.version} not found`,
      });
      continue;
    }

    if (pkgVersion.yanked_at) {
      errors.push({
        type: 'yanked',
        package: dep.package,
        message: `Package version ${dep.package}@${dep.version} has been yanked: ${pkgVersion.yank_reason}`,
      });
      continue;
    }

    if (pkgVersion.checksum_sha256 !== dep.checksum) {
      errors.push({
        type: 'version_conflict',
        package: dep.package,
        message: `Checksum mismatch for ${dep.package}@${dep.version}. Expected ${dep.checksum}, got ${pkgVersion.checksum_sha256}`,
      });
      continue;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get all transitive dependencies in installation order (topological sort)
 */
export function getInstallOrder(manifest: LockedManifest): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Build adjacency list and in-degree count
  // For install order, we need dependencies before dependents
  // So we reverse the edges: child -> parent
  for (const dep of manifest.dependencies) {
    if (!inDegree.has(dep.package)) {
      inDegree.set(dep.package, 0);
    }
    if (!graph.has(dep.package)) {
      graph.set(dep.package, []);
    }

    for (const childPkg of dep.dependencies) {
      if (!inDegree.has(childPkg)) {
        inDegree.set(childPkg, 0);
      }
      if (!graph.has(childPkg)) {
        graph.set(childPkg, []);
      }
      // Reverse edge: child depends on parent, so install child first
      graph.get(childPkg)!.push(dep.package);
      inDegree.set(dep.package, inDegree.get(dep.package)! + 1);
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];

  // Find all nodes with no incoming edges (no dependencies)
  for (const [pkg, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(pkg);
    }
  }

  while (queue.length > 0) {
    const pkg = queue.shift()!;
    result.push(pkg);

    for (const dependent of graph.get(pkg) || []) {
      const newDegree = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  return result;
}

/**
 * Check if a version constraint is valid semver range
 */
export function isValidVersionConstraint(constraint: string): boolean {
  try {
    return semver.validRange(constraint) !== null;
  } catch {
    return false;
  }
}

/**
 * Get latest version matching constraint
 */
export function getLatestMatchingVersion(
  versions: string[],
  constraint: string
): string | null {
  return semver.maxSatisfying(versions, constraint);
}

/**
 * Compare two versions
 */
export function compareVersions(v1: string, v2: string): number {
  return semver.compare(v1, v2);
}


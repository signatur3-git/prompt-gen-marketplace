import yaml from 'js-yaml';
import { createHash } from 'crypto';

export interface ParsedPackage {
  id: string;
  version: string;
  metadata: {
    name: string; // Required per schema
    description?: string;
    authors?: string[]; // Required per schema, but optional for backward compat
    author?: string; // Legacy field, deprecated
    license?: string;
    tags?: string[];
    bypass_filters?: boolean;
  };
  dependencies?: Array<{
    package: string;
    version: string;
    path?: string;
  }>;
  namespaces?: Record<string, any>; // Required but optional here for validation
  datatypes?: Record<string, any>;
  prompt_sections?: Record<string, any>;
  rulebooks?: Record<string, any>;
  separator_sets?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  parsed?: ParsedPackage;
}

/**
 * Parse YAML content
 */
export function parseYAML(content: string): ParsedPackage {
  try {
    const parsed = yaml.load(content) as any;
    return parsed;
  } catch (error: any) {
    throw new Error(`YAML parsing failed: ${error.message}`);
  }
}

/**
 * Validate package structure
 */
export function validatePackage(content: string): ValidationResult {
  const errors: ValidationError[] = [];

  let parsed: ParsedPackage;
  try {
    parsed = parseYAML(content);
  } catch (error: any) {
    return {
      valid: false,
      errors: [{ field: 'yaml', message: error.message }],
    };
  }

  // Required fields
  if (!parsed.id) {
    errors.push({ field: 'id', message: 'Package ID is required' });
  }

  if (!parsed.version) {
    errors.push({ field: 'version', message: 'Version is required' });
  }

  // Validate metadata (required)
  if (!parsed.metadata) {
    errors.push({ field: 'metadata', message: 'Package metadata is required' });
  } else {
    // Validate required metadata fields
    if (!parsed.metadata.name || parsed.metadata.name.trim() === '') {
      errors.push({ field: 'metadata.name', message: 'Package name is required' });
    }
    // Note: authors field is in the schema but not enforced by rpg-web/rpg-desktop yet
    // We'll make it optional for now to avoid breaking existing packages
  }

  // Validate namespaces (required, at least one)
  if (!parsed.namespaces || typeof parsed.namespaces !== 'object') {
    errors.push({ field: 'namespaces', message: 'At least one namespace is required' });
  } else if (Object.keys(parsed.namespaces).length === 0) {
    errors.push({ field: 'namespaces', message: 'At least one namespace must be defined' });
  }

  // Validate ID format (namespace.name)
  if (parsed.id && !isValidPackageId(parsed.id)) {
    errors.push({
      field: 'id',
      message: 'Package ID must be in format "namespace.name"',
    });
  }

  // Validate version format (semver)
  if (parsed.version && !isValidVersion(parsed.version)) {
    errors.push({
      field: 'version',
      message: 'Version must be valid semver (e.g., 1.0.0)',
    });
  }

  // Validate dependencies
  if (parsed.dependencies) {
    if (!Array.isArray(parsed.dependencies)) {
      errors.push({
        field: 'dependencies',
        message: 'Dependencies must be an array',
      });
    } else {
      parsed.dependencies.forEach((dep, index) => {
        if (!dep.package) {
          errors.push({
            field: `dependencies[${index}].package`,
            message: 'Dependency package field is required',
          });
        }
        if (!dep.version) {
          errors.push({
            field: `dependencies[${index}].version`,
            message: 'Dependency version field is required',
          });
        }
      });
    }
  }

  // Validate datatypes
  if (parsed.datatypes) {
    if (typeof parsed.datatypes !== 'object') {
      errors.push({
        field: 'datatypes',
        message: 'Datatypes must be an object',
      });
    }
  }

  // Validate prompt_sections
  if (parsed.prompt_sections) {
    if (typeof parsed.prompt_sections !== 'object') {
      errors.push({
        field: 'prompt_sections',
        message: 'Prompt sections must be an object',
      });
    }
  }

  // Validate rulebooks
  if (parsed.rulebooks) {
    if (typeof parsed.rulebooks !== 'object') {
      errors.push({
        field: 'rulebooks',
        message: 'Rulebooks must be an object',
      });
    } else {
      Object.entries(parsed.rulebooks).forEach(([key, rulebook]: [string, any]) => {
        if (!rulebook.entry_points) {
          errors.push({
            field: `rulebooks.${key}.entry_points`,
            message: 'Rulebook must have entry_points',
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? parsed : undefined,
  };
}

/**
 * Validate package ID format (namespace.name)
 */
export function isValidPackageId(id: string): boolean {
  const parts = id.split('.');
  if (parts.length < 2) return false;

  // Each part must be valid
  return parts.every((part) => /^[a-z0-9-]+$/.test(part) && part.length > 0);
}

/**
 * Validate semver version
 */
export function isValidVersion(version: string): boolean {
  // Basic semver: MAJOR.MINOR.PATCH with optional pre-release/build
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/;
  return semverRegex.test(version);
}

/**
 * Extract namespace and name from package ID
 */
export function parsePackageId(id: string): { namespace: string; name: string } {
  const parts = id.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid package ID format');
  }

  // Namespace can have dots (e.g., "featured.midjourney")
  // Name is the last part
  const name = parts[parts.length - 1];
  const namespace = parts.slice(0, -1).join('.');

  return { namespace, name };
}

/**
 * Calculate SHA-256 checksum
 */
export function calculateChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generate storage path for package version
 */
export function generateStoragePath(namespace: string, name: string, version: string): string {
  return `packages/${namespace}/${name}/${version}/${name}-${version}.yaml`;
}

/**
 * Extract dependencies from parsed package
 */
export function extractDependencies(parsed: ParsedPackage): Array<{
  namespace: string;
  name: string;
  version_constraint: string;
}> {
  if (!parsed.dependencies) return [];

  return parsed.dependencies.map((dep) => {
    const { namespace, name } = parsePackageId(dep.package);
    return {
      namespace,
      name,
      version_constraint: dep.version,
    };
  });
}

/**
 * Sign package content with user's keypair
 */
export function signPackage(content: string, secretKey: string): string {
  const { sign } = require('../crypto.js');
  const checksum = calculateChecksum(content);
  return sign(checksum, secretKey);
}

/**
 * Verify package signature
 */
export function verifyPackageSignature(
  content: string,
  signature: string,
  publicKey: string
): boolean {
  const { verify } = require('../crypto.js');
  const checksum = calculateChecksum(content);
  return verify(checksum, signature, publicKey);
}

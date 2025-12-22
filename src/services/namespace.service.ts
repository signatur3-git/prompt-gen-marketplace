import { query } from '../db.js';

export type ProtectionLevel = 'public' | 'protected' | 'private';

export interface Namespace {
  id: string;
  name: string;
  owner_id: string;
  protection_level: ProtectionLevel;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNamespaceInput {
  name: string;
  owner_id: string;
  protection_level?: ProtectionLevel;
  description?: string;
}

export interface UpdateNamespaceInput {
  protection_level?: ProtectionLevel;
  description?: string;
}

/**
 * Validate namespace name format
 * Rules:
 * - Lowercase letters, numbers, hyphens, dots
 * - Must start with letter
 * - Must end with letter or number
 * - No consecutive dots or hyphens
 * - Length: 2-256 characters
 *
 * Examples of valid long namespaces:
 * - p.signatur3.midjourney.v8.sref.mining
 * - p.signatur3.midjourney.v8.sref.favorites
 * - p.signatur3.midjourney.v8.showcase
 */
export function isValidNamespaceName(name: string): boolean {
  if (name.length < 2 || name.length > 256) {
    return false;
  }

  // Must start with letter
  if (!/^[a-z]/.test(name)) {
    return false;
  }

  // Must end with letter or number
  if (!/[a-z0-9]$/.test(name)) {
    return false;
  }

  // Only lowercase letters, numbers, hyphens, dots
  if (!/^[a-z0-9.-]+$/.test(name)) {
    return false;
  }

  // No consecutive dots or hyphens
  if (/[.-]{2,}/.test(name)) {
    return false;
  }

  return true;
}

/**
 * Check if namespace name is reserved
 * Reserved namespaces will be defined by the user later
 */
export function isReservedNamespace(name: string): boolean {
  const reserved = ['system', 'admin', 'api', 'www', 'marketplace', 'registry'];

  // Exact match or starts with reserved prefix
  return reserved.some((r) => name === r || name.startsWith(`${r}.`));
}

/**
 * Get all namespaces (with optional filtering)
 */
export async function getNamespaces(filters?: {
  owner_id?: string;
  protection_level?: ProtectionLevel;
  search?: string;
}): Promise<Namespace[]> {
  let sql = 'SELECT * FROM namespaces WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.owner_id) {
    sql += ` AND owner_id = $${paramIndex++}`;
    params.push(filters.owner_id);
  }

  if (filters?.protection_level) {
    sql += ` AND protection_level = $${paramIndex++}`;
    params.push(filters.protection_level);
  }

  if (filters?.search) {
    sql += ` AND (name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  sql += ' ORDER BY name ASC';

  return await query<Namespace>(sql, params);
}

/**
 * Get namespace by name
 */
export async function getNamespaceByName(name: string): Promise<Namespace | null> {
  const namespaces = await query<Namespace>('SELECT * FROM namespaces WHERE name = $1', [name]);
  return namespaces[0] || null;
}

/**
 * Create or claim a namespace
 */
export async function createNamespace(input: CreateNamespaceInput): Promise<Namespace> {
  // Validate name
  if (!isValidNamespaceName(input.name)) {
    throw new Error('Invalid namespace name format');
  }

  // Check if reserved
  if (isReservedNamespace(input.name)) {
    throw new Error('This namespace is reserved');
  }

  // Check if already exists
  const existing = await getNamespaceByName(input.name);
  if (existing) {
    throw new Error('Namespace already exists');
  }

  // Create namespace
  const namespaces = await query<Namespace>(
    `INSERT INTO namespaces (name, owner_id, protection_level, description) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [input.name, input.owner_id, input.protection_level || 'protected', input.description || null]
  );

  return namespaces[0];
}

/**
 * Update namespace (only owner can do this)
 */
export async function updateNamespace(
  name: string,
  userId: string,
  input: UpdateNamespaceInput
): Promise<Namespace> {
  // Get namespace
  const namespace = await getNamespaceByName(name);
  if (!namespace) {
    throw new Error('Namespace not found');
  }

  // Verify ownership
  if (namespace.owner_id !== userId) {
    throw new Error('Unauthorized: You do not own this namespace');
  }

  // Build update query
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (input.protection_level !== undefined) {
    updates.push(`protection_level = $${paramIndex++}`);
    values.push(input.protection_level);
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(input.description || null);
  }

  if (updates.length === 0) {
    return namespace; // No changes
  }

  values.push(name);

  const namespaces = await query<Namespace>(
    `UPDATE namespaces SET ${updates.join(', ')} WHERE name = $${paramIndex} RETURNING *`,
    values
  );

  return namespaces[0];
}

/**
 * Check if user can publish to namespace
 */
export async function canPublishToNamespace(
  namespaceName: string,
  userId: string
): Promise<boolean> {
  const namespace = await getNamespaceByName(namespaceName);

  if (!namespace) {
    // Namespace doesn't exist - user can claim it (unless reserved)
    return !isReservedNamespace(namespaceName);
  }

  // Check protection level
  switch (namespace.protection_level) {
    case 'public':
      return true; // Anyone can publish

    case 'protected':
    case 'private':
      return namespace.owner_id === userId; // Only owner can publish

    default:
      return false;
  }
}

/**
 * Check if user can view namespace packages
 */
export async function canViewNamespace(
  namespaceName: string,
  userId: string | null
): Promise<boolean> {
  const namespace = await getNamespaceByName(namespaceName);

  if (!namespace) {
    return false; // Namespace doesn't exist
  }

  // Check protection level
  switch (namespace.protection_level) {
    case 'public':
    case 'protected':
      return true; // Anyone can view

    case 'private':
      return userId !== null && namespace.owner_id === userId; // Only owner can view

    default:
      return false;
  }
}

/**
 * Auto-claim namespace when publishing (if it doesn't exist)
 */
export async function autoClaimNamespace(
  namespaceName: string,
  userId: string,
  protectionLevel: ProtectionLevel = 'protected'
): Promise<Namespace> {
  const existing = await getNamespaceByName(namespaceName);

  if (existing) {
    return existing;
  }

  // Create namespace
  return await createNamespace({
    name: namespaceName,
    owner_id: userId,
    protection_level: protectionLevel,
  });
}

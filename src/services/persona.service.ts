import { query } from '../db.js';
import type { Persona } from './auth.service.js';

export interface CreatePersonaInput {
  user_id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
}

export interface UpdatePersonaInput {
  name?: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
}

/**
 * Get all personas for a user
 */
export async function getPersonasByUserId(userId: string): Promise<Persona[]> {
  return await query<Persona>(
    'SELECT * FROM personas WHERE user_id = $1 ORDER BY is_primary DESC, created_at ASC',
    [userId]
  );
}

/**
 * Get persona by ID
 */
export async function getPersonaById(personaId: string): Promise<Persona | null> {
  const personas = await query<Persona>(
    'SELECT * FROM personas WHERE id = $1',
    [personaId]
  );
  return personas[0] || null;
}

/**
 * Create a new persona
 */
export async function createPersona(input: CreatePersonaInput): Promise<Persona> {
  // Validate unique name per user
  const existing = await query<Persona>(
    'SELECT * FROM personas WHERE user_id = $1 AND name = $2',
    [input.user_id, input.name]
  );

  if (existing.length > 0) {
    throw new Error('Persona with this name already exists for this user');
  }

  const personas = await query<Persona>(
    `INSERT INTO personas (user_id, name, avatar_url, bio, website) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING *`,
    [
      input.user_id,
      input.name,
      input.avatar_url || null,
      input.bio || null,
      input.website || null,
    ]
  );

  return personas[0];
}

/**
 * Update a persona
 */
export async function updatePersona(
  personaId: string,
  userId: string,
  input: UpdatePersonaInput
): Promise<Persona> {
  // Verify ownership
  const persona = await getPersonaById(personaId);
  if (!persona) {
    throw new Error('Persona not found');
  }

  if (persona.user_id !== userId) {
    throw new Error('Unauthorized: You do not own this persona');
  }

  // Check name uniqueness if changing name
  if (input.name && input.name !== persona.name) {
    const existing = await query<Persona>(
      'SELECT * FROM personas WHERE user_id = $1 AND name = $2 AND id != $3',
      [userId, input.name, personaId]
    );

    if (existing.length > 0) {
      throw new Error('Persona with this name already exists for this user');
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }

  if (input.avatar_url !== undefined) {
    updates.push(`avatar_url = $${paramIndex++}`);
    values.push(input.avatar_url || null);
  }

  if (input.bio !== undefined) {
    updates.push(`bio = $${paramIndex++}`);
    values.push(input.bio || null);
  }

  if (input.website !== undefined) {
    updates.push(`website = $${paramIndex++}`);
    values.push(input.website || null);
  }

  if (updates.length === 0) {
    return persona; // No changes
  }

  values.push(personaId);

  const personas = await query<Persona>(
    `UPDATE personas SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return personas[0];
}

/**
 * Delete a persona (cannot delete primary persona if it's the only one)
 */
export async function deletePersona(personaId: string, userId: string): Promise<void> {
  // Verify ownership
  const persona = await getPersonaById(personaId);
  if (!persona) {
    throw new Error('Persona not found');
  }

  if (persona.user_id !== userId) {
    throw new Error('Unauthorized: You do not own this persona');
  }

  // Check if this is the only persona
  const allPersonas = await getPersonasByUserId(userId);
  if (allPersonas.length === 1) {
    throw new Error('Cannot delete your only persona');
  }

  // Check if this is the primary persona
  if (persona.is_primary) {
    throw new Error('Cannot delete primary persona. Set another persona as primary first.');
  }

  await query('DELETE FROM personas WHERE id = $1', [personaId]);
}

/**
 * Set a persona as primary (unsets all others)
 */
export async function setPrimaryPersona(personaId: string, userId: string): Promise<Persona> {
  // Verify ownership
  const persona = await getPersonaById(personaId);
  if (!persona) {
    throw new Error('Persona not found');
  }

  if (persona.user_id !== userId) {
    throw new Error('Unauthorized: You do not own this persona');
  }

  // Use transaction to ensure atomicity
  const client = await (await import('../db.js')).getClient();

  try {
    await client.query('BEGIN');

    // Unset all primary flags for this user
    await client.query(
      'UPDATE personas SET is_primary = false WHERE user_id = $1',
      [userId]
    );

    // Set this persona as primary
    const result = await client.query<Persona>(
      'UPDATE personas SET is_primary = true WHERE id = $1 RETURNING *',
      [personaId]
    );

    await client.query('COMMIT');

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


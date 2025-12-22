import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { redisClient } from '../redis.js';
import { config } from '../config.js';
import * as crypto from '../crypto.js';

export interface User {
  id: string;
  public_key: string;
  email: string | null;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Persona {
  id: string;
  user_id: string;
  name: string;
  is_primary: boolean;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  created_at: Date;
}

export interface AuthChallenge {
  challenge: string;
  expires_at: Date;
}

export interface AuthToken {
  token: string;
  expires_in: number;
  user: User;
  primary_persona: Persona;
}

/**
 * Register a new user with their public key
 */
export async function registerUser(publicKey: string, email?: string): Promise<User> {
  // Validate public key format
  if (!crypto.isValidPublicKey(publicKey)) {
    throw new Error('Invalid public key format');
  }

  // Check if user already exists
  const existing = await query<User>(
    'SELECT * FROM users WHERE public_key = $1',
    [publicKey]
  );

  if (existing.length > 0) {
    throw new Error('User with this public key already exists');
  }

  // Create user
  const users = await query<User>(
    `INSERT INTO users (public_key, email) 
     VALUES ($1, $2) 
     RETURNING *`,
    [publicKey, email || null]
  );

  const user = users[0];

  // Create default persona
  await query(
    `INSERT INTO personas (user_id, name, is_primary) 
     VALUES ($1, $2, $3)`,
    [user.id, 'Anonymous User', true]
  );

  // Store active keypair
  await query(
    `INSERT INTO user_keypairs (user_id, public_key, status) 
     VALUES ($1, $2, $3)`,
    [user.id, publicKey, 'active']
  );

  return user;
}

/**
 * Generate authentication challenge for a public key
 */
export async function generateAuthChallenge(publicKey: string): Promise<AuthChallenge> {
  // Validate public key format
  if (!crypto.isValidPublicKey(publicKey)) {
    throw new Error('Invalid public key format');
  }

  // Check if user exists
  const users = await query<User>(
    'SELECT * FROM users WHERE public_key = $1',
    [publicKey]
  );

  if (users.length === 0) {
    throw new Error('User not found with this public key');
  }

  // Generate challenge
  const challenge = crypto.generateChallenge();
  const expiresAt = new Date(Date.now() + config.challengeTTL * 1000);

  // Store in Redis (preferred) or fallback to DB
  try {
    await redisClient.setEx(
      `auth:challenge:${publicKey}`,
      config.challengeTTL,
      challenge
    );
  } catch (error) {
    console.error('Redis error, falling back to DB:', error);
    await query(
      `INSERT INTO auth_challenges (public_key, challenge, expires_at) 
       VALUES ($1, $2, $3)`,
      [publicKey, challenge, expiresAt]
    );
  }

  return {
    challenge,
    expires_at: expiresAt,
  };
}

/**
 * Authenticate user with signed challenge
 */
export async function authenticateWithChallenge(
  publicKey: string,
  challenge: string,
  signature: string
): Promise<AuthToken> {
  // Validate inputs
  if (!crypto.isValidPublicKey(publicKey)) {
    throw new Error('Invalid public key format');
  }

  // Retrieve and verify challenge from Redis or DB
  let storedChallenge: string | null = null;

  try {
    storedChallenge = await redisClient.get(`auth:challenge:${publicKey}`);
    if (storedChallenge) {
      // Mark as used (delete from Redis)
      await redisClient.del(`auth:challenge:${publicKey}`);
    }
  } catch (error) {
    console.error('Redis error, falling back to DB:', error);
  }

  if (!storedChallenge) {
    // Fallback to DB
    const challenges = await query<{ challenge: string; expires_at: Date; used_at: Date | null }>(
      `SELECT challenge, expires_at, used_at 
       FROM auth_challenges 
       WHERE public_key = $1 AND challenge = $2`,
      [publicKey, challenge]
    );

    if (challenges.length === 0) {
      throw new Error('Invalid or expired challenge');
    }

    const dbChallenge = challenges[0];

    if (dbChallenge.used_at) {
      throw new Error('Challenge already used');
    }

    if (new Date() > new Date(dbChallenge.expires_at)) {
      throw new Error('Challenge expired');
    }

    storedChallenge = dbChallenge.challenge;

    // Mark as used
    await query(
      `UPDATE auth_challenges SET used_at = NOW() WHERE challenge = $1`,
      [challenge]
    );
  }

  if (storedChallenge !== challenge) {
    throw new Error('Challenge mismatch');
  }

  // Verify signature
  const isValid = crypto.verify(challenge, signature, publicKey);

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  // Get user
  const users = await query<User>(
    'SELECT * FROM users WHERE public_key = $1',
    [publicKey]
  );

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const user = users[0];

  // Get primary persona
  const personas = await query<Persona>(
    'SELECT * FROM personas WHERE user_id = $1 AND is_primary = true',
    [user.id]
  );

  if (personas.length === 0) {
    throw new Error('No primary persona found');
  }

  const primaryPersona = personas[0];

  // Generate JWT
  const payload = {
    user_id: user.id,
    public_key: user.public_key,
    persona_id: primaryPersona.id,
    is_admin: user.is_admin,
  };
  const secret = config.jwt.secret;
  const options = { expiresIn: config.jwt.expiresIn };
  const token = (jwt as any).sign(payload, secret, options);

  return {
    token,
    expires_in: 86400, // 24 hours in seconds
    user,
    primary_persona: primaryPersona,
  };
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<{ user_id: string; public_key: string; persona_id: string }> {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      user_id: string;
      public_key: string;
      persona_id: string;
    };
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const users = await query<User>(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return users[0] || null;
}


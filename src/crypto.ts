import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

/**
 * Ed25519 cryptographic utilities for keypair-based authentication
 */

export interface KeyPair {
  publicKey: string; // hex-encoded
  secretKey: string; // hex-encoded
}

/**
 * Generate a new Ed25519 keypair
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
    secretKey: Buffer.from(keyPair.secretKey).toString('hex'),
  };
}

/**
 * Sign a message with a secret key
 */
export function sign(message: string, secretKey: string): string {
  const messageBytes = Buffer.from(message, 'utf8');
  const secretKeyBytes = Buffer.from(secretKey, 'hex');
  const signature = nacl.sign.detached(messageBytes, secretKeyBytes);
  return Buffer.from(signature).toString('hex');
}

/**
 * Verify a signature with a public key
 */
export function verify(message: string, signature: string, publicKey: string): boolean {
  try {
    const messageBytes = Buffer.from(message, 'utf8');
    const signatureBytes = Buffer.from(signature, 'hex');
    const publicKeyBytes = Buffer.from(publicKey, 'hex');

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Generate a random challenge for authentication
 */
export function generateChallenge(): string {
  const bytes = nacl.randomBytes(32);
  return Buffer.from(bytes).toString('hex');
}

/**
 * Validate public key format
 */
export function isValidPublicKey(publicKey: string): boolean {
  try {
    const bytes = Buffer.from(publicKey, 'hex');
    return bytes.length === nacl.sign.publicKeyLength; // 32 bytes
  } catch {
    return false;
  }
}

/**
 * Validate secret key format
 */
export function isValidSecretKey(secretKey: string): boolean {
  try {
    const bytes = Buffer.from(secretKey, 'hex');
    return bytes.length === nacl.sign.secretKeyLength; // 64 bytes
  } catch {
    return false;
  }
}

/**
 * Format keypair as PEM (for download)
 */
export function formatKeyPairAsPEM(keyPair: KeyPair): string {
  const timestamp = new Date().toISOString();
  return `-----BEGIN PROMPT-GEN MARKETPLACE KEYPAIR-----
Created: ${timestamp}

Public Key:
${keyPair.publicKey}

Secret Key (KEEP PRIVATE!):
${keyPair.secretKey}

-----END PROMPT-GEN MARKETPLACE KEYPAIR-----

⚠️  IMPORTANT: Keep this file safe and private!
This is the ONLY copy of your secret key.
If you lose it, you will lose access to your account.
`;
}

/**
 * Parse keypair from PEM format
 */
export function parseKeyPairFromPEM(pem: string): KeyPair | null {
  try {
    const publicKeyMatch = pem.match(/Public Key:\s*([0-9a-f]+)/i);
    const secretKeyMatch = pem.match(/Secret Key.*?:\s*([0-9a-f]+)/i);

    if (!publicKeyMatch || !secretKeyMatch) {
      return null;
    }

    const publicKey = publicKeyMatch[1];
    const secretKey = secretKeyMatch[1];

    if (isValidPublicKey(publicKey) && isValidSecretKey(secretKey)) {
      return { publicKey, secretKey };
    }

    return null;
  } catch {
    return null;
  }
}

import { describe, it, expect } from 'vitest';
import * as crypto from './crypto.js';

describe('Crypto utilities', () => {
  describe('generateKeyPair', () => {
    it('should generate a valid keypair', () => {
      const keyPair = crypto.generateKeyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.secretKey).toBeDefined();
      expect(crypto.isValidPublicKey(keyPair.publicKey)).toBe(true);
      expect(crypto.isValidSecretKey(keyPair.secretKey)).toBe(true);
    });

    it('should generate different keypairs each time', () => {
      const keyPair1 = crypto.generateKeyPair();
      const keyPair2 = crypto.generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.secretKey).not.toBe(keyPair2.secretKey);
    });
  });

  describe('sign and verify', () => {
    it('should sign and verify a message', () => {
      const keyPair = crypto.generateKeyPair();
      const message = 'test message';
      const signature = crypto.sign(message, keyPair.secretKey);

      expect(signature).toBeDefined();
      expect(crypto.verify(message, signature, keyPair.publicKey)).toBe(true);
    });

    it('should fail verification with wrong public key', () => {
      const keyPair1 = crypto.generateKeyPair();
      const keyPair2 = crypto.generateKeyPair();
      const message = 'test message';
      const signature = crypto.sign(message, keyPair1.secretKey);

      expect(crypto.verify(message, signature, keyPair2.publicKey)).toBe(false);
    });

    it('should fail verification with tampered message', () => {
      const keyPair = crypto.generateKeyPair();
      const message = 'test message';
      const signature = crypto.sign(message, keyPair.secretKey);

      expect(crypto.verify('tampered message', signature, keyPair.publicKey)).toBe(false);
    });

    it('should fail verification with tampered signature', () => {
      const keyPair = crypto.generateKeyPair();
      const message = 'test message';
      const signature = crypto.sign(message, keyPair.secretKey);
      const tamperedSignature = signature.substring(0, signature.length - 2) + 'ff';

      expect(crypto.verify(message, tamperedSignature, keyPair.publicKey)).toBe(false);
    });
  });

  describe('generateChallenge', () => {
    it('should generate a random challenge', () => {
      const challenge = crypto.generateChallenge();

      expect(challenge).toBeDefined();
      expect(challenge.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate different challenges each time', () => {
      const challenge1 = crypto.generateChallenge();
      const challenge2 = crypto.generateChallenge();

      expect(challenge1).not.toBe(challenge2);
    });
  });

  describe('isValidPublicKey', () => {
    it('should validate correct public key', () => {
      const keyPair = crypto.generateKeyPair();
      expect(crypto.isValidPublicKey(keyPair.publicKey)).toBe(true);
    });

    it('should reject invalid public key', () => {
      expect(crypto.isValidPublicKey('invalid')).toBe(false);
      expect(crypto.isValidPublicKey('123456')).toBe(false);
      expect(crypto.isValidPublicKey('')).toBe(false);
    });
  });

  describe('formatKeyPairAsPEM and parseKeyPairFromPEM', () => {
    it('should format and parse keypair', () => {
      const keyPair = crypto.generateKeyPair();
      const pem = crypto.formatKeyPairAsPEM(keyPair);

      expect(pem).toContain('BEGIN PROMPT-GEN MARKETPLACE KEYPAIR');
      expect(pem).toContain('END PROMPT-GEN MARKETPLACE KEYPAIR');
      expect(pem).toContain(keyPair.publicKey);
      expect(pem).toContain(keyPair.secretKey);

      const parsed = crypto.parseKeyPairFromPEM(pem);
      expect(parsed).not.toBeNull();
      expect(parsed!.publicKey).toBe(keyPair.publicKey);
      expect(parsed!.secretKey).toBe(keyPair.secretKey);
    });

    it('should return null for invalid PEM', () => {
      const parsed = crypto.parseKeyPairFromPEM('invalid pem content');
      expect(parsed).toBeNull();
    });
  });
});

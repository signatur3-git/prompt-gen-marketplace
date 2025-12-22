import { describe, it, expect } from 'vitest';
import * as namespaceService from '../services/namespace.service.js';

describe('Namespace service', () => {
  describe('isValidNamespaceName', () => {
    it('should accept valid namespace names', () => {
      expect(namespaceService.isValidNamespaceName('valid')).toBe(true);
      expect(namespaceService.isValidNamespaceName('my-namespace')).toBe(true);
      expect(namespaceService.isValidNamespaceName('my.namespace')).toBe(true);
      expect(namespaceService.isValidNamespaceName('namespace123')).toBe(true);
      expect(namespaceService.isValidNamespaceName('a1')).toBe(true);
      // Test realistic long namespaces
      expect(namespaceService.isValidNamespaceName('p.signatur3.midjourney.v8.sref.mining')).toBe(true);
      expect(namespaceService.isValidNamespaceName('p.signatur3.midjourney.v8.sref.favorites')).toBe(true);
      expect(namespaceService.isValidNamespaceName('p.signatur3.midjourney.v8.showcase')).toBe(true);
    });

    it('should reject namespace names that are too short', () => {
      expect(namespaceService.isValidNamespaceName('a')).toBe(false);
    });

    it('should reject namespace names that are too long', () => {
      const longName = 'a'.repeat(257); // 256 is max, so 257 should fail
      expect(namespaceService.isValidNamespaceName(longName)).toBe(false);

      // 256 characters should be valid
      const maxLengthName = 'a' + '.b'.repeat(127); // Creates "a.b.b.b..." up to 256 chars
      expect(namespaceService.isValidNamespaceName(maxLengthName)).toBe(true);
    });

    it('should reject namespace names with invalid characters', () => {
      expect(namespaceService.isValidNamespaceName('My-Namespace')).toBe(false); // uppercase
      expect(namespaceService.isValidNamespaceName('my_namespace')).toBe(false); // underscore
      expect(namespaceService.isValidNamespaceName('my namespace')).toBe(false); // space
      expect(namespaceService.isValidNamespaceName('my@namespace')).toBe(false); // special char
    });

    it('should reject namespace names not starting with letter', () => {
      expect(namespaceService.isValidNamespaceName('1namespace')).toBe(false);
      expect(namespaceService.isValidNamespaceName('-namespace')).toBe(false);
      expect(namespaceService.isValidNamespaceName('.namespace')).toBe(false);
    });

    it('should reject namespace names not ending with letter or number', () => {
      expect(namespaceService.isValidNamespaceName('namespace-')).toBe(false);
      expect(namespaceService.isValidNamespaceName('namespace.')).toBe(false);
    });

    it('should reject namespace names with consecutive dots or hyphens', () => {
      expect(namespaceService.isValidNamespaceName('name..space')).toBe(false);
      expect(namespaceService.isValidNamespaceName('name--space')).toBe(false);
      expect(namespaceService.isValidNamespaceName('name.-space')).toBe(false);
    });
  });

  describe('isReservedNamespace', () => {
    it('should identify reserved namespaces', () => {
      expect(namespaceService.isReservedNamespace('system')).toBe(true);
      expect(namespaceService.isReservedNamespace('admin')).toBe(true);
      expect(namespaceService.isReservedNamespace('api')).toBe(true);
      expect(namespaceService.isReservedNamespace('system.internal')).toBe(true);
      expect(namespaceService.isReservedNamespace('admin.users')).toBe(true);
    });

    it('should not flag non-reserved namespaces', () => {
      expect(namespaceService.isReservedNamespace('my-namespace')).toBe(false);
      expect(namespaceService.isReservedNamespace('user.namespace')).toBe(false);
      expect(namespaceService.isReservedNamespace('mysystem')).toBe(false); // contains "system" but doesn't start with it
    });
  });
});


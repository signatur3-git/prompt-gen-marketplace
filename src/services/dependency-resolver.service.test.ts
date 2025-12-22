import { describe, it, expect } from 'vitest';
import * as resolver from './dependency-resolver.service';

describe('Dependency Resolver', () => {
  describe('isValidVersionConstraint', () => {
    it('should accept valid semver constraints', () => {
      expect(resolver.isValidVersionConstraint('^1.0.0')).toBe(true);
      expect(resolver.isValidVersionConstraint('~2.1.0')).toBe(true);
      expect(resolver.isValidVersionConstraint('>=3.0.0')).toBe(true);
      expect(resolver.isValidVersionConstraint('1.0.0 - 2.0.0')).toBe(true);
      expect(resolver.isValidVersionConstraint('*')).toBe(true);
      expect(resolver.isValidVersionConstraint('1.x')).toBe(true);
    });

    it('should reject invalid constraints', () => {
      expect(resolver.isValidVersionConstraint('invalid')).toBe(false);
      expect(resolver.isValidVersionConstraint('not a version')).toBe(false);
      expect(resolver.isValidVersionConstraint('abc.def.ghi')).toBe(false);
    });
  });

  describe('getLatestMatchingVersion', () => {
    const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0'];

    it('should find latest matching version with caret', () => {
      expect(resolver.getLatestMatchingVersion(versions, '^1.0.0')).toBe('1.2.0');
      expect(resolver.getLatestMatchingVersion(versions, '^2.0.0')).toBe('2.1.0');
    });

    it('should find latest matching version with tilde', () => {
      expect(resolver.getLatestMatchingVersion(versions, '~1.1.0')).toBe('1.1.0');
      expect(resolver.getLatestMatchingVersion(versions, '~2.0.0')).toBe('2.0.0');
    });

    it('should find latest matching version with range', () => {
      expect(resolver.getLatestMatchingVersion(versions, '>=1.1.0 <2.0.0')).toBe('1.2.0');
      expect(resolver.getLatestMatchingVersion(versions, '>1.0.0')).toBe('2.1.0');
    });

    it('should return null when no match', () => {
      expect(resolver.getLatestMatchingVersion(versions, '^3.0.0')).toBe(null);
      expect(resolver.getLatestMatchingVersion(versions, '<1.0.0')).toBe(null);
    });
  });

  describe('compareVersions', () => {
    it('should compare versions correctly', () => {
      expect(resolver.compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(resolver.compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(resolver.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(resolver.compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
      expect(resolver.compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    });
  });

  describe('getInstallOrder', () => {
    it('should return dependencies in topological order', () => {
      const manifest = {
        package: 'test.main',
        version: '1.0.0',
        resolved_at: '2025-12-22T00:00:00Z',
        dependencies: [
          {
            package: 'test.a',
            version: '1.0.0',
            checksum: 'abc',
            dependencies: ['test.b', 'test.c'],
          },
          {
            package: 'test.b',
            version: '1.0.0',
            checksum: 'def',
            dependencies: ['test.d'],
          },
          {
            package: 'test.c',
            version: '1.0.0',
            checksum: 'ghi',
            dependencies: [],
          },
          {
            package: 'test.d',
            version: '1.0.0',
            checksum: 'jkl',
            dependencies: [],
          },
        ],
      };

      const order = resolver.getInstallOrder(manifest);

      // c and d should come before their dependents
      const cIndex = order.indexOf('test.c');
      const dIndex = order.indexOf('test.d');
      const bIndex = order.indexOf('test.b');
      const aIndex = order.indexOf('test.a');

      expect(cIndex).toBeGreaterThan(-1);
      expect(dIndex).toBeGreaterThan(-1);
      expect(bIndex).toBeGreaterThan(-1);
      expect(aIndex).toBeGreaterThan(-1);

      // d must come before b
      expect(dIndex).toBeLessThan(bIndex);

      // b and c must come before a
      expect(bIndex).toBeLessThan(aIndex);
      expect(cIndex).toBeLessThan(aIndex);
    });

    it('should handle single dependency', () => {
      const manifest = {
        package: 'test.main',
        version: '1.0.0',
        resolved_at: '2025-12-22T00:00:00Z',
        dependencies: [
          {
            package: 'test.only',
            version: '1.0.0',
            checksum: 'abc',
            dependencies: [],
          },
        ],
      };

      const order = resolver.getInstallOrder(manifest);
      expect(order).toEqual(['test.only']);
    });

    it('should handle no dependencies', () => {
      const manifest = {
        package: 'test.main',
        version: '1.0.0',
        resolved_at: '2025-12-22T00:00:00Z',
        dependencies: [],
      };

      const order = resolver.getInstallOrder(manifest);
      expect(order).toEqual([]);
    });
  });
});


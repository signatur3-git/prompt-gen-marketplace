import { describe, it, expect } from 'vitest';
import * as validator from './package-validator.service';

describe('Package Validator', () => {
  describe('isValidPackageId', () => {
    it('should accept valid package IDs', () => {
      expect(validator.isValidPackageId('namespace.package')).toBe(true);
      expect(validator.isValidPackageId('featured.camera')).toBe(true);
      expect(validator.isValidPackageId('midjourney.v8')).toBe(true);
      expect(validator.isValidPackageId('a.b.c')).toBe(true);
    });

    it('should reject invalid package IDs', () => {
      expect(validator.isValidPackageId('single')).toBe(false);
      expect(validator.isValidPackageId('Namespace.Package')).toBe(false);
      expect(validator.isValidPackageId('namespace_package')).toBe(false);
      expect(validator.isValidPackageId('namespace.package.')).toBe(false);
      expect(validator.isValidPackageId('.namespace.package')).toBe(false);
    });
  });

  describe('isValidVersion', () => {
    it('should accept valid semver versions', () => {
      expect(validator.isValidVersion('1.0.0')).toBe(true);
      expect(validator.isValidVersion('0.1.0')).toBe(true);
      expect(validator.isValidVersion('10.20.30')).toBe(true);
      expect(validator.isValidVersion('1.0.0-alpha')).toBe(true);
      expect(validator.isValidVersion('1.0.0-beta.1')).toBe(true);
      expect(validator.isValidVersion('1.0.0+build.123')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(validator.isValidVersion('1.0')).toBe(false);
      expect(validator.isValidVersion('v1.0.0')).toBe(false);
      expect(validator.isValidVersion('1.0.0.')).toBe(false);
      expect(validator.isValidVersion('1')).toBe(false);
    });
  });

  describe('parsePackageId', () => {
    it('should parse package IDs correctly', () => {
      expect(validator.parsePackageId('namespace.package')).toEqual({
        namespace: 'namespace',
        name: 'package',
      });

      expect(validator.parsePackageId('featured.camera')).toEqual({
        namespace: 'featured',
        name: 'camera',
      });

      expect(validator.parsePackageId('a.b.c')).toEqual({
        namespace: 'a.b',
        name: 'c',
      });
    });

    it('should throw on invalid package IDs', () => {
      expect(() => validator.parsePackageId('single')).toThrow();
    });
  });

  describe('generateStoragePath', () => {
    it('should generate correct storage paths', () => {
      expect(validator.generateStoragePath('featured', 'camera', '1.0.0')).toBe(
        'packages/featured/camera/1.0.0/camera-1.0.0.yaml'
      );

      expect(validator.generateStoragePath('midjourney', 'v8', '2.1.5')).toBe(
        'packages/midjourney/v8/2.1.5/v8-2.1.5.yaml'
      );
    });
  });

  describe('calculateChecksum', () => {
    it('should calculate consistent checksums', () => {
      const content = 'test content';
      const checksum1 = validator.calculateChecksum(content);
      const checksum2 = validator.calculateChecksum(content);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different checksums for different content', () => {
      const checksum1 = validator.calculateChecksum('content 1');
      const checksum2 = validator.calculateChecksum('content 2');

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('validatePackage', () => {
    const validPackage = `
id: test.package
version: 1.0.0
metadata:
  name: Test Package
  description: A test package
  authors: [Test Author]
namespaces:
  test:
    id: test
    datatypes:
      colors:
        name: colors
        values:
          - text: red
`;

    it('should accept valid packages', () => {
      const result = validator.validatePackage(validPackage);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed?.id).toBe('test.package');
      expect(result.parsed?.metadata.name).toBe('Test Package');
    });

    it('should reject package without id', () => {
      const invalidPackage = `
version: 1.0.0
metadata:
  name: Test Package
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should reject package without version', () => {
      const invalidPackage = `
id: test.package
metadata:
  name: Test Package
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'version')).toBe(true);
    });

    it('should reject package without metadata', () => {
      const invalidPackage = `
id: test.package
version: 1.0.0
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'metadata')).toBe(true);
    });

    it('should reject package without metadata.name', () => {
      const invalidPackage = `
id: test.package
version: 1.0.0
metadata:
  description: A test package
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'metadata.name')).toBe(true);
    });

    it('should reject package without namespaces', () => {
      const invalidPackage = `
id: test.package
version: 1.0.0
metadata:
  name: Test Package
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'namespaces')).toBe(true);
    });

    it('should reject package with invalid id format', () => {
      const invalidPackage = `
id: INVALID
version: 1.0.0
metadata:
  name: Test Package
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should reject package with invalid version format', () => {
      const invalidPackage = `
id: test.package
version: 1.0
metadata:
  name: Test Package
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'version')).toBe(true);
    });

    it('should reject invalid YAML', () => {
      const invalidYaml = `
id: test.package
version: 1.0.0
metadata:
  name: Test Package
  invalid: [unclosed array
`;
      const result = validator.validatePackage(invalidYaml);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'yaml')).toBe(true);
    });

    it('should validate dependencies correctly', () => {
      const packageWithDeps = `
id: test.package
version: 1.0.0
metadata:
  name: Test Package
dependencies:
  - package: test.base
    version: "1.0.0"
  - package: test.utils
    version: "^2.0.0"
    path: "./deps/utils.yaml"
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(packageWithDeps);
      expect(result.valid).toBe(true);
      expect(result.parsed?.dependencies).toHaveLength(2);
    });

    it('should reject dependency without package field', () => {
      const invalidPackage = `
id: test.package
version: 1.0.0
metadata:
  name: Test Package
dependencies:
  - version: "1.0.0"
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('dependencies') && e.message.includes('package'))).toBe(true);
    });

    it('should reject dependency without version field', () => {
      const invalidPackage = `
id: test.package
version: 1.0.0
metadata:
  name: Test Package
dependencies:
  - package: test.base
namespaces:
  test:
    id: test
`;
      const result = validator.validatePackage(invalidPackage);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('dependencies') && e.message.includes('version'))).toBe(true);
    });
  });
});


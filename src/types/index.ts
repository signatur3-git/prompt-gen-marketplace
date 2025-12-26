/**
 * Shared type definitions for the marketplace
 * These types represent the core domain models
 */

// Database query parameter types
export type QueryParams = (string | number | boolean | null | Date)[];

// Error handling
export type ErrorWithMessage = Error | { message: string };

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

// Package namespace content structures
export interface Namespace {
  id: string;
  rulebooks?: Record<string, Rulebook>;
  rules?: Record<string, Rule>;
  prompt_sections?: Record<string, PromptSection>;
  datatypes?: Record<string, Datatype>;
  separator_sets?: Record<string, SeparatorSet>;
  decisions?: Decision[];
}

export interface Rulebook {
  name?: string;
  description?: string;
  entry_points?: string[];
  [key: string]: unknown;
}

export interface Rule {
  id: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PromptSection {
  id?: string;
  name?: string;
  template?: string;
  [key: string]: unknown;
}

export interface Datatype {
  name?: string;
  values?: Array<{
    text: string;
    weight?: number;
    tags?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export interface SeparatorSet {
  [key: string]: unknown;
}

export interface Decision {
  [key: string]: unknown;
}

// Parsed package structure (from YAML)
export interface ParsedPackage {
  id: string;
  version: string;
  metadata: PackageMetadata;
  dependencies?: PackageDependency[];
  namespaces: Record<string, Namespace>;

  // Optional top-level properties (for backward compatibility or validation)
  datatypes?: Record<string, Datatype>;
  prompt_sections?: Record<string, PromptSection>;
  rulebooks?: Record<string, Rulebook>;
  separator_sets?: Record<string, SeparatorSet>;
}

export interface PackageMetadata {
  name: string;
  description?: string;
  authors?: string[];
  author?: string; // Legacy field
  license?: string;
  tags?: string[];
  bypass_filters?: boolean;
  compatibleWith?: string[];
  [key: string]: unknown;
}

export interface PackageDependency {
  package: string;
  version: string;
  path?: string;
}

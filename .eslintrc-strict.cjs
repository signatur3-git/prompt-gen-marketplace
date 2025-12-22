/**
 * STRICT ESLint Configuration
 *
 * This is the target configuration for maximum code quality.
 * Use this when you're ready to fix all type safety issues.
 *
 * To use: mv .eslintrc.cjs .eslintrc-lenient.cjs && mv .eslintrc-strict.cjs .eslintrc.cjs
 *
 * Current status: 259 issues to fix
 * - 88 errors (blocking)
 * - 171 warnings (should fix)
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Strict rules - all errors
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-base-to-string': 'error',
    'no-console': ['error', { allow: ['warn', 'error'] }],

    // Still disabled - too opinionated
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', '*.js', '**/*.test.ts', 'vite.config.ts', 'vitest.config.ts', 'vitest.*.config.ts'],
};


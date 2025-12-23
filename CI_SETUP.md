# CI/CD and Code Quality Setup

This document describes the CI/CD pipeline and code quality tools configured for this project.

## Overview

We've configured a strict validation pipeline that runs both locally and in CI. The goal is to ensure **local builds are as strict as CI builds** to prevent push frustration.

## GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

### 1. Validate Job

Runs on Ubuntu with Node.js 20.x and includes PostgreSQL + Redis services.

**Steps:**

1. **Code formatting check** - Ensures all code follows Prettier formatting rules
2. **Lint backend** - Runs ESLint on TypeScript backend code
3. **Lint frontend** - Runs ESLint on Vue/TypeScript frontend code
4. **Type check backend** - Runs TypeScript compiler in noEmit mode for backend
5. **Type check frontend** - Runs vue-tsc for frontend (currently allows failures)
6. **Run unit tests** - Executes Vitest test suite
7. **Build backend** - Compiles TypeScript to JavaScript
8. **Build frontend** - Builds Vue frontend with Vite
9. **Initialize test database** - Runs `npm run migrate:up` against the CI Postgres service
10. **Run integration tests** - Tests with real database connections

### 2. Security Job

Runs npm audit to check for dependency vulnerabilities.

## Local Development Scripts

All CI checks can be run locally using these npm scripts:

```bash
# Format code
npm run format                    # Auto-fix formatting
npm run format:check              # Check formatting without changes

# Linting
npm run lint                      # Lint backend
npm run lint:fix                  # Auto-fix backend lint issues
npm run lint:frontend             # Lint frontend
npm run lint:frontend:fix         # Auto-fix frontend lint issues

# Type checking
npm run type-check                # Type check backend
npm run type-check:frontend       # Type check frontend

# Testing
npm test                          # Run unit tests in watch mode
npm test -- --run                 # Run unit tests once
npm run test:coverage             # Run tests with coverage report
npm run test:integration          # Run integration tests

# Building
npm run build                     # Build backend
npm run build:frontend            # Build frontend
npm run build:all                 # Build both

# Validation (run all checks)
npm run validate                  # Run all checks except build
npm run validate:ci               # Run all checks including builds
```

## Code Quality Tools

### ESLint

**Backend config:** `.eslintrc.cjs`

**Current strictness:** Balanced - Catches real bugs without blocking development

**Errors (block CI):**
- Unused variables (except `_` prefixed)
- Floating promises (unawaited promises)
- Misused promises (async where sync expected)
- Console statements (except `.warn`/`.error`/`.info`)
- Async functions without await

**Warnings (should fix gradually):**
- `any` types
- Unsafe type operations (assignment, member access, calls, returns, arguments)

**Strict mode available:** `.eslintrc-strict.cjs`
- All warnings → errors
- 259 issues to fix
- Enable when ready: `mv .eslintrc-strict.cjs .eslintrc.cjs`

**Test files:** Excluded from type-checking project rules

**Frontend config:** `frontend/.eslintrc.json`

- Vue 3 recommended rules
- TypeScript support
- Component naming flexibility

### Prettier

**Config:** `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### TypeScript

**Backend:** `tsconfig.json`

- Strict mode enabled
- Catches unused locals and parameters
- No implicit returns
- No fallthrough cases

**Frontend:** `frontend/tsconfig.json`

- Vue-specific compiler options
- Bundler module resolution
- JSX preserve mode for Vue

## Pre-Push Checklist

Before pushing code, run:

```bash
npm run validate
```

This will:

1. ✅ Check code formatting
2. ✅ Lint backend and frontend
3. ✅ Type check both projects
4. ✅ Run all unit tests

If any check fails, fix the issues before pushing!

## Common Fixes

**Formatting issues:**

```bash
npm run format
```

**Lint issues:**

```bash
npm run lint:fix
npm run lint:frontend:fix
```

**Unused parameters:** Prefix with underscore:

```typescript
// ❌ Error: 'req' is declared but never used
app.get('/', (req, res) => { ... })

// ✅ OK: Underscore prefix indicates intentionally unused
app.get('/', (_req, res) => { ... })
```

**Type errors:** Fix the actual type issues or add proper type annotations.

## Dependencies Added

- `@types/uuid` - Type definitions for uuid package
- `@vue/eslint-config-typescript` - Vue + TypeScript ESLint config
- `eslint-plugin-vue` - Vue.js ESLint plugin
- `vue-tsc` - Vue TypeScript compiler for type checking

## Notes

- Frontend type checking currently allows failures due to some library type incompatibilities
- This will be addressed in future updates but won't block CI
- The goal is catching real bugs, not fighting with type definitions

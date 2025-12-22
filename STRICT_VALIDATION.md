# Strict validation (CI parity)

This repo aims for **no surprises on push** by keeping local validation aligned with GitHub Actions.

The “strict” part means:
- **Formatting is enforced** (Prettier)
- **Type checks must pass** (tsc + vue-tsc)
- **Lint must pass within a warning budget** (so the baseline doesn’t regress)
- **Unit + integration tests must pass**

> Note: Some checks intentionally allow a *small* number of warnings for now (warning budgets). The budget is treated as a ratchet: it should only go **down** over time.

---

## Quick start

### Fast local validation (no Docker)

Runs the same checks CI runs (format, lint, typecheck, unit tests, builds). This is what you’ll use most of the time.

```powershell
npm run validate
```

### Full CI-parity validation (with Docker)

Spins up a dedicated Postgres+Redis stack with **random host ports** to avoid conflicts, then runs *everything* including integration tests.

```powershell
npm run validate:ci
```

---

## Source of truth: what CI runs

GitHub Actions (`.github/workflows/ci.yml`) runs these steps in order:

1. `npm ci`
2. `npm run format:check`
3. `npm run lint`
4. `npm run lint:frontend`
5. `npm run type-check`
6. `npm run type-check:frontend`
7. `npm test -- --run`
8. `npm run build`
9. `npm run build:frontend`
10. Initialize DB schema: `psql ... -f database/schema.sql`
11. `npm run test:integration -- --run`

Locally, `npm run validate:ci` (`scripts/ci-local.ps1`) does the same checks, but brings Postgres/Redis up via `docker-compose.ci.yml` using:
- a dedicated compose project name (`marketplace-ci`)
- random host ports (so it won’t collide with developer containers)

---

## Formatting: Prettier is the only formatter

Prettier is enforced via:
- `npm run format:check` (CI/local)
- `npm run format` (developer convenience)

### Why ESLint doesn’t enforce Vue formatting anymore

Historically, Vue ESLint stylistic rules (like `vue/max-attributes-per-line`) caused large volumes of “format” warnings that didn’t match Prettier’s output.

Current policy:
- **Prettier owns formatting**
- ESLint focuses on **correctness and type hygiene**

This is implemented in `frontend/.eslintrc.json` via `plugin:prettier/recommended` and by disabling Vue rules that commonly conflict with Prettier.

---

## Linting and warning budgets (ratchet policy)

Lint is enforced in CI, but not all warnings are blocked initially. Instead we use a warning budget.

### Backend
- Script: `npm run lint`
- Current budget: `--max-warnings 210`

### Frontend
- Script: `npm run lint:frontend`
- Current budget: `--max-warnings 37`

### Ratchet policy (important)

- Budgets exist to prevent “push frustration” while we pay down existing warnings.
- Budgets should only be adjusted **downwards** as warnings are fixed.
- If a budget must be raised (rare), do it in a dedicated PR with a clear justification.

---

## Docker Compose stacks (manual dev vs CI/test)

This repo uses **two compose stacks** on purpose:

### Manual/dev stack: `docker-compose.yml`
Use when you want stable ports for local manual testing.

```powershell
# Start
docker compose -f docker-compose.yml up -d --wait

# Stop
docker compose -f docker-compose.yml down -v
```

### CI/test stack: `docker-compose.ci.yml`
Use for conflict-proof local validation. This is what `npm run validate:ci` uses.

Key properties:
- Dedicated compose project name: `marketplace-ci`
- Random host ports (`0:5432`, `0:6379`) so it can run even if you already have Postgres/Redis running
- Always torn down at the end of the script

---

## Common failure classes and how to fix them

### 1) Prettier failures

Symptoms:
- `npm run format:check` fails

Fix:
```powershell
npm run format
```

### 2) Frontend lint: `@typescript-eslint/no-explicit-any`

Symptoms:
- `npm run lint:frontend` shows warnings like: “Unexpected any. Specify a different type”

Preferred fixes (in order):
1. **Use a real type** (best)
2. Use `unknown` and narrow it (safer than `any`)
3. As a last resort, use a targeted disable comment with context

Example patterns:

```ts
// Better than any
const value: unknown = somethingFromTheOutside;

if (typeof value === 'string') {
  // ...
}
```

### 3) Backend lint: unsafe-any / misused-promises

Symptoms:
- `no-unsafe-*` warnings (assignment/member access/calls)
- `no-misused-promises` warnings in Express route handlers

Fix strategy:
- Replace `any` with explicit types or `unknown` + validation
- Prefer wrapping async express handlers (e.g. with `express-async-handler`) consistently

### 4) Integration test failures (DB/schema/env)

Symptoms:
- `npm run test:integration` fails

CI uses `database/schema.sql` via `psql`. Make sure tests are compatible with that schema and the env vars:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

---

## Recommended everyday workflow

1. While coding:
   - `npm run format`
   - `npm run lint:fix` / `npm run lint:frontend:fix` (optional)

2. Before pushing:
   - `npm run validate`

3. Before big refactors / when touching integration behavior:
   - `npm run validate:ci`

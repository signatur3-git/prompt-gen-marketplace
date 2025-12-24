const path = require('path');
const fs = require('fs');

function resolveLocalBin(binName) {
  // On CI (Linux/macOS), use the bare shell script; on Windows, use .cmd
  const bare = path.join(process.cwd(), 'node_modules', '.bin', binName);
  const cmd = path.join(process.cwd(), 'node_modules', '.bin', `${binName}.cmd`);

  // Check which file exists and is executable
  if (fs.existsSync(bare)) {
    return bare;
  }
  if (fs.existsSync(cmd)) {
    return cmd;
  }

  // Fallback
  return bare;
}

function defaultDatabaseUrl() {
  // Prefer env var; fall back to standard local Postgres for manual installs.
  // Docker Compose users should set DATABASE_URL in .env.
  // NOTE: our docker-compose maps Postgres to host port 5433.
  return 'postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace';
}

function requiresExplicitDatabaseUrl() {
  // Guardrail: in hosted/CI environments we never want to "guess" a localhost URL.
  // Railway injects DATABASE_URL when Postgres is provisioned.
  return (
    process.env.CI === 'true' ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID)
  );
}

async function run() {
  const action = process.argv[2];
  if (!action || !['up', 'down', 'reset'].includes(action)) {
    console.error('Usage: node scripts/run-migrations.cjs <up|down|reset>');
    process.exit(1);
  }

  if (requiresExplicitDatabaseUrl() && !process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is required in CI/production. Refusing to fall back to a localhost default.'
    );
    process.exit(1);
  }

  process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl();

  const { spawnSync } = require('child_process');

  const common = ['-f', '.pgmigrate', '-m', 'database/pgmigrations', '-d', 'DATABASE_URL'];

  const runPgMigrate = (args) => {
    const bin = resolveLocalBin('node-pg-migrate');
    const res = spawnSync(bin, args, { stdio: 'inherit', env: process.env });
    if (res.status !== 0) process.exit(res.status ?? 1);
  };

  if (action === 'up') {
    runPgMigrate(['up', ...common]);
    return;
  }

  if (action === 'down') {
    runPgMigrate(['down', ...common]);
    return;
  }

  // reset
  runPgMigrate(['down', '-m', 'all', ...common]);
  runPgMigrate(['up', ...common]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

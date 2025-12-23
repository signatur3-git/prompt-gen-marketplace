const path = require('path');

function resolveLocalBin(binName) {
  // Works cross-platform and avoids PATH issues.
  const cmd = path.join(process.cwd(), 'node_modules', '.bin', `${binName}.cmd`);
  const ps1 = path.join(process.cwd(), 'node_modules', '.bin', `${binName}.ps1`);
  const bare = path.join(process.cwd(), 'node_modules', '.bin', binName);
  return { cmd, ps1, bare };
}

function defaultDatabaseUrl() {
  // Prefer env var; fall back to standard local Postgres for manual installs.
  // Docker Compose users should set DATABASE_URL in .env.
  return 'postgresql://postgres:postgres@localhost:5432/prompt_gen_marketplace';
}

async function run() {
  const action = process.argv[2];
  if (!action || !['up', 'down', 'reset'].includes(action)) {
    console.error('Usage: node scripts/run-migrations.cjs <up|down|reset>');
    process.exit(1);
  }

  process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDatabaseUrl();

  const { spawnSync } = require('child_process');

  const common = ['-f', '.pgmigrate', '-m', 'database/pgmigrations', '-d', 'DATABASE_URL'];

  const runPgMigrate = (args) => {
    // Use the local .cmd directly; avoid PATH resolution issues.
    const bin = resolveLocalBin('node-pg-migrate');
    const res = spawnSync(bin.cmd, args, { stdio: 'inherit', env: process.env });
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

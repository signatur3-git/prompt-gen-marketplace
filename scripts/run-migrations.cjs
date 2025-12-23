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

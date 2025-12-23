import pkg from 'pg';

const { Client } = pkg;

function defaultDatabaseUrl() {
  // Prefer env var; fall back to standard local Postgres for manual installs.
  // Docker Compose users should set DATABASE_URL in .env.
  return 'postgresql://postgres:postgres@localhost:5432/prompt_gen_marketplace';
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  // Keep this id stable across environments.
  const seed = {
    id: '00000000-0000-0000-0000-000000000001',
    client_id: 'prompt-gen-web',
    client_name: 'Prompt Gen Web',
    redirect_uris: ['http://localhost:5173/oauth/callback'],
  };

  await client.query(
    `INSERT INTO oauth_clients (id, client_id, client_name, redirect_uris)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id) DO UPDATE SET
       client_name = EXCLUDED.client_name,
       redirect_uris = EXCLUDED.redirect_uris`,
    [seed.id, seed.client_id, seed.client_name, seed.redirect_uris]
  );

  await client.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

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

  // Keep these IDs stable across environments.
  const seeds = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      client_id: 'prompt-gen-web',
      client_name: 'Prompt Gen Web',
      redirect_uris: [
        'http://localhost:5173/oauth/callback', // Local dev - external web app
        'https://signatur3-git.github.io/prompt-gen-web/oauth/callback', // Production - external web app
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      client_id: 'prompt-gen-desktop',
      client_name: 'Prompt Gen Desktop',
      redirect_uris: [
        'http://localhost:51234/oauth/callback', // Local HTTP server for OAuth flow
        'promptgen://oauth/callback', // Deep link URI for desktop app
      ],
    },
  ];

  for (const seed of seeds) {
    await client.query(
      `INSERT INTO oauth_clients (id, client_id, client_name, redirect_uris)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) DO UPDATE SET
         client_name = EXCLUDED.client_name,
         redirect_uris = EXCLUDED.redirect_uris`,
      [seed.id, seed.client_id, seed.client_name, seed.redirect_uris]
    );

    console.log('✅ OAuth client seeded successfully:', seed.client_id);
    console.log('   Redirect URIs:', seed.redirect_uris.join(', '));
  }

  await client.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

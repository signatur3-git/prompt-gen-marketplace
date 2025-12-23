const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const { rows } = await client.query(
    "SELECT to_regclass('public.oauth_clients') AS oauth_clients"
  );

  console.log(rows[0]);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


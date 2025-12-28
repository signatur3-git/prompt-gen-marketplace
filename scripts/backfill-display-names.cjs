// Update display_name for existing packages from their YAML metadata
const pkg = require('pg');
const yaml = require('js-yaml');
const { Client } = pkg;

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace';

async function updateDisplayNames() {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Get all packages with their latest version YAML
    const result = await client.query(`
      SELECT 
        p.id,
        p.namespace,
        p.name,
        p.display_name,
        pv.yaml_content
      FROM packages p
      JOIN package_versions pv ON pv.package_id = p.id
      WHERE pv.id = (
        SELECT id FROM package_versions 
        WHERE package_id = p.id 
        ORDER BY published_at DESC 
        LIMIT 1
      )
      AND (p.display_name IS NULL OR p.display_name = p.namespace || '.' || p.name);
    `);

    console.log(`Found ${result.rows.length} packages to update`);

    let updated = 0;
    for (const row of result.rows) {
      try {
        const parsed = yaml.load(row.yaml_content);
        const metadataName = parsed.metadata?.name;

        if (metadataName && metadataName !== row.display_name) {
          await client.query(
            'UPDATE packages SET display_name = $1, updated_at = NOW() WHERE id = $2',
            [metadataName, row.id]
          );
          console.log(`✅ Updated ${row.namespace}.${row.name}: "${metadataName}"`);
          updated++;
        }
      } catch (err) {
        console.warn(`⚠️  Could not parse YAML for ${row.namespace}.${row.name}: ${err.message}`);
      }
    }

    console.log(`\n✅ Updated ${updated} packages with display names from YAML metadata`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateDisplayNames().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


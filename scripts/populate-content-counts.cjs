/**
 * Populate content_counts for existing package versions
 * This runs after the schema migration adds the column
 */

const { Pool } = require('pg');
const yaml = require('js-yaml');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prompt_gen_marketplace';

async function populateContentCounts() {
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Populating content_counts for existing packages...');

    // Get all package versions
    const result = await pool.query('SELECT id, yaml_content FROM package_versions');
    console.log(`📦 Found ${result.rows.length} package versions to process`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const row of result.rows) {
      try {
        // Parse YAML
        const parsed = yaml.load(row.yaml_content);

        // Compute counts
        const contentCounts = {
          rulebooks: 0,
          rules: 0,
          prompt_sections: 0,
          datatypes: 0
        };

        if (parsed && parsed.namespaces && typeof parsed.namespaces === 'object') {
          for (const namespace of Object.values(parsed.namespaces)) {
            if (namespace.rulebooks && typeof namespace.rulebooks === 'object') {
              contentCounts.rulebooks += Object.keys(namespace.rulebooks).length;
            }
            if (namespace.rules && typeof namespace.rules === 'object') {
              contentCounts.rules += Object.keys(namespace.rules).length;
            }
            if (namespace.prompt_sections && typeof namespace.prompt_sections === 'object') {
              contentCounts.prompt_sections += Object.keys(namespace.prompt_sections).length;
            }
            if (namespace.datatypes && typeof namespace.datatypes === 'object') {
              contentCounts.datatypes += Object.keys(namespace.datatypes).length;
            }
          }
        }

        // Update the record
        await pool.query(
          'UPDATE package_versions SET content_counts = $1 WHERE id = $2',
          [JSON.stringify(contentCounts), row.id]
        );

        successCount++;
        if (contentCounts.rulebooks > 0 || contentCounts.rules > 0 || contentCounts.prompt_sections > 0 || contentCounts.datatypes > 0) {
          console.log(`✅ ${row.id.substring(0, 8)}: ${JSON.stringify(contentCounts)}`);
        }
      } catch (err) {
        console.error(`⚠️  Failed to process ${row.id}: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ⏭️  Skipped: ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('✨ Content counts population complete!');

  } finally {
    await pool.end();
  }
}

populateContentCounts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


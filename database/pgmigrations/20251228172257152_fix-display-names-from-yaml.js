/**
 * Fix display names for existing packages by extracting from YAML
 *
 * This migration fixes the issue where display_name was set to "namespace.name"
 * instead of the actual metadata.name from the YAML.
 *
 * This runs automatically - no manual intervention required!
 */
const yaml = require('js-yaml');

exports.up = async (pgm) => {
  const { db } = pgm;

  console.log('  🔧 Fixing display names from YAML metadata...');

  // Get all packages where display_name looks like "namespace.name"
  // (contains a dot and matches the pattern)
  const result = await db.query(`
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
    AND (
      p.display_name = p.namespace || '.' || p.name
      OR p.display_name IS NULL
    )
  `);

  if (result.rows.length === 0) {
    console.log('  ✅ All display names are already correct!');
    return;
  }

  console.log(`  📦 Found ${result.rows.length} packages to update`);

  let updated = 0;
  let failed = 0;

  for (const row of result.rows) {
    try {
      const parsed = yaml.load(row.yaml_content);
      const metadataName = parsed?.metadata?.name;

      if (metadataName && metadataName !== row.display_name) {
        await db.query(
          'UPDATE packages SET display_name = $1, updated_at = NOW() WHERE id = $2',
          [metadataName, row.id]
        );
        console.log(`     ✅ ${row.namespace}.${row.name} → "${metadataName}"`);
        updated++;
      } else if (!metadataName) {
        console.log(`     ⚠️  ${row.namespace}.${row.name}: No metadata.name in YAML, keeping fallback`);
        failed++;
      }
    } catch (err) {
      console.warn(`     ❌ ${row.namespace}.${row.name}: YAML parse error, keeping fallback`);
      failed++;
    }
  }

  console.log('');
  console.log(`  ✅ Successfully updated ${updated} package display names`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} packages kept fallback values (no metadata.name in YAML)`);
  }
  console.log('  🎉 Display names fixed automatically!');
};

exports.down = async (pgm) => {
  const { db } = pgm;

  // Revert to namespace.name format
  await db.query(`
    UPDATE packages 
    SET display_name = namespace || '.' || name
    WHERE display_name IS NOT NULL
  `);
};


/**
 * Add display_name column to packages table
 * This stores the metadata.name field from the YAML (the human-readable display name)
 *
 * Note: The actual backfill is done in a separate migration (20251228172257152)
 * to avoid issues with column not existing yet in the same transaction.
 */
exports.up = (pgm) => {
  // Add display_name column
  pgm.addColumn('packages', {
    display_name: {
      type: 'text',
      notNull: false,
    },
  });

  // Set temporary fallback (namespace.name) for existing packages
  // The next migration will extract real values from YAML
  pgm.sql(`
    UPDATE packages p
    SET display_name = p.namespace || '.' || p.name
    WHERE display_name IS NULL;
  `);

  // Create index
  pgm.createIndex('packages', 'display_name', {
    name: 'idx_packages_display_name',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('packages', 'display_name', { name: 'idx_packages_display_name', ifExists: true });
  pgm.dropColumn('packages', 'display_name', { ifExists: true });
};


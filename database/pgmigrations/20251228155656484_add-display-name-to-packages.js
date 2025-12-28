/**
 * Add display_name column to packages table
 * This stores the metadata.name field from the YAML (the human-readable display name)
 */
exports.up = (pgm) => {
  // Add display_name column (nullable for existing packages)
  pgm.addColumn('packages', {
    display_name: {
      type: 'text',
      notNull: false,
    },
  });

  // Backfill display_name from latest version's YAML metadata
  // This migration will set display_name = namespace.name for existing packages
  // Real display names can be updated when packages are re-published
  pgm.sql(`
    UPDATE packages p
    SET display_name = p.namespace || '.' || p.name
    WHERE display_name IS NULL;
  `);

  // Create index for searching by display name
  pgm.createIndex('packages', 'display_name', {
    name: 'idx_packages_display_name',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('packages', 'display_name', { name: 'idx_packages_display_name', ifExists: true });
  pgm.dropColumn('packages', 'display_name', { ifExists: true });
};


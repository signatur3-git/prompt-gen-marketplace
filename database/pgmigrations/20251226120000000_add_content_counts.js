/**
 * Add content_counts field to package_versions table
 *
 * This stores precomputed entity counts (local only, not including dependencies)
 * for performance in package list endpoints.
 *
 * Note: Population of existing data is handled by scripts/populate-content-counts.cjs
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add content_counts column with default
  pgm.addColumn('package_versions', {
    content_counts: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{\"rulebooks\":0,\"rules\":0,\"prompt_sections\":0,\"datatypes\":0}'::jsonb")
    }
  });

  // Add comment explaining the field
  pgm.sql(`
    COMMENT ON COLUMN package_versions.content_counts IS 
    'Local entity counts (not including dependencies). Precomputed at publish time for performance.';
  `);

  // Note: Data population is handled by scripts/populate-content-counts.cjs
  // which is run as part of the deployment process
};

exports.down = (pgm) => {
  pgm.dropColumn('package_versions', 'content_counts');
};


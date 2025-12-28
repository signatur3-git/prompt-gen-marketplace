/**
 * CONSOLIDATED SCHEMA MIGRATION
 *
 * This migration consolidates all previous migrations into a single clean schema.
 * It replaces 7 historical migrations that accumulated fixes and changes.
 *
 * This migration:
 * - Creates the complete current schema for fresh installs
 * - Safely skips for existing databases (tables already exist)
 * - Includes display_name backfill for existing packages
 *
 * HISTORICAL MIGRATIONS REPLACED:
 * - 20251223011500000_initial_schema
 * - 20251223011700000_increase_namespace_length_limit
 * - 20251223012100000_add_admin_role
 * - 20251223084000000_add_oauth_clients_table
 * - 20251226120000000_add_content_counts
 * - 20251228155656484_add-display-name-to-packages
 * - 20251228172257152_fix-display-names-from-yaml
 */

const yaml = require('js-yaml');

exports.up = async (pgm) => {
  const { db } = pgm;

  console.log('  📦 Running consolidated schema migration...');

  // Check if this is a fresh install or existing database
  const tablesExist = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'packages', 'package_versions')
  `);

  if (tablesExist.rows.length > 0) {
    console.log('  ✅ Tables already exist - skipping schema creation');
    console.log('  🔧 Running data fixes only...');

    // For existing databases, just run the display_name backfill
    await backfillDisplayNames(db);
    return;
  }

  console.log('  🆕 Fresh install detected - creating complete schema...');

  // Create all tables with current structure

  // Users table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    public_key: { type: 'text', notNull: true, unique: true },
    email: { type: 'text', unique: true },
    is_admin: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_key_rotation_at: { type: 'timestamptz' },
  });
  pgm.createIndex('users', 'public_key', { name: 'idx_users_public_key' });
  pgm.createIndex('users', 'email', { name: 'idx_users_email' });

  // User keypairs table
  pgm.createTable('user_keypairs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    public_key: { type: 'text', notNull: true, unique: true },
    status: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    revoked_at: { type: 'timestamptz' },
  });
  pgm.addConstraint('user_keypairs', 'user_keypairs_status_check', {
    check: "status IN ('active', 'revoked')",
  });
  pgm.createIndex('user_keypairs', 'user_id', { name: 'idx_user_keypairs_user_id' });
  pgm.createIndex('user_keypairs', 'public_key', { name: 'idx_user_keypairs_public_key' });
  pgm.createIndex('user_keypairs', 'status', { name: 'idx_user_keypairs_status' });

  // Personas table
  pgm.createTable('personas', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    is_primary: { type: 'boolean', notNull: true, default: false },
    avatar_url: { type: 'text' },
    bio: { type: 'text' },
    website: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('personas', 'personas_user_id_name_unique', { unique: ['user_id', 'name'] });
  pgm.createIndex('personas', 'user_id', { name: 'idx_personas_user_id' });
  pgm.createIndex('personas', 'is_primary', {
    name: 'idx_personas_is_primary',
    where: 'is_primary = true',
  });

  // Namespaces table
  pgm.createTable('namespaces', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true, unique: true },
    owner_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'RESTRICT' },
    protection_level: { type: 'text', notNull: true, default: 'protected' },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('namespaces', 'namespaces_protection_level_check', {
    check: "protection_level IN ('public', 'protected', 'private')",
  });
  pgm.createIndex('namespaces', 'name', { name: 'idx_namespaces_name' });
  pgm.createIndex('namespaces', 'owner_id', { name: 'idx_namespaces_owner_id' });
  pgm.createIndex('namespaces', 'protection_level', { name: 'idx_namespaces_protection_level' });

  // Packages table (with display_name from the start)
  pgm.createTable('packages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    namespace: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    display_name: { type: 'text' },
    description: { type: 'text' },
    author_persona_id: { type: 'uuid', notNull: true, references: 'personas(id)', onDelete: 'RESTRICT' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('packages', 'packages_namespace_name_unique', { unique: ['namespace', 'name'] });
  pgm.createIndex('packages', 'namespace', { name: 'idx_packages_namespace' });
  pgm.createIndex('packages', 'name', { name: 'idx_packages_name' });
  pgm.createIndex('packages', 'display_name', { name: 'idx_packages_display_name' });
  pgm.createIndex('packages', 'author_persona_id', { name: 'idx_packages_author_persona_id' });
  pgm.createIndex('packages', [{ name: 'created_at', sort: 'DESC' }], { name: 'idx_packages_created_at' });

  // Package versions table (with content_counts from the start)
  pgm.createTable('package_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_id: { type: 'uuid', notNull: true, references: 'packages(id)', onDelete: 'CASCADE' },
    version: { type: 'text', notNull: true },
    description: { type: 'text' },
    yaml_content: { type: 'text', notNull: true },
    locked_manifest: { type: 'jsonb', notNull: true },
    content_counts: {
      type: 'jsonb',
      notNull: true,
      default: '{"rulebooks":0,"rules":0,"prompt_sections":0,"datatypes":0}'
    },
    signature: { type: 'text', notNull: true },
    file_size_bytes: { type: 'integer', notNull: true },
    checksum_sha256: { type: 'text', notNull: true },
    storage_path: { type: 'text', notNull: true },
    published_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    yanked_at: { type: 'timestamptz' },
    yank_reason: { type: 'text' },
  });
  pgm.sql(`
    COMMENT ON COLUMN package_versions.content_counts IS 
    'Local entity counts (not including dependencies). Precomputed at publish time for performance.';
  `);
  pgm.addConstraint('package_versions', 'package_versions_package_id_version_unique', {
    unique: ['package_id', 'version'],
  });
  pgm.createIndex('package_versions', 'package_id', { name: 'idx_package_versions_package_id' });
  pgm.createIndex('package_versions', 'version', { name: 'idx_package_versions_version' });
  pgm.createIndex('package_versions', [{ name: 'published_at', sort: 'DESC' }], {
    name: 'idx_package_versions_published_at'
  });
  pgm.createIndex('package_versions', 'yanked_at', {
    name: 'idx_package_versions_yanked_at',
    where: 'yanked_at IS NOT NULL',
  });

  // Package dependencies table
  pgm.createTable('package_dependencies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_version_id: { type: 'uuid', notNull: true, references: 'package_versions(id)', onDelete: 'CASCADE' },
    depends_on_namespace: { type: 'text', notNull: true },
    depends_on_name: { type: 'text', notNull: true },
    version_constraint: { type: 'text', notNull: true },
    resolved_version: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('package_dependencies', 'package_version_id', {
    name: 'idx_package_dependencies_package_version_id',
  });
  pgm.createIndex('package_dependencies', ['depends_on_namespace', 'depends_on_name'], {
    name: 'idx_package_dependencies_depends_on',
  });

  // Package tags table
  pgm.createTable('package_tags', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_id: { type: 'uuid', notNull: true, references: 'packages(id)', onDelete: 'CASCADE' },
    tag: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('package_tags', 'package_tags_package_id_tag_unique', {
    unique: ['package_id', 'tag']
  });
  pgm.createIndex('package_tags', 'package_id', { name: 'idx_package_tags_package_id' });
  pgm.createIndex('package_tags', 'tag', { name: 'idx_package_tags_tag' });

  // Download stats table
  pgm.createTable('download_stats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_version_id: { type: 'uuid', notNull: true, references: 'package_versions(id)', onDelete: 'CASCADE' },
    downloaded_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    ip_hash: { type: 'text', notNull: true },
    user_agent: { type: 'text' },
  });
  pgm.createIndex('download_stats', 'package_version_id', {
    name: 'idx_download_stats_package_version_id',
  });
  pgm.createIndex('download_stats', [{ name: 'downloaded_at', sort: 'DESC' }], {
    name: 'idx_download_stats_downloaded_at',
  });

  // OAuth clients table
  pgm.createTable('oauth_clients', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    client_id: { type: 'text', notNull: true, unique: true },
    client_name: { type: 'text', notNull: true },
    redirect_uris: { type: 'text[]', notNull: true },
    allowed_origins: { type: 'text[]', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('oauth_clients', 'client_id', { name: 'idx_oauth_clients_client_id' });

  // OAuth authorization codes table
  pgm.createTable('oauth_authorization_codes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    code: { type: 'text', notNull: true, unique: true },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    client_id: { type: 'text', notNull: true, references: 'oauth_clients(client_id)', onDelete: 'CASCADE' },
    redirect_uri: { type: 'text', notNull: true },
    code_challenge: { type: 'text', notNull: true },
    code_challenge_method: { type: 'text', notNull: true },
    scope: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
  });
  pgm.createIndex('oauth_authorization_codes', 'code', { name: 'idx_oauth_codes_code' });
  pgm.createIndex('oauth_authorization_codes', 'user_id', { name: 'idx_oauth_codes_user_id' });
  pgm.createIndex('oauth_authorization_codes', 'expires_at', { name: 'idx_oauth_codes_expires_at' });

  // OAuth access tokens table
  pgm.createTable('oauth_access_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    token_hash: { type: 'text', notNull: true, unique: true },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    client_id: { type: 'text', notNull: true, references: 'oauth_clients(client_id)', onDelete: 'CASCADE' },
    scope: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
  });
  pgm.createIndex('oauth_access_tokens', 'token_hash', { name: 'idx_oauth_tokens_token_hash' });
  pgm.createIndex('oauth_access_tokens', 'user_id', { name: 'idx_oauth_tokens_user_id' });
  pgm.createIndex('oauth_access_tokens', 'expires_at', { name: 'idx_oauth_tokens_expires_at' });

  // Auth challenges table
  pgm.createTable('auth_challenges', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    public_key: { type: 'text', notNull: true },
    challenge: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
  });
  pgm.createIndex('auth_challenges', 'challenge', { name: 'idx_auth_challenges_challenge' });
  pgm.createIndex('auth_challenges', 'public_key', { name: 'idx_auth_challenges_public_key' });
  pgm.createIndex('auth_challenges', 'expires_at', { name: 'idx_auth_challenges_expires_at' });

  // Create updated_at trigger function
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Add triggers for updated_at
  pgm.sql(`
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    CREATE TRIGGER update_namespaces_updated_at BEFORE UPDATE ON namespaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  console.log('  ✅ Complete schema created successfully!');
};

async function backfillDisplayNames(db) {
  // Backfill display names for existing packages
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
    AND (p.display_name IS NULL OR p.display_name = p.namespace || '.' || p.name)
  `);

  if (result.rows.length === 0) {
    console.log('     ✅ All display names already correct');
    return;
  }

  console.log(`     📦 Backfilling ${result.rows.length} display names...`);

  let updated = 0;
  for (const row of result.rows) {
    try {
      const parsed = yaml.load(row.yaml_content);
      const metadataName = parsed?.metadata?.name;

      if (metadataName && metadataName !== row.display_name) {
        await db.query(
          'UPDATE packages SET display_name = $1, updated_at = NOW() WHERE id = $2',
          [metadataName, row.id]
        );
        updated++;
      }
    } catch (err) {
      // Keep fallback value if YAML parsing fails
    }
  }

  console.log(`     ✅ Backfilled ${updated} display names`);
}

exports.down = (pgm) => {
  // Drop all tables in reverse dependency order
  pgm.dropTable('auth_challenges', { ifExists: true, cascade: true });
  pgm.dropTable('oauth_access_tokens', { ifExists: true, cascade: true });
  pgm.dropTable('oauth_authorization_codes', { ifExists: true, cascade: true });
  pgm.dropTable('oauth_clients', { ifExists: true, cascade: true });
  pgm.dropTable('download_stats', { ifExists: true, cascade: true });
  pgm.dropTable('package_tags', { ifExists: true, cascade: true });
  pgm.dropTable('package_dependencies', { ifExists: true, cascade: true });
  pgm.dropTable('package_versions', { ifExists: true, cascade: true });
  pgm.dropTable('packages', { ifExists: true, cascade: true });
  pgm.dropTable('namespaces', { ifExists: true, cascade: true });
  pgm.dropTable('personas', { ifExists: true, cascade: true });
  pgm.dropTable('user_keypairs', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });

  // Drop trigger function
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;');
};


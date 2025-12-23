/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Baseline schema migration.
 *
 * This migration is intentionally SQL-driven to mirror the existing database/schema.sql.
 * It is not meant to be edited after it has shipped.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  // Required for gen_random_uuid()
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Users
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

  // User keypairs
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

  // Personas
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

  // Namespaces
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

  // Packages
  pgm.createTable('packages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    namespace: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    author_persona_id: {
      type: 'uuid',
      notNull: true,
      references: 'personas(id)',
      onDelete: 'RESTRICT',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('packages', 'packages_namespace_name_unique', { unique: ['namespace', 'name'] });
  pgm.createIndex('packages', 'namespace', { name: 'idx_packages_namespace' });
  pgm.createIndex('packages', 'name', { name: 'idx_packages_name' });
  pgm.createIndex('packages', 'author_persona_id', { name: 'idx_packages_author_persona_id' });
  pgm.createIndex('packages', [{ name: 'created_at', sort: 'DESC' }], {
    name: 'idx_packages_created_at',
  });

  // Package versions
  pgm.createTable('package_versions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_id: { type: 'uuid', notNull: true, references: 'packages(id)', onDelete: 'CASCADE' },
    version: { type: 'text', notNull: true },
    description: { type: 'text' },
    yaml_content: { type: 'text', notNull: true },
    locked_manifest: { type: 'jsonb', notNull: true },
    signature: { type: 'text', notNull: true },
    file_size_bytes: { type: 'integer', notNull: true },
    checksum_sha256: { type: 'text', notNull: true },
    storage_path: { type: 'text', notNull: true },
    published_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    yanked_at: { type: 'timestamptz' },
    yank_reason: { type: 'text' },
  });
  pgm.addConstraint('package_versions', 'package_versions_package_id_version_unique', {
    unique: ['package_id', 'version'],
  });
  pgm.createIndex('package_versions', 'package_id', { name: 'idx_package_versions_package_id' });
  pgm.createIndex('package_versions', 'version', { name: 'idx_package_versions_version' });
  pgm.createIndex('package_versions', [{ name: 'published_at', sort: 'DESC' }], {
    name: 'idx_package_versions_published_at',
  });
  pgm.createIndex('package_versions', 'yanked_at', {
    name: 'idx_package_versions_yanked_at',
    where: 'yanked_at IS NOT NULL',
  });

  // Package dependencies
  pgm.createTable('package_dependencies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_version_id: {
      type: 'uuid',
      notNull: true,
      references: 'package_versions(id)',
      onDelete: 'CASCADE',
    },
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

  // Package tags
  pgm.createTable('package_tags', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_id: { type: 'uuid', notNull: true, references: 'packages(id)', onDelete: 'CASCADE' },
    tag: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.addConstraint('package_tags', 'package_tags_package_id_tag_unique', { unique: ['package_id', 'tag'] });
  pgm.createIndex('package_tags', 'package_id', { name: 'idx_package_tags_package_id' });
  pgm.createIndex('package_tags', 'tag', { name: 'idx_package_tags_tag' });

  // Download stats
  pgm.createTable('download_stats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_version_id: {
      type: 'uuid',
      notNull: true,
      references: 'package_versions(id)',
      onDelete: 'CASCADE',
    },
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

  // OAuth clients
  pgm.createTable('oauth_clients', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    client_id: { type: 'text', notNull: true, unique: true },
    client_name: { type: 'text', notNull: true },
    redirect_uris: { type: 'text[]', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('oauth_clients', 'client_id', { name: 'idx_oauth_clients_client_id' });

  // OAuth authorization codes
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
  pgm.createIndex('oauth_authorization_codes', 'expires_at', {
    name: 'idx_oauth_codes_expires_at',
  });

  // OAuth access tokens
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
  pgm.createIndex('oauth_access_tokens', 'expires_at', {
    name: 'idx_oauth_tokens_expires_at',
  });

  // Auth challenges
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

  // updated_at trigger function + triggers
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  pgm.sql(
    "CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();"
  );
  pgm.sql(
    "CREATE TRIGGER update_namespaces_updated_at BEFORE UPDATE ON namespaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();"
  );
  pgm.sql(
    "CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();"
  );

  // Initial data
  pgm.sql(`
    INSERT INTO users (id, public_key, email) VALUES
      ('00000000-0000-0000-0000-000000000001', 'system_public_key_placeholder', 'system@prompt-gen.dev');

    INSERT INTO personas (id, user_id, name, is_primary) VALUES
      ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'System', true);
  `);
};

exports.down = (pgm) => {
  // Drop in reverse dependency order
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

  pgm.dropFunction('update_updated_at_column', [], { ifExists: true });

  // Extension is optional; don't force-drop in shared DBs.
};


/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Adds oauth_clients table.
 *
 * Note: This is a forward-only patch migration.
 * We intentionally keep the baseline migration stable after it has shipped.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    'oauth_clients',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      client_id: { type: 'text', notNull: true, unique: true },
      client_name: { type: 'text', notNull: true },
      redirect_uris: { type: 'text[]', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    },
    { ifNotExists: true }
  );

  // createIndex doesn't have ifNotExists in all versions; use raw SQL.
  pgm.sql(
    "CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients (client_id)"
  );
};

exports.down = (pgm) => {
  pgm.dropTable('oauth_clients', { ifExists: true, cascade: true });
};


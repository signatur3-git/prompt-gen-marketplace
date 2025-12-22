-- Initial schema for Prompt Gen Marketplace
-- Phase 1: MVP - Basic package publishing and downloading

-- Users (keypair-based authentication, no passwords)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_key_rotation_at TIMESTAMPTZ
);

CREATE INDEX idx_users_public_key ON users(public_key);
CREATE INDEX idx_users_email ON users(email);

-- User keypairs (for rotation support)
CREATE TABLE user_keypairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_user_keypairs_user_id ON user_keypairs(user_id);
CREATE INDEX idx_user_keypairs_public_key ON user_keypairs(public_key);
CREATE INDEX idx_user_keypairs_status ON user_keypairs(status);

-- Personas (multiple identities per user)
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_personas_user_id ON personas(user_id);
CREATE INDEX idx_personas_is_primary ON personas(is_primary) WHERE is_primary = true;

-- Namespaces (with protection levels)
-- Namespace names can be 2-256 characters long
-- Valid format: lowercase letters, numbers, hyphens, dots
-- Examples: "common", "p.signatur3.midjourney.v8.sref.mining"
CREATE TABLE namespaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  protection_level TEXT NOT NULL DEFAULT 'protected' CHECK (protection_level IN ('public', 'protected', 'private')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_namespaces_name ON namespaces(name);
CREATE INDEX idx_namespaces_owner_id ON namespaces(owner_id);
CREATE INDEX idx_namespaces_protection_level ON namespaces(protection_level);

-- Packages
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  author_persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace, name)
);

CREATE INDEX idx_packages_namespace ON packages(namespace);
CREATE INDEX idx_packages_name ON packages(name);
CREATE INDEX idx_packages_author_persona_id ON packages(author_persona_id);
CREATE INDEX idx_packages_created_at ON packages(created_at DESC);

-- Package versions
CREATE TABLE package_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  description TEXT,
  yaml_content TEXT NOT NULL,
  locked_manifest JSONB NOT NULL,
  signature TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  yanked_at TIMESTAMPTZ,
  yank_reason TEXT,
  UNIQUE(package_id, version)
);

CREATE INDEX idx_package_versions_package_id ON package_versions(package_id);
CREATE INDEX idx_package_versions_version ON package_versions(version);
CREATE INDEX idx_package_versions_published_at ON package_versions(published_at DESC);
CREATE INDEX idx_package_versions_yanked_at ON package_versions(yanked_at) WHERE yanked_at IS NOT NULL;

-- Package dependencies (extracted from locked manifests)
CREATE TABLE package_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
  depends_on_namespace TEXT NOT NULL,
  depends_on_name TEXT NOT NULL,
  version_constraint TEXT NOT NULL,
  resolved_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_package_dependencies_package_version_id ON package_dependencies(package_version_id);
CREATE INDEX idx_package_dependencies_depends_on ON package_dependencies(depends_on_namespace, depends_on_name);

-- Package tags (for search/discovery)
CREATE TABLE package_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(package_id, tag)
);

CREATE INDEX idx_package_tags_package_id ON package_tags(package_id);
CREATE INDEX idx_package_tags_tag ON package_tags(tag);

-- Download statistics
CREATE TABLE download_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_version_id UUID NOT NULL REFERENCES package_versions(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX idx_download_stats_package_version_id ON download_stats(package_version_id);
CREATE INDEX idx_download_stats_downloaded_at ON download_stats(downloaded_at DESC);

-- OAuth authorization codes (temporary, for PKCE flow)
CREATE TABLE oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_user_id ON oauth_authorization_codes(user_id);
CREATE INDEX idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);

-- OAuth access tokens
CREATE TABLE oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_tokens_token_hash ON oauth_access_tokens(token_hash);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_access_tokens(user_id);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_access_tokens(expires_at);

-- Challenge-response authentication (temporary storage in Redis preferred, but fallback to DB)
CREATE TABLE auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key TEXT NOT NULL,
  challenge TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_auth_challenges_challenge ON auth_challenges(challenge);
CREATE INDEX idx_auth_challenges_public_key ON auth_challenges(public_key);
CREATE INDEX idx_auth_challenges_expires_at ON auth_challenges(expires_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_namespaces_updated_at BEFORE UPDATE ON namespaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data
INSERT INTO users (id, public_key, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system_public_key_placeholder', 'system@prompt-gen.dev');

INSERT INTO personas (id, user_id, name, is_primary) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'System', true);


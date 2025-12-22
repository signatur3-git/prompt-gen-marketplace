-- Add admin role support to users table
-- Migration: 2025-12-22-add-admin-role

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Create an index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;

-- Comment: To make a user an admin, run:
-- UPDATE users SET is_admin = true WHERE id = 'user-uuid-here';


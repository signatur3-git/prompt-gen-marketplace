-- Migration: Increase namespace length limit from 64 to 256 characters
-- Date: 2025-12-22
-- Reason: Support realistic long namespaces like "p.signatur3.midjourney.v8.sref.mining"

-- Note: The database already uses TEXT type for namespaces, which has no length limit.
-- This migration is for documentation purposes to record the business logic change.
-- The actual validation constraint is in src/services/namespace.service.ts

-- No actual database changes needed, but we document the new business rule here:
-- Old limit: 2-64 characters
-- New limit: 2-256 characters

-- This allows for realistic nested namespace patterns such as:
-- - p.signatur3.midjourney.v8.sref.mining
-- - p.signatur3.midjourney.v8.sref.favorites
-- - p.signatur3.midjourney.v8.showcase
-- - user.org.project.category.subcategory.specific-package

-- If we ever need to add a CHECK constraint to the database (currently not needed):
-- ALTER TABLE namespaces ADD CONSTRAINT check_namespace_length
--   CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 256);

-- For now, validation is handled in application layer (namespace.service.ts)
-- This provides flexibility and keeps the database simple.

SELECT 'Namespace length limit increased to 256 characters (application layer)' AS migration_note;


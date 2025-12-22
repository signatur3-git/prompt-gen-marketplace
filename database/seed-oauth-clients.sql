-- Seed OAuth client for prompt-gen-web
-- Run this after initializing the database

INSERT INTO oauth_clients (id, client_id, client_name, redirect_uris, created_at)
VALUES (
  gen_random_uuid(),
  'prompt-gen-web',
  'Prompt Gen Web App',
  ARRAY[
    'http://localhost:5173/oauth/callback',
    'https://signatur3-git.github.io/prompt-gen-web/oauth/callback'
  ],
  NOW()
)
ON CONFLICT (client_id) DO NOTHING;


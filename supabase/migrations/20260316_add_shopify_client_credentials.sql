-- Migration: Add per-client Shopify app credentials to agency_clients
-- This allows each client to have their own Shopify custom app credentials

ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS shopify_client_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_client_secret TEXT;

COMMENT ON COLUMN agency_clients.shopify_client_id IS 'Shopify custom app Client ID (API Key) for this client';
COMMENT ON COLUMN agency_clients.shopify_client_secret IS 'Shopify custom app Client Secret for this client';

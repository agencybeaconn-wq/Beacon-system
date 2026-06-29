-- Migration: Add CartPanda fields to agency_clients table
-- Run this in Supabase SQL Editor

-- Add CartPanda-related columns to agency_clients
ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS cartpanda_store_slug TEXT,
ADD COLUMN IF NOT EXISTS cartpanda_bearer_token TEXT,
ADD COLUMN IF NOT EXISTS cartpanda_status TEXT DEFAULT 'disconnected' CHECK (cartpanda_status IN ('disconnected', 'pending', 'connected', 'error')),
ADD COLUMN IF NOT EXISTS cartpanda_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cartpanda_store_name TEXT;

-- Add index for faster lookups by cartpanda_store_slug
CREATE INDEX IF NOT EXISTS idx_agency_clients_cartpanda_store_slug
ON agency_clients(cartpanda_store_slug) WHERE cartpanda_store_slug IS NOT NULL;

-- Comment the columns for documentation
COMMENT ON COLUMN agency_clients.cartpanda_store_slug IS 'The CartPanda store slug (e.g., example-store)';
COMMENT ON COLUMN agency_clients.cartpanda_bearer_token IS 'Bearer token for CartPanda API authentication';
COMMENT ON COLUMN agency_clients.cartpanda_status IS 'Connection status: disconnected, pending, connected, error';
COMMENT ON COLUMN agency_clients.cartpanda_connected_at IS 'Timestamp when CartPanda was successfully connected';
COMMENT ON COLUMN agency_clients.cartpanda_store_name IS 'Friendly name of the CartPanda shop';

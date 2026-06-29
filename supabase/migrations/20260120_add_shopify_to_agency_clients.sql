-- Migration: Add Shopify fields to agency_clients table
-- Run this in Supabase SQL Editor

-- Add Shopify-related columns to agency_clients
ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS shopify_domain TEXT,
ADD COLUMN IF NOT EXISTS shopify_access_token TEXT,
ADD COLUMN IF NOT EXISTS shopify_status TEXT DEFAULT 'disconnected' CHECK (shopify_status IN ('disconnected', 'pending', 'connected', 'error')),
ADD COLUMN IF NOT EXISTS shopify_connected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shopify_shop_name TEXT;

-- Add index for faster lookups by shopify_domain
CREATE INDEX IF NOT EXISTS idx_agency_clients_shopify_domain
ON agency_clients(shopify_domain) WHERE shopify_domain IS NOT NULL;

-- Comment the columns for documentation
COMMENT ON COLUMN agency_clients.shopify_domain IS 'The Shopify store domain (e.g., store.myshopify.com)';
COMMENT ON COLUMN agency_clients.shopify_access_token IS 'OAuth access token for Shopify API (encrypted at rest)';
COMMENT ON COLUMN agency_clients.shopify_status IS 'Connection status: disconnected, pending, connected, error';
COMMENT ON COLUMN agency_clients.shopify_connected_at IS 'Timestamp when Shopify was successfully connected';
COMMENT ON COLUMN agency_clients.shopify_shop_name IS 'Friendly name of the Shopify shop';

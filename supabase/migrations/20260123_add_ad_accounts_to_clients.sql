-- Add selected_ad_accounts column to agency_clients
-- This stores an array of Meta ad account IDs selected for this client
ALTER TABLE public.agency_clients
ADD COLUMN IF NOT EXISTS selected_ad_accounts TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.agency_clients.selected_ad_accounts IS 'Array of Meta Ad Account IDs (e.g., act_123456789) selected for this client';

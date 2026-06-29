-- Add portal_email column to agency_clients for direct email storage
ALTER TABLE agency_clients ADD COLUMN IF NOT EXISTS portal_email TEXT;

-- Comment for clarity
COMMENT ON COLUMN agency_clients.portal_email IS 'Email of the client portal user (for quick display)';

-- Migration: Add profit configuration fields to agency_clients table
-- These fields allow users to configure gateway fees, taxes, and fixed costs for accurate profit calculation.

ALTER TABLE agency_clients
ADD COLUMN IF NOT EXISTS profit_gateway_percent FLOAT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_tax_percent FLOAT8 DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_fixed_costs FLOAT8 DEFAULT 0;

-- Comment the columns for documentation
COMMENT ON COLUMN agency_clients.profit_gateway_percent IS 'Percentage of revenue taken by payment gateways (e.g., 5.0 for 5%)';
COMMENT ON COLUMN agency_clients.profit_tax_percent IS 'Percentage of revenue taken by taxes (e.g., 6.0 for 6%)';
COMMENT ON COLUMN agency_clients.profit_fixed_costs IS 'Fixed costs to be deducted from profit (e.g., R$ 500.00)';

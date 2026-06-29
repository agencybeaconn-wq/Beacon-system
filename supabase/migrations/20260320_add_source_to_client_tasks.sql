-- Add source field to track where tasks were generated from
ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'product';
-- Values: 'product' (from agency_products), 'briefing' (from briefing answers), 'manual' (created manually)

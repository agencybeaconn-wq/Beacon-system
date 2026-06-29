-- Migration: Add pricing configuration table for clients
CREATE TABLE IF NOT EXISTS client_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  section TEXT NOT NULL, -- 'products', 'extras', 'info'
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT, -- price as text, or boolean/text for info fields
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, section, key)
);

CREATE INDEX IF NOT EXISTS idx_client_pricing_client ON client_pricing(client_id);

ALTER TABLE client_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view client pricing" ON client_pricing
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage pricing" ON client_pricing
  FOR ALL USING (true) WITH CHECK (true);

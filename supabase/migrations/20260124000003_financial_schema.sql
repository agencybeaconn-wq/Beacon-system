-- Financial Infrastructure Tables

-- 1. Integrations Configuration (Shopify, Nuvemshop, Meta, Google)
CREATE TABLE IF NOT EXISTS integrations_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  provider TEXT NOT NULL CHECK (provider IN ('shopify', 'nuvemshop', 'meta_ads', 'google_ads')),
  credentials JSONB NOT NULL, -- Encrypted API keys/tokens should be stored here
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE
);

-- 2. Financial Transactions (Normalized Orders/Income)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  type TEXT NOT NULL CHECK (type IN ('income', 'refund', 'chargeback')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  source TEXT NOT NULL, -- 'shopify', 'nuvemshop', 'manual'
  external_id TEXT, -- ID in the external system
  metadata JSONB, -- Store extra details like customer info, items
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE
);

-- 3. Marketing Spend (Daily Aggregation)
CREATE TABLE IF NOT EXISTS marketing_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta_ads', 'google_ads', 'tiktok_ads', 'other')),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  campaign_name TEXT,
  campaign_id TEXT,
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(date, platform, campaign_id, workspace_id)
);

-- 4. Fixed Costs (Recurring expenses)
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'yearly', 'one_time')),
  payment_day INTEGER, -- e.g., 5 for 5th of every month
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE
);

-- 5. Variable Costs (Per-order or ad-hoc)
CREATE TABLE IF NOT EXISTS variable_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  category TEXT, -- 'logistics', 'packaging', 'taxes'
  related_transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE
);

-- 6. Product Costs (COGS)
CREATE TABLE IF NOT EXISTS product_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  product_sku TEXT NOT NULL,
  cost_per_unit NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'BRL',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ, -- For historical cost tracking
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE integrations_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;

-- Simple Policies (adjust as per actual auth requirements)
-- Assuming authenticated users with access to the workspace can view/manage
DO $$
BEGIN
    -- Policy for integrations_config
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'integrations_config' AND policyname = 'Users can view integrations for their workspace'
    ) THEN
        CREATE POLICY "Users can view integrations for their workspace" ON integrations_config
            FOR SELECT USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = integrations_config.workspace_id));
        
        CREATE POLICY "Users can manage integrations for their workspace" ON integrations_config
            FOR ALL USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = integrations_config.workspace_id));
    END IF;

    -- Policy for financial_transactions
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'financial_transactions' AND policyname = 'Users can view transactions for their workspace'
    ) THEN
        CREATE POLICY "Users can view transactions for their workspace" ON financial_transactions
            FOR SELECT USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = financial_transactions.workspace_id));
            
        CREATE POLICY "Users can manage transactions for their workspace" ON financial_transactions
            FOR ALL USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = financial_transactions.workspace_id));
    END IF;

    -- Repeat for other tables... (Simplifying for brevity, but best practice is to be explicit)
    -- For marketing_spend
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'marketing_spend' AND policyname = 'Access marketing_spend'
    ) THEN
        CREATE POLICY "Access marketing_spend" ON marketing_spend
            FOR ALL USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = marketing_spend.workspace_id));
    END IF;

    -- For fixed_costs
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'fixed_costs' AND policyname = 'Access fixed_costs'
    ) THEN
        CREATE POLICY "Access fixed_costs" ON fixed_costs
            FOR ALL USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = fixed_costs.workspace_id));
    END IF;

    -- For variable_costs
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'variable_costs' AND policyname = 'Access variable_costs'
    ) THEN
        CREATE POLICY "Access variable_costs" ON variable_costs
            FOR ALL USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = variable_costs.workspace_id));
    END IF;

    -- For product_costs
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'product_costs' AND policyname = 'Access product_costs'
    ) THEN
        CREATE POLICY "Access product_costs" ON product_costs
            FOR ALL USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = product_costs.workspace_id));
    END IF;

END $$;

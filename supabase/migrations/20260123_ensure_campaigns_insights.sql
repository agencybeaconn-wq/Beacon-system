-- Migration to ensure campaigns and insights tables exist
-- Fixes PGRST205 error "Could not find the table 'public.campaigns' in the schema cache"

-- 1. Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT,
    objective TEXT,
    status TEXT,
    daily_budget NUMERIC(14,2),
    lifetime_budget NUMERIC(14,2),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create insights table
CREATE TABLE IF NOT EXISTS public.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'CAMPAIGN',
    date DATE NOT NULL,
    spend NUMERIC(14,2) DEFAULT 0,
    revenue NUMERIC(14,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    roas NUMERIC(10,4) DEFAULT 0,
    cpa NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT insights_entity_date_unique UNIQUE (entity_id, entity_type, date)
);

-- 3. Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for campaigns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Service role can manage all campaigns') THEN
        CREATE POLICY "Service role can manage all campaigns" ON public.campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Users can view campaigns') THEN
        CREATE POLICY "Users can view campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 5. RLS Policies for insights
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Service role can manage all insights') THEN
        CREATE POLICY "Service role can manage all insights" ON public.insights FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Users can view insights') THEN
        CREATE POLICY "Users can view insights" ON public.insights FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 6. Grant permissions
GRANT ALL ON public.campaigns TO service_role;
GRANT SELECT ON public.campaigns TO authenticated;
GRANT ALL ON public.insights TO service_role;
GRANT SELECT ON public.insights TO authenticated;

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON public.campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_insights_entity_id ON public.insights(entity_id);
CREATE INDEX IF NOT EXISTS idx_insights_date ON public.insights(date);
CREATE INDEX IF NOT EXISTS idx_insights_entity_date ON public.insights(entity_id, date);

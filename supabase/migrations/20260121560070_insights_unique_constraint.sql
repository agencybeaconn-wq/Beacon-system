-- Create insights table if it doesn't exist
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

-- Enable RLS
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY "Service role can manage all insights"
ON public.insights
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy for authenticated users to view insights
CREATE POLICY "Users can view insights"
ON public.insights
FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON public.insights TO service_role;
GRANT SELECT ON public.insights TO authenticated;

-- Create campaigns table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    name TEXT,
    objective TEXT,
    status TEXT,
    daily_budget NUMERIC(14,2),
    lifetime_budget NUMERIC(14,2),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Policy for service role
CREATE POLICY "Service role can manage all campaigns"
ON public.campaigns
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy for authenticated users
CREATE POLICY "Users can view campaigns"
ON public.campaigns
FOR SELECT
TO authenticated
USING (true);

-- Grant permissions
GRANT ALL ON public.campaigns TO service_role;
GRANT SELECT ON public.campaigns TO authenticated;

-- Migration: SMART DATA V2 (KPIs & SCORING)
-- Description: Creates tables for storing granular daily metrics and cached client scores.

-- 1. Table: Daily Metrics (Historical Data)
CREATE TABLE IF NOT EXISTS public.client_daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- TRÁFEGO (Meta Ads)
    spend NUMERIC(15, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    revenue NUMERIC(15, 2) DEFAULT 0, -- Valor total de compras (Pixel)
    
    -- SITE (Shopify)
    sessions INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    add_to_cart INTEGER DEFAULT 0,
    checkouts_initiated INTEGER DEFAULT 0,
    
    -- GATEWAY (AppMax)
    approved_transactions INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0, -- Total submetido
    chargebacks INTEGER DEFAULT 0,
    pix_approved INTEGER DEFAULT 0,
    pix_total INTEGER DEFAULT 0,
    
    -- CUSTOS & MARGEM
    product_costs NUMERIC(15, 2) DEFAULT 0, -- Custo produtos vendidos
    total_tax_fees NUMERIC(15, 2) DEFAULT 0, -- Taxas gateway + impostos
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure one record per client per day
    UNIQUE(client_id, date)
);

-- 2. Table: Latest Scores (Cache for Dashboard)
CREATE TABLE IF NOT EXISTS public.client_latest_scores (
    client_id UUID PRIMARY KEY REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    
    -- Score Total (0-100)
    total_score NUMERIC(5, 2) DEFAULT 0,
    
    -- Classification
    status TEXT CHECK (status IN ('ESCALAR', 'OTIMIZAR', 'ATENÇÃO', 'CRÍTICO', 'PAUSAR', 'AVALIAR')),
    
    -- Detailed Breakdown (JSONB for flexibility)
    -- Stores: { trafego: 15, conversao: 20, ... }
    score_details JSONB DEFAULT '{}',
    
    -- Last Calculated Metrics (Snapshot for quick filtering)
    last_roas NUMERIC(10, 2),
    last_conversion_rate NUMERIC(5, 2),
    last_approval_rate NUMERIC(5, 2),
    last_revenue_30d NUMERIC(15, 2),
    
    last_calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE public.client_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_latest_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Admins/Members can view everything (for now, simplistic)
CREATE POLICY "Allow read access for authenticated users" ON public.client_daily_metrics
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow write access for authenticated users" ON public.client_daily_metrics
FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read access for authenticated users" ON public.client_latest_scores
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow write access for authenticated users" ON public.client_latest_scores
FOR ALL USING (auth.role() = 'authenticated');

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_client_daily_metrics_client_date ON public.client_daily_metrics(client_id, date);
CREATE INDEX IF NOT EXISTS idx_client_latest_scores_status ON public.client_latest_scores(status);

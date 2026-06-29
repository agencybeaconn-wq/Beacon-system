-- Migration: Store deployment automation table
CREATE TABLE IF NOT EXISTS store_deployments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL,
    source_client_id UUID NOT NULL REFERENCES agency_clients(id),
    target_client_id UUID NOT NULL REFERENCES agency_clients(id),
    briefing_id UUID,

    -- What to deploy
    steps JSONB NOT NULL DEFAULT '{"products":true,"collections":true,"pages":true,"menus":true,"theme":true}',

    -- Per-step status tracking
    step_status JSONB NOT NULL DEFAULT '{}',

    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'extracting', 'transforming', 'previewing', 'deploying', 'completed', 'failed', 'partial')),

    -- Snapshot of transformed data for preview/audit
    preview_data JSONB,

    -- AI config
    ai_config JSONB DEFAULT '{"personalizePages":true,"adaptDescriptions":false}',

    -- Brand replacement config
    source_brand_name TEXT,
    target_brand_name TEXT,

    error_log JSONB DEFAULT '[]',

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_deployments_workspace ON store_deployments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_store_deployments_target ON store_deployments(target_client_id);

ALTER TABLE store_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage store deployments" ON store_deployments
    FOR ALL USING (true) WITH CHECK (true);

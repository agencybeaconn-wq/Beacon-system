-- ============================================================================
-- Migration: Create google_connections table
-- Armazena tokens OAuth2 do Google para cada workspace.
-- Análogo à tabela fb_connections existente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_connections (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    google_email    TEXT NOT NULL,
    google_user_id  TEXT NOT NULL,
    google_name     TEXT,
    google_picture  TEXT,
    access_token    TEXT NOT NULL,
    refresh_token   TEXT,
    token_expiry    TIMESTAMPTZ NOT NULL,
    scopes          TEXT DEFAULT '',
    status          TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by workspace
CREATE INDEX IF NOT EXISTS idx_google_connections_workspace_id 
    ON public.google_connections(workspace_id);

-- Unique constraint: one Google account per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_connections_workspace_email 
    ON public.google_connections(workspace_id, google_email);

-- RLS: Enable Row Level Security
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access connections from their own workspace
CREATE POLICY "Users can view own workspace Google connections"
    ON public.google_connections
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
        OR
        workspace_id IN (
            SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Only workspace owners can insert/update/delete
CREATE POLICY "Workspace owners can manage Google connections"
    ON public.google_connections
    FOR ALL
    USING (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    );

-- Grant access to service role (used by Edge Functions)
GRANT ALL ON public.google_connections TO service_role;
GRANT SELECT ON public.google_connections TO authenticated;

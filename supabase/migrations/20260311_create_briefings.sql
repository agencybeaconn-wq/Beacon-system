-- ═══════════════════════════════════════════════════════════════
-- BRIEFING INTERNO — Schema
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.briefings (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_name     TEXT NOT NULL,
    client_group_id UUID,
    answers         JSONB NOT NULL DEFAULT '{}',
    ai_summary      TEXT,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefings_workspace ON public.briefings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_briefings_status ON public.briefings(status);

-- RLS
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_select" ON public.briefings
    FOR SELECT USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
        OR workspace_id IN (SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid())
    );

CREATE POLICY "briefings_manage" ON public.briefings
    FOR ALL USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
        OR workspace_id IN (SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid())
    ) WITH CHECK (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
        OR workspace_id IN (SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid())
    );

GRANT ALL ON public.briefings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;

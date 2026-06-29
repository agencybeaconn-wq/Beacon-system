-- ============================================================================
-- Migration: Create training_lists and training_videos tables
-- Plataforma de treinamento interno para funcionários da agência.
-- Estrutura análoga a library_lists / library_videos, mas banco separado.
-- ============================================================================

-- ─── Lists (categorias/módulos de treinamento) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_lists (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_lists_workspace
    ON public.training_lists(workspace_id);

-- ─── Videos (aulas/tutoriais) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_videos (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id         UUID NOT NULL REFERENCES public.training_lists(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    video_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    duration_seconds INT,
    sort_order      INT DEFAULT 0,
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_videos_list
    ON public.training_videos(list_id);

CREATE INDEX IF NOT EXISTS idx_training_videos_workspace
    ON public.training_videos(workspace_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.training_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer membro do workspace pode ler
CREATE POLICY "training_lists_select" ON public.training_lists
    FOR SELECT USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
        OR workspace_id IN (SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid())
    );

CREATE POLICY "training_videos_select" ON public.training_videos
    FOR SELECT USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
        OR workspace_id IN (SELECT workspace_id FROM public.team_members WHERE user_id = auth.uid())
    );

-- INSERT/UPDATE/DELETE: somente owner do workspace
CREATE POLICY "training_lists_manage" ON public.training_lists
    FOR ALL USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    ) WITH CHECK (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    );

CREATE POLICY "training_videos_manage" ON public.training_videos
    FOR ALL USING (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    ) WITH CHECK (
        workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    );

-- ─── Grants ───────────────────────────────────────────────────────────────
GRANT ALL ON public.training_lists TO service_role;
GRANT ALL ON public.training_videos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_videos TO authenticated;

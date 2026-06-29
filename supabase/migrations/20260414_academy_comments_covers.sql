-- ============================================================================
-- Migration: Lever Academy — comentários em aulas + bucket de capas
-- ============================================================================

-- ─── Comentários ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.academy_students(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES public.academy_comments(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    is_deleted      BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_comments_lesson ON public.academy_comments(lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_comments_parent ON public.academy_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_academy_comments_student ON public.academy_comments(student_id);

-- ─── Likes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_comment_likes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id      UUID NOT NULL REFERENCES public.academy_comments(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES public.academy_students(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (comment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_comment_likes_comment ON public.academy_comment_likes(comment_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.academy_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_comment_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado que veria a aula vê os comentários
DROP POLICY IF EXISTS "academy_comments_select" ON public.academy_comments;
CREATE POLICY "academy_comments_select" ON public.academy_comments
    FOR SELECT TO authenticated
    USING (
        public.is_academy_admin()
        OR EXISTS (
            SELECT 1 FROM public.academy_lessons l
            JOIN public.academy_enrollments e ON e.module_id = l.module_id
            JOIN public.academy_students s ON s.id = e.student_id
            WHERE l.id = academy_comments.lesson_id
              AND s.user_id = auth.uid()
              AND (e.expires_at IS NULL OR e.expires_at > NOW())
        )
    );

-- INSERT: aluno com enrollment ativo (OU admin)
DROP POLICY IF EXISTS "academy_comments_insert" ON public.academy_comments;
CREATE POLICY "academy_comments_insert" ON public.academy_comments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_academy_admin()
        OR (
            student_id IN (SELECT id FROM public.academy_students WHERE user_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM public.academy_lessons l
                JOIN public.academy_enrollments e ON e.module_id = l.module_id
                WHERE l.id = academy_comments.lesson_id
                  AND e.student_id = academy_comments.student_id
                  AND (e.expires_at IS NULL OR e.expires_at > NOW())
            )
        )
    );

-- UPDATE: próprio autor ou admin
DROP POLICY IF EXISTS "academy_comments_update" ON public.academy_comments;
CREATE POLICY "academy_comments_update" ON public.academy_comments
    FOR UPDATE TO authenticated
    USING (
        public.is_academy_admin()
        OR student_id IN (SELECT id FROM public.academy_students WHERE user_id = auth.uid())
    );

-- DELETE: só admin (autor usa soft-delete via is_deleted)
DROP POLICY IF EXISTS "academy_comments_delete_admin" ON public.academy_comments;
CREATE POLICY "academy_comments_delete_admin" ON public.academy_comments
    FOR DELETE TO authenticated
    USING (public.is_academy_admin());

-- Likes: leitura livre pra autenticados; insert/delete próprio
DROP POLICY IF EXISTS "academy_comment_likes_select" ON public.academy_comment_likes;
CREATE POLICY "academy_comment_likes_select" ON public.academy_comment_likes
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "academy_comment_likes_insert" ON public.academy_comment_likes;
CREATE POLICY "academy_comment_likes_insert" ON public.academy_comment_likes
    FOR INSERT TO authenticated
    WITH CHECK (
        student_id IN (SELECT id FROM public.academy_students WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "academy_comment_likes_delete" ON public.academy_comment_likes;
CREATE POLICY "academy_comment_likes_delete" ON public.academy_comment_likes
    FOR DELETE TO authenticated
    USING (
        student_id IN (SELECT id FROM public.academy_students WHERE user_id = auth.uid())
    );

GRANT ALL ON public.academy_comments, public.academy_comment_likes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_comments, public.academy_comment_likes TO authenticated;

-- ─── Bucket academy-covers (imagens de capa de módulos/aulas) ─────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-covers', 'academy-covers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "academy_covers_public_read" ON storage.objects;
CREATE POLICY "academy_covers_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'academy-covers');

DROP POLICY IF EXISTS "academy_covers_admin_insert" ON storage.objects;
CREATE POLICY "academy_covers_admin_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'academy-covers' AND public.is_academy_admin());

DROP POLICY IF EXISTS "academy_covers_admin_update" ON storage.objects;
CREATE POLICY "academy_covers_admin_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'academy-covers' AND public.is_academy_admin())
    WITH CHECK (bucket_id = 'academy-covers' AND public.is_academy_admin());

DROP POLICY IF EXISTS "academy_covers_admin_delete" ON storage.objects;
CREATE POLICY "academy_covers_admin_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'academy-covers' AND public.is_academy_admin());

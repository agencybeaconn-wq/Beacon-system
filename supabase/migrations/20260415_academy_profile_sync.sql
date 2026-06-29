-- ============================================================================
-- Migration: Academy — sync de perfil auth→student + progresso do aluno
-- ============================================================================

-- ─── 1. Trigger: sync auth.users → academy_students ──────────────────────
CREATE OR REPLACE FUNCTION public.sync_academy_student_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.academy_students
    SET
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
        phone     = COALESCE(NEW.raw_user_meta_data->>'phone', phone),
        email     = COALESCE(NEW.email, email)
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated_academy ON auth.users;
CREATE TRIGGER on_auth_user_updated_academy
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
          OR OLD.email IS DISTINCT FROM NEW.email)
    EXECUTE FUNCTION public.sync_academy_student_from_auth();

-- ─── 2. Tabela academy_lesson_progress ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_lesson_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES public.academy_students(id) ON DELETE CASCADE,
    lesson_id       UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
    watched_seconds INT DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_progress_student
    ON public.academy_lesson_progress(student_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_academy_progress_lesson
    ON public.academy_lesson_progress(lesson_id);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.academy_lesson_progress ENABLE ROW LEVEL SECURITY;

-- SELECT: próprio aluno ou admin
DROP POLICY IF EXISTS "academy_progress_select_own_or_admin" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_select_own_or_admin" ON public.academy_lesson_progress
    FOR SELECT USING (
        public.is_academy_admin()
        OR EXISTS (
            SELECT 1 FROM public.academy_students s
            WHERE s.id = academy_lesson_progress.student_id
              AND s.user_id = auth.uid()
        )
    );

-- INSERT: aluno com enrollment ativo na aula
DROP POLICY IF EXISTS "academy_progress_insert_enrolled" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_insert_enrolled" ON public.academy_lesson_progress
    FOR INSERT WITH CHECK (
        public.is_academy_admin()
        OR (
            student_id IN (SELECT id FROM public.academy_students WHERE user_id = auth.uid())
            AND EXISTS (
                SELECT 1 FROM public.academy_lessons l
                JOIN public.academy_enrollments e ON e.module_id = l.module_id
                WHERE l.id = academy_lesson_progress.lesson_id
                  AND e.student_id = academy_lesson_progress.student_id
                  AND (e.expires_at IS NULL OR e.expires_at > NOW())
            )
        )
    );

-- UPDATE: próprio aluno (continuar gravando progresso)
DROP POLICY IF EXISTS "academy_progress_update_own" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_update_own" ON public.academy_lesson_progress
    FOR UPDATE USING (
        public.is_academy_admin()
        OR student_id IN (SELECT id FROM public.academy_students WHERE user_id = auth.uid())
    );

-- DELETE: só admin (se quiser resetar progresso de algum aluno)
DROP POLICY IF EXISTS "academy_progress_delete_admin" ON public.academy_lesson_progress;
CREATE POLICY "academy_progress_delete_admin" ON public.academy_lesson_progress
    FOR DELETE USING (public.is_academy_admin());

-- ─── 4. Grants ────────────────────────────────────────────────────────────
GRANT ALL ON public.academy_lesson_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_lesson_progress TO authenticated;

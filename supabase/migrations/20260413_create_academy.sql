-- ============================================================================
-- Migration: Lever Academy — área de membros para videoaulas
-- Produto educacional independente da agência; aluno não é cliente Lever Tech.
-- ============================================================================

-- ─── 1. Tabelas ───────────────────────────────────────────────────────────

-- Alunos (cadastro próprio, desacoplado de agency_clients)
CREATE TABLE IF NOT EXISTS public.academy_students (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT,
    plan            TEXT DEFAULT 'none',
    status          TEXT DEFAULT 'active',
    is_admin        BOOLEAN DEFAULT false,
    enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_students_user ON public.academy_students(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_students_email ON public.academy_students(email);

-- Módulos (cursos)
CREATE TABLE IF NOT EXISTS public.academy_modules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    cover_url       TEXT,
    level           TEXT,
    sort_order      INT DEFAULT 0,
    is_published    BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_modules_slug ON public.academy_modules(slug);
CREATE INDEX IF NOT EXISTS idx_academy_modules_published ON public.academy_modules(is_published, sort_order);

-- Aulas
CREATE TABLE IF NOT EXISTS public.academy_lessons (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id           UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT,
    video_url           TEXT NOT NULL,
    thumbnail_url       TEXT,
    duration_seconds    INT,
    sort_order          INT DEFAULT 0,
    is_published        BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_lessons_module ON public.academy_lessons(module_id, sort_order);

-- Enrollments (quem tem acesso a qual módulo)
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES public.academy_students(id) ON DELETE CASCADE,
    module_id       UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
    granted_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    UNIQUE (student_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_student ON public.academy_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_module ON public.academy_enrollments(module_id);

-- ─── 2. Helper: is admin ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_academy_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.academy_students
        WHERE user_id = auth.uid() AND is_admin = true
    );
$$;

-- ─── 3. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.academy_students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_enrollments  ENABLE ROW LEVEL SECURITY;

-- academy_students: próprio user lê/atualiza; admin lê/gerencia todos
DROP POLICY IF EXISTS "academy_students_select_own_or_admin" ON public.academy_students;
CREATE POLICY "academy_students_select_own_or_admin" ON public.academy_students
    FOR SELECT USING (user_id = auth.uid() OR public.is_academy_admin());

DROP POLICY IF EXISTS "academy_students_insert_self" ON public.academy_students;
CREATE POLICY "academy_students_insert_self" ON public.academy_students
    FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_academy_admin());

DROP POLICY IF EXISTS "academy_students_update_own_or_admin" ON public.academy_students;
CREATE POLICY "academy_students_update_own_or_admin" ON public.academy_students
    FOR UPDATE USING (user_id = auth.uid() OR public.is_academy_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_academy_admin());

DROP POLICY IF EXISTS "academy_students_delete_admin" ON public.academy_students;
CREATE POLICY "academy_students_delete_admin" ON public.academy_students
    FOR DELETE USING (public.is_academy_admin());

-- academy_modules: todos autenticados leem published; admin lê tudo e gerencia
DROP POLICY IF EXISTS "academy_modules_select" ON public.academy_modules;
CREATE POLICY "academy_modules_select" ON public.academy_modules
    FOR SELECT TO authenticated
    USING (is_published = true OR public.is_academy_admin());

DROP POLICY IF EXISTS "academy_modules_manage_admin" ON public.academy_modules;
CREATE POLICY "academy_modules_manage_admin" ON public.academy_modules
    FOR ALL USING (public.is_academy_admin())
    WITH CHECK (public.is_academy_admin());

-- academy_lessons: aluno vê se tem enrollment ativo no módulo; admin tudo
DROP POLICY IF EXISTS "academy_lessons_select" ON public.academy_lessons;
CREATE POLICY "academy_lessons_select" ON public.academy_lessons
    FOR SELECT TO authenticated
    USING (
        public.is_academy_admin()
        OR (
            is_published = true
            AND EXISTS (
                SELECT 1 FROM public.academy_enrollments e
                JOIN public.academy_students s ON s.id = e.student_id
                WHERE s.user_id = auth.uid()
                  AND e.module_id = academy_lessons.module_id
                  AND (e.expires_at IS NULL OR e.expires_at > NOW())
            )
        )
    );

DROP POLICY IF EXISTS "academy_lessons_manage_admin" ON public.academy_lessons;
CREATE POLICY "academy_lessons_manage_admin" ON public.academy_lessons
    FOR ALL USING (public.is_academy_admin())
    WITH CHECK (public.is_academy_admin());

-- academy_enrollments: próprio aluno lê seus; admin gerencia
DROP POLICY IF EXISTS "academy_enrollments_select_own_or_admin" ON public.academy_enrollments;
CREATE POLICY "academy_enrollments_select_own_or_admin" ON public.academy_enrollments
    FOR SELECT USING (
        public.is_academy_admin()
        OR EXISTS (
            SELECT 1 FROM public.academy_students s
            WHERE s.id = academy_enrollments.student_id AND s.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "academy_enrollments_manage_admin" ON public.academy_enrollments;
CREATE POLICY "academy_enrollments_manage_admin" ON public.academy_enrollments
    FOR ALL USING (public.is_academy_admin())
    WITH CHECK (public.is_academy_admin());

-- ─── 4. Grants ────────────────────────────────────────────────────────────
GRANT ALL ON public.academy_students, public.academy_modules, public.academy_lessons, public.academy_enrollments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_students, public.academy_modules, public.academy_lessons, public.academy_enrollments TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_academy_admin() TO authenticated;

-- ─── 5. Trigger: cria academy_students ao signup com metadata 'academy'=true ──
CREATE OR REPLACE FUNCTION public.handle_academy_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Só cria aluno se o metadata indicar que é signup da Academy
    IF COALESCE((NEW.raw_user_meta_data->>'academy')::BOOLEAN, false) = true THEN
        INSERT INTO public.academy_students (user_id, full_name, email, phone, plan)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.email,
            NEW.raw_user_meta_data->>'phone',
            COALESCE(NEW.raw_user_meta_data->>'plan', 'none')
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_academy ON auth.users;
CREATE TRIGGER on_auth_user_created_academy
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_academy_signup();

-- ─── 6. Storage bucket academy-videos ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-videos', 'academy-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (MVP; upgrade p/ signed URLs se precisar anti-pirataria)
DROP POLICY IF EXISTS "academy_videos_public_read" ON storage.objects;
CREATE POLICY "academy_videos_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'academy-videos');

-- Upload/update/delete: só admin da Academy
DROP POLICY IF EXISTS "academy_videos_admin_insert" ON storage.objects;
CREATE POLICY "academy_videos_admin_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'academy-videos' AND public.is_academy_admin());

DROP POLICY IF EXISTS "academy_videos_admin_update" ON storage.objects;
CREATE POLICY "academy_videos_admin_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'academy-videos' AND public.is_academy_admin())
    WITH CHECK (bucket_id = 'academy-videos' AND public.is_academy_admin());

DROP POLICY IF EXISTS "academy_videos_admin_delete" ON storage.objects;
CREATE POLICY "academy_videos_admin_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'academy-videos' AND public.is_academy_admin());

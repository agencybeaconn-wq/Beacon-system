-- Academy Mentorship Tier: cliente VIP com acesso total + aulas privadas
-- User flow:
--   1. Admin abre perfil do aluno → toggle "Cliente de mentoria" = true
--   2. Aluno ganha acesso automático a TODOS os módulos publicados
--   3. Admin sobe aulas privadas (video + materiais) especificamente pra ele
--   4. Aluno vê seção "Minhas aulas" na home com aulas personalizadas

-- ============================================================
-- 1. FLAG DE CLIENTE DE MENTORIA
-- ============================================================
ALTER TABLE academy_students
  ADD COLUMN IF NOT EXISTS is_mentorship_client BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN academy_students.is_mentorship_client IS
'Quando true: aluno ganha acesso a todos os módulos publicados + pode ter aulas privadas (academy_lessons com student_id preenchido)';

CREATE INDEX IF NOT EXISTS idx_academy_students_mentorship
  ON academy_students(is_mentorship_client) WHERE is_mentorship_client = true;

-- ============================================================
-- 2. AULAS PRIVADAS (academy_lessons reaproveitado)
-- ============================================================
-- Lesson pode pertencer a um módulo (pública do curso) OU a um student (privada)
-- module_id OU student_id, não os dois, não nenhum

ALTER TABLE academy_lessons
  ALTER COLUMN module_id DROP NOT NULL;

ALTER TABLE academy_lessons
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES academy_students(id) ON DELETE CASCADE;

-- Garantia: exatamente UM dos dois preenchido
ALTER TABLE academy_lessons
  DROP CONSTRAINT IF EXISTS academy_lessons_scope_check;

ALTER TABLE academy_lessons
  ADD CONSTRAINT academy_lessons_scope_check
  CHECK (
    (module_id IS NOT NULL AND student_id IS NULL) OR
    (module_id IS NULL AND student_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_academy_lessons_student ON academy_lessons(student_id);

COMMENT ON COLUMN academy_lessons.student_id IS
'Se preenchido → aula privada visível só pra esse aluno (aulas de mentoria). Se NULL → aula pública de um módulo.';

-- ============================================================
-- 3. RLS: aulas privadas visíveis só pra seu dono + admin
-- ============================================================

-- Drop políticas antigas que assumem module_id obrigatório (se existirem)
DROP POLICY IF EXISTS academy_lessons_select ON academy_lessons;

CREATE POLICY academy_lessons_select ON academy_lessons
  FOR SELECT USING (
    -- Admin vê tudo
    EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
    OR
    -- Aulas públicas (module): precisa enrollment OU ser mentorship_client
    (
      module_id IS NOT NULL AND is_published = true AND (
        EXISTS (
          SELECT 1 FROM academy_enrollments e
          JOIN academy_students s ON s.id = e.student_id
          WHERE e.module_id = academy_lessons.module_id
            AND s.user_id = auth.uid()
            AND (e.expires_at IS NULL OR e.expires_at > NOW())
        )
        OR
        EXISTS (
          SELECT 1 FROM academy_students s
          WHERE s.user_id = auth.uid() AND s.is_mentorship_client = true
        )
      )
    )
    OR
    -- Aulas privadas: só o dono
    (
      student_id IS NOT NULL AND is_published = true AND
      EXISTS (
        SELECT 1 FROM academy_students s
        WHERE s.id = academy_lessons.student_id AND s.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 4. RLS: materiais de aulas privadas seguem a aula
-- ============================================================
-- A política existente já usa JOIN com academy_lessons, então academy_lessons_select
-- já controla acesso indiretamente. Só vamos revisar pra garantir que aulas privadas
-- não vazem materiais pra outros alunos.

DROP POLICY IF EXISTS academy_materials_enrolled_select ON academy_lesson_materials;

CREATE POLICY academy_materials_enrolled_select ON academy_lesson_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_lessons l
      WHERE l.id = academy_lesson_materials.lesson_id
      -- A própria política academy_lessons_select valida acesso
      -- mas como é SELECT aninhado, vamos replicar as regras explicitamente:
      AND (
        -- Admin
        EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
        OR
        -- Aula pública: enrollment OU mentorship_client
        (
          l.module_id IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM academy_enrollments e
              JOIN academy_students s ON s.id = e.student_id
              WHERE e.module_id = l.module_id
                AND s.user_id = auth.uid()
                AND (e.expires_at IS NULL OR e.expires_at > NOW())
            )
            OR
            EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_mentorship_client = true)
          )
        )
        OR
        -- Aula privada: dono
        (
          l.student_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM academy_students s WHERE s.id = l.student_id AND s.user_id = auth.uid())
        )
      )
    )
  );

-- ============================================================
-- 5. HELPER RPC: lista aulas privadas de um aluno (pro admin)
-- ============================================================
CREATE OR REPLACE FUNCTION list_student_private_lessons(target_student_id UUID)
RETURNS SETOF academy_lessons
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM academy_lessons
  WHERE student_id = target_student_id
  ORDER BY sort_order ASC, created_at ASC;
$$;

COMMENT ON FUNCTION list_student_private_lessons IS
'Helper pro admin listar todas as aulas privadas de um aluno. Bypass de RLS via SECURITY DEFINER.';

-- Academy — aulas privadas compartilhadas (n:n)
-- Antes: cada aula privada tinha 1 aluno (student_id). Se a call era com 3 pessoas,
-- admin duplicava a aula 3x.
-- Agora: aula privada existe 1x, atribuída a N alunos via junction table.

-- ============================================================
-- 1. JUNCTION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_lesson_students (
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES academy_students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lesson_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_lesson_students_student ON academy_lesson_students(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_lesson_students_lesson ON academy_lesson_students(lesson_id);

COMMENT ON TABLE academy_lesson_students IS
'Relação n:n entre aulas privadas e alunos. Aula pode ser compartilhada entre vários mentorados.';

-- ============================================================
-- 2. BACKFILL — migra aulas privadas existentes
-- ============================================================
INSERT INTO academy_lesson_students (lesson_id, student_id)
SELECT id, student_id
FROM academy_lessons
WHERE student_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. ATUALIZA CONSTRAINT — permite aula privada sem student_id (nova forma)
-- ============================================================
-- Antes: (module_id NOT NULL AND student_id NULL) OR (module_id NULL AND student_id NOT NULL)
-- Agora: apenas não permite os dois preenchidos simultaneamente
ALTER TABLE academy_lessons
  DROP CONSTRAINT IF EXISTS academy_lessons_scope_check;

ALTER TABLE academy_lessons
  ADD CONSTRAINT academy_lessons_scope_check
  CHECK (NOT (module_id IS NOT NULL AND student_id IS NOT NULL));

-- ============================================================
-- 4. RLS — alunos veem aulas privadas via junction OU via student_id (legacy)
-- ============================================================
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
    -- Aulas privadas LEGACY: student_id direto (dono)
    (
      student_id IS NOT NULL AND is_published = true AND
      EXISTS (
        SELECT 1 FROM academy_students s
        WHERE s.id = academy_lessons.student_id AND s.user_id = auth.uid()
      )
    )
    OR
    -- Aulas privadas COMPARTILHADAS: via junction
    (
      module_id IS NULL AND is_published = true AND
      EXISTS (
        SELECT 1 FROM academy_lesson_students ls
        JOIN academy_students s ON s.id = ls.student_id
        WHERE ls.lesson_id = academy_lessons.id
          AND s.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 5. RLS — materiais seguem aula (inclui junction)
-- ============================================================
DROP POLICY IF EXISTS academy_materials_enrolled_select ON academy_lesson_materials;

CREATE POLICY academy_materials_enrolled_select ON academy_lesson_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_lessons l
      WHERE l.id = academy_lesson_materials.lesson_id
      AND (
        EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
        OR
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
        (
          l.student_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM academy_students s WHERE s.id = l.student_id AND s.user_id = auth.uid())
        )
        OR
        (
          l.module_id IS NULL
          AND EXISTS (
            SELECT 1 FROM academy_lesson_students ls
            JOIN academy_students s ON s.id = ls.student_id
            WHERE ls.lesson_id = l.id AND s.user_id = auth.uid()
          )
        )
      )
    )
  );

-- ============================================================
-- 6. RLS na junction — só admin pode escrever, aluno lê próprio
-- ============================================================
ALTER TABLE academy_lesson_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academy_lesson_students_select ON academy_lesson_students;
CREATE POLICY academy_lesson_students_select ON academy_lesson_students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
    OR
    EXISTS (SELECT 1 FROM academy_students s WHERE s.id = academy_lesson_students.student_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS academy_lesson_students_write ON academy_lesson_students;
CREATE POLICY academy_lesson_students_write ON academy_lesson_students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
  );

-- ============================================================
-- 7. RPC — lista aulas privadas de um aluno (combina legacy + junction)
-- ============================================================
CREATE OR REPLACE FUNCTION list_student_private_lessons(target_student_id UUID)
RETURNS SETOF academy_lessons
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT l.*
  FROM academy_lessons l
  WHERE
    -- Legacy: aula com student_id direto
    l.student_id = target_student_id
    OR
    -- Novo: aula compartilhada via junction
    EXISTS (
      SELECT 1 FROM academy_lesson_students ls
      WHERE ls.lesson_id = l.id AND ls.student_id = target_student_id
    )
  ORDER BY l.sort_order ASC, l.created_at ASC;
$$;

COMMENT ON FUNCTION list_student_private_lessons IS
'Lista aulas privadas de um aluno. Combina o modelo legacy (student_id direto) e o novo (junction n:n).';

-- ============================================================
-- 8. RPC — lista alunos com acesso a uma aula (pro admin ver e editar)
-- ============================================================
CREATE OR REPLACE FUNCTION list_lesson_students(target_lesson_id UUID)
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.full_name, s.email
  FROM academy_students s
  JOIN academy_lesson_students ls ON ls.student_id = s.id
  WHERE ls.lesson_id = target_lesson_id
  ORDER BY s.full_name ASC;
$$;

COMMENT ON FUNCTION list_lesson_students IS
'Lista alunos que têm acesso a uma aula privada. Pro admin gerenciar compartilhamento.';

-- ============================================================
-- 9. RPC — lista todas as aulas privadas (biblioteca do admin)
-- ============================================================
CREATE OR REPLACE FUNCTION list_all_private_lessons()
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  video_url TEXT,
  is_published BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMPTZ,
  student_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.title,
    l.description,
    l.video_url,
    l.is_published,
    l.sort_order,
    l.created_at,
    (
      SELECT COUNT(*)::bigint FROM academy_lesson_students ls WHERE ls.lesson_id = l.id
    ) + CASE WHEN l.student_id IS NOT NULL THEN 1 ELSE 0 END AS student_count
  FROM academy_lessons l
  WHERE l.module_id IS NULL
  ORDER BY l.created_at DESC;
$$;

COMMENT ON FUNCTION list_all_private_lessons IS
'Biblioteca de todas as aulas privadas. Pro admin ver tudo e compartilhar com mais alunos.';

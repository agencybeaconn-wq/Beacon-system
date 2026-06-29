-- Academy Mentorship: tipo de módulo + convites por link + materiais de aula
-- User flow:
--   1. Admin cria módulo com type='mentoria' → fica fora do catálogo público
--   2. Admin gera invite link vinculado ao módulo → manda pro cliente (ex: WhatsApp)
--   3. Cliente abre /academy/convite/:token → loga/cadastra → enrollment auto-criado
--   4. Admin anexa materiais (PDF/ZIP/código/etc) às aulas → aluno baixa no player

-- ============================================================
-- 1. TIPO DE MÓDULO (course | mentoria)
-- ============================================================
ALTER TABLE academy_modules
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'course' CHECK (type IN ('course', 'mentoria'));

COMMENT ON COLUMN academy_modules.type IS
'course = aparece no catálogo público; mentoria = acesso só por convite/enrollment manual';

CREATE INDEX IF NOT EXISTS idx_academy_modules_type ON academy_modules(type);

-- ============================================================
-- 2. CONVITES POR LINK (academy_invites)
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  module_id UUID NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  note TEXT,                                          -- "Convite Pedro Silva - Mentoria Shopify"
  max_uses INTEGER DEFAULT 1,                          -- limite de usos (NULL = ilimitado)
  uses INTEGER NOT NULL DEFAULT 0,                     -- quantos já usaram
  expires_at TIMESTAMPTZ,                              -- NULL = permanente
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_invites_token ON academy_invites(token);
CREATE INDEX IF NOT EXISTS idx_academy_invites_module ON academy_invites(module_id);
CREATE INDEX IF NOT EXISTS idx_academy_invites_active ON academy_invites(is_active) WHERE is_active = true;

COMMENT ON TABLE academy_invites IS 'Convites por link pra dar acesso a módulos (principalmente mentorias)';

-- Log de usos (pra auditar quem redimiu qual convite)
CREATE TABLE IF NOT EXISTS academy_invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES academy_invites(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES academy_students(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invite_id, student_id)
);

-- RLS policies
ALTER TABLE academy_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_invite_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin vê e gerencia tudo
CREATE POLICY academy_invites_admin_all ON academy_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
  );

-- Aluno pode LER convite só pelo token (pra redeem) — controlado via função
CREATE POLICY academy_invite_redemptions_self ON academy_invite_redemptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM academy_students s WHERE s.id = student_id AND s.user_id = auth.uid())
  );

CREATE POLICY academy_invite_redemptions_admin ON academy_invite_redemptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
  );

-- ============================================================
-- 3. FUNÇÃO: REDIMIR CONVITE (valida + cria enrollment atomicamente)
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_academy_invite(invite_token TEXT)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  module_id UUID,
  module_slug TEXT,
  module_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite academy_invites%ROWTYPE;
  v_student_id UUID;
  v_already_enrolled BOOLEAN;
BEGIN
  -- Usuário tem que estar logado
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'Usuário não autenticado'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Pega ou cria academy_student
  SELECT id INTO v_student_id FROM academy_students WHERE user_id = auth.uid();
  IF v_student_id IS NULL THEN
    INSERT INTO academy_students (user_id, email, full_name)
    SELECT auth.uid(), u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.email)
    FROM auth.users u WHERE u.id = auth.uid()
    RETURNING id INTO v_student_id;
  END IF;

  -- Busca convite
  SELECT * INTO v_invite FROM academy_invites WHERE token = invite_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Convite inválido'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Validações
  IF NOT v_invite.is_active THEN
    RETURN QUERY SELECT false, 'Convite desativado'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN QUERY SELECT false, 'Convite expirou'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses >= v_invite.max_uses THEN
    RETURN QUERY SELECT false, 'Convite já foi totalmente utilizado'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Checa se já foi redimido por esse aluno (idempotente)
  SELECT EXISTS (
    SELECT 1 FROM academy_invite_redemptions
    WHERE invite_id = v_invite.id AND student_id = v_student_id
  ) INTO v_already_enrolled;

  IF NOT v_already_enrolled THEN
    -- Grava redemption
    INSERT INTO academy_invite_redemptions (invite_id, student_id)
    VALUES (v_invite.id, v_student_id);

    -- Incrementa uses
    UPDATE academy_invites SET uses = uses + 1, updated_at = NOW() WHERE id = v_invite.id;
  END IF;

  -- Cria/atualiza enrollment (ON CONFLICT = idempotente)
  INSERT INTO academy_enrollments (student_id, module_id)
  VALUES (v_student_id, v_invite.module_id)
  ON CONFLICT (student_id, module_id) DO NOTHING;

  -- Retorna dados do módulo
  RETURN QUERY
  SELECT true, NULL::TEXT, m.id, m.slug, m.title
  FROM academy_modules m WHERE m.id = v_invite.module_id;
END;
$$;

COMMENT ON FUNCTION redeem_academy_invite IS
'Redime um convite de academia: valida token → cria student se não existir → grava redemption → cria enrollment → retorna slug do módulo pra redirect';

-- ============================================================
-- 4. MATERIAIS DE AULA (qualquer tipo de arquivo)
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_lesson_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                                 -- "Código fonte do projeto"
  description TEXT,
  file_url TEXT NOT NULL,                              -- public URL do bucket
  file_name TEXT NOT NULL,                             -- "projeto-final.zip"
  file_size BIGINT,                                    -- bytes
  mime_type TEXT,                                      -- "application/zip"
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_materials_lesson ON academy_lesson_materials(lesson_id);

ALTER TABLE academy_lesson_materials ENABLE ROW LEVEL SECURITY;

-- Aluno enrolled vê materiais das aulas
CREATE POLICY academy_materials_enrolled_select ON academy_lesson_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM academy_lessons l
      JOIN academy_enrollments e ON e.module_id = l.module_id
      JOIN academy_students s ON s.id = e.student_id
      WHERE l.id = academy_lesson_materials.lesson_id
        AND s.user_id = auth.uid()
        AND (e.expires_at IS NULL OR e.expires_at > NOW())
    )
  );

-- Admin gerencia tudo
CREATE POLICY academy_materials_admin_all ON academy_lesson_materials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
  );

-- ============================================================
-- 5. BUCKET DE MATERIAIS (qualquer tipo de arquivo)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academy-materials', 'academy-materials', true, 524288000, NULL)  -- 500MB, qualquer mime
ON CONFLICT (id) DO UPDATE SET file_size_limit = 524288000, allowed_mime_types = NULL;

-- Storage policies
CREATE POLICY "academy-materials admin insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'academy-materials'
    AND EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
  );

CREATE POLICY "academy-materials public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'academy-materials');

CREATE POLICY "academy-materials admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'academy-materials'
    AND EXISTS (SELECT 1 FROM academy_students s WHERE s.user_id = auth.uid() AND s.is_admin = true)
  );

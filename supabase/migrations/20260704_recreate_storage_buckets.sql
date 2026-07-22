-- ============================================================================
-- Migration: (Re)criação dos buckets de Storage usados pelo Beacon
-- Contexto: o projeto Beacon (gbmbrjvkayzwhdwnqjpi) estava sem os buckets de
--           storage (só existia 'theme-assets'), causando "Bucket not found"
--           em uploads (ex.: logo de projeto/cliente -> bucket 'avatars').
-- Fonte de verdade: as chamadas supabase.storage.from('<bucket>') no código
--           do próprio Beacon. Só recriamos os buckets que o sistema usa e
--           cujas features estão ativas (com tabelas/funções de apoio já
--           existentes). 'client-uploads' foi omitido de propósito: a tabela
--           public.client_uploads não existe neste projeto -> feature inativa.
-- Idempotente: pode rodar de novo sem efeito colateral.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. BUCKETS  (public=true pois o front usa getPublicUrl; limites/mimes como
--    guarda de servidor — nunca confiar só no front)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('attachments',       'attachments',       true, NULL,       NULL),
  ('avatars',           'avatars',           true, 2097152,    ARRAY['image/png','image/jpeg','image/webp']),
  ('briefing-files',    'briefing-files',    true, NULL,       NULL),
  ('client-documents',  'client-documents',  true, 52428800,   NULL),
  ('training-videos',   'training-videos',   true, 524288000,  NULL),
  ('library-videos',    'library-videos',    true, 524288000,  NULL),
  ('reports',           'reports',           true, 52428800,   ARRAY['application/pdf']),
  ('task-images',       'task-images',       true, 5242880,    ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('studio-ia',         'studio-ia',         true, 10485760,   ARRAY['image/png','image/jpeg','image/webp']),
  ('academy-videos',    'academy-videos',    true, NULL,       NULL),
  ('academy-covers',    'academy-covers',    true, NULL,       NULL),
  ('academy-materials', 'academy-materials', true, 524288000,  NULL)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. POLICIES em storage.objects
--    Padrão geral (buckets operacionais): autenticado gerencia + leitura
--    pública (necessária para getPublicUrl exibir a mídia).
--    Academy: leitura pública, escrita só admin (is_academy_admin()).
-- ─────────────────────────────────────────────────────────────────────────

-- attachments (demandas/tarefas) ------------------------------------------
DROP POLICY IF EXISTS "attachments authenticated manage" ON storage.objects;
CREATE POLICY "attachments authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'attachments') WITH CHECK (bucket_id = 'attachments');
DROP POLICY IF EXISTS "attachments public read" ON storage.objects;
CREATE POLICY "attachments public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'attachments');

-- avatars (perfil de usuário / logo de cliente) ---------------------------
DROP POLICY IF EXISTS "avatars authenticated manage" ON storage.objects;
CREATE POLICY "avatars authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

-- briefing-files ----------------------------------------------------------
DROP POLICY IF EXISTS "briefing-files authenticated manage" ON storage.objects;
CREATE POLICY "briefing-files authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'briefing-files') WITH CHECK (bucket_id = 'briefing-files');
DROP POLICY IF EXISTS "briefing-files public read" ON storage.objects;
CREATE POLICY "briefing-files public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'briefing-files');

-- client-documents --------------------------------------------------------
DROP POLICY IF EXISTS "client-documents authenticated manage" ON storage.objects;
CREATE POLICY "client-documents authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'client-documents') WITH CHECK (bucket_id = 'client-documents');
DROP POLICY IF EXISTS "client-documents public read" ON storage.objects;
CREATE POLICY "client-documents public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'client-documents');

-- training-videos ---------------------------------------------------------
DROP POLICY IF EXISTS "training-videos authenticated manage" ON storage.objects;
CREATE POLICY "training-videos authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'training-videos') WITH CHECK (bucket_id = 'training-videos');
DROP POLICY IF EXISTS "training-videos public read" ON storage.objects;
CREATE POLICY "training-videos public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'training-videos');

-- library-videos ----------------------------------------------------------
DROP POLICY IF EXISTS "library-videos authenticated manage" ON storage.objects;
CREATE POLICY "library-videos authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'library-videos') WITH CHECK (bucket_id = 'library-videos');
DROP POLICY IF EXISTS "library-videos public read" ON storage.objects;
CREATE POLICY "library-videos public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'library-videos');

-- reports (PDFs de relatório) ---------------------------------------------
DROP POLICY IF EXISTS "reports authenticated manage" ON storage.objects;
CREATE POLICY "reports authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'reports') WITH CHECK (bucket_id = 'reports');
DROP POLICY IF EXISTS "reports public read" ON storage.objects;
CREATE POLICY "reports public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'reports');

-- task-images -------------------------------------------------------------
DROP POLICY IF EXISTS "task-images authenticated manage" ON storage.objects;
CREATE POLICY "task-images authenticated manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'task-images') WITH CHECK (bucket_id = 'task-images');
DROP POLICY IF EXISTS "task-images public read" ON storage.objects;
CREATE POLICY "task-images public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'task-images');

-- studio-ia (galeria Estúdio IA) ------------------------------------------
DROP POLICY IF EXISTS "studio-ia authenticated insert" ON storage.objects;
CREATE POLICY "studio-ia authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-ia' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "studio-ia public read" ON storage.objects;
CREATE POLICY "studio-ia public read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'studio-ia');
DROP POLICY IF EXISTS "studio-ia authenticated delete" ON storage.objects;
CREATE POLICY "studio-ia authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio-ia' AND auth.role() = 'authenticated');

-- academy-videos (leitura pública, escrita só admin) ----------------------
DROP POLICY IF EXISTS "academy_videos_public_read" ON storage.objects;
CREATE POLICY "academy_videos_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'academy-videos');
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

-- academy-covers ----------------------------------------------------------
DROP POLICY IF EXISTS "academy_covers_public_read" ON storage.objects;
CREATE POLICY "academy_covers_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'academy-covers');
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

-- academy-materials -------------------------------------------------------
DROP POLICY IF EXISTS "academy-materials public read" ON storage.objects;
CREATE POLICY "academy-materials public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'academy-materials');
DROP POLICY IF EXISTS "academy-materials admin insert" ON storage.objects;
CREATE POLICY "academy-materials admin insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'academy-materials' AND public.is_academy_admin());
DROP POLICY IF EXISTS "academy-materials admin delete" ON storage.objects;
CREATE POLICY "academy-materials admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'academy-materials' AND public.is_academy_admin());

NOTIFY pgrst, 'reload schema';

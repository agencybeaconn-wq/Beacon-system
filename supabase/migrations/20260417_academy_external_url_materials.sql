-- Academy — suporte a materiais via URL externa (GitHub, Google Drive, etc)
-- Antes: materiais eram sempre arquivos no bucket academy-materials.
-- Agora: material pode ser URL externa (ex: link de repo GitHub privado).

ALTER TABLE academy_lesson_materials
  ADD COLUMN IF NOT EXISTS is_external_url BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN academy_lesson_materials.is_external_url IS
'Se true, file_url aponta pra URL externa (GitHub, Drive, site, etc). Se false, é arquivo no bucket academy-materials.';

-- file_size e mime_type ficam opcionais pra URLs externas (impossível saber sem baixar)
ALTER TABLE academy_lesson_materials ALTER COLUMN file_size DROP NOT NULL;
ALTER TABLE academy_lesson_materials ALTER COLUMN mime_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_academy_materials_external
  ON academy_lesson_materials(is_external_url) WHERE is_external_url = true;

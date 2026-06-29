-- Migração para evoluir o sistema de tarefas (Nível ClickUp)
ALTER TABLE public.client_tasks ADD COLUMN IF NOT EXISTS drive_links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.client_tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.client_tasks.drive_links IS 'Lista de links do Google Drive associados à tarefa';
COMMENT ON COLUMN public.client_tasks.attachments IS 'Lista de anexos (arquivos) associados à tarefa';

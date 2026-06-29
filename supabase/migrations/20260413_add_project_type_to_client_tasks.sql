-- Adicionar coluna project_type em client_tasks
-- Permite marcar cada demanda como 'fixo' (MRR) ou 'avulso' independentemente
-- do client_type do cliente pai, dando flexibilidade operacional.

ALTER TABLE public.client_tasks
    ADD COLUMN IF NOT EXISTS project_type TEXT
    CHECK (project_type IN ('fixo', 'avulso'));

COMMENT ON COLUMN public.client_tasks.project_type IS
    'Tipo de projeto da demanda: fixo (MRR) ou avulso. NULL = herda do cliente pai.';

-- Índice para filtros por tipo
CREATE INDEX IF NOT EXISTS idx_client_tasks_project_type
    ON public.client_tasks (project_type)
    WHERE project_type IS NOT NULL;

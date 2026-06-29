-- Adicionar coluna is_pinned à tabela client_resources
ALTER TABLE public.client_resources 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Índice para melhorar performance de ordenação por fixados
CREATE INDEX IF NOT EXISTS idx_client_resources_pinned ON public.client_resources(is_pinned DESC);

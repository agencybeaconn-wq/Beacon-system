-- 📁 ETAPA 2: RELACIONAMENTO AUTOMÁTICO (PRODUTOS -> KANBAN) 📁
-- Este script garante que o Kanban consiga armazenar dados vindos de produtos e sincronizar com a timeline.

DO $$ 
BEGIN
    -- 1. Coluna para ID do Produto de origem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'product_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN product_id UUID;
    END IF;

    -- 2. Coluna para Nome do Produto (Cache para performance/exibição)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'product_name') THEN
        ALTER TABLE public.client_tasks ADD COLUMN product_name TEXT;
    END IF;

    -- 3. Coluna para ID do Step da Timeline (Sincronização Bidirecional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'step_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN step_id TEXT;
    END IF;

    -- 4. Coluna para Workspace (Isolamento de dados)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN workspace_id UUID;
    END IF;
    
    -- 5. Coluna para Categoria (Geral, Shopify, etc)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'category') THEN
        ALTER TABLE public.client_tasks ADD COLUMN category TEXT;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

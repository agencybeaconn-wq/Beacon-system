-- 📁 ETAPA 4: POLIMENTO DA PONTE PORTAL-KANBAN 📁
-- Objetivo: Vincular solicitações do portal aos cards do Kanban por ID.

-- 1. Adicionar task_id à tabela de solicitações
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demand_requests' AND column_name='task_id') THEN
        ALTER TABLE public.demand_requests ADD COLUMN task_id UUID REFERENCES public.client_tasks(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Adicionar client_priority se estiver faltando (caso o schema anterior fosse diferente)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demand_requests' AND column_name='client_priority') THEN
        ALTER TABLE public.demand_requests ADD COLUMN client_priority TEXT DEFAULT 'normal';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

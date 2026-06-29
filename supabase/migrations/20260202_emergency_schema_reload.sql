-- 🚨 REPARO DE EMERGÊNCIA: SCHEMA RELOAD 🚨
-- Objetivo: Forçar o PostgREST a enxergar as novas colunas da tabela demand_requests.

-- 1. Garantir que as colunas existem (redondância de segurança)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demand_requests' AND column_name='task_id') THEN
        ALTER TABLE public.demand_requests ADD COLUMN task_id UUID REFERENCES public.client_tasks(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demand_requests' AND column_name='client_priority') THEN
        ALTER TABLE public.demand_requests ADD COLUMN client_priority TEXT DEFAULT 'normal';
    END IF;
END $$;

-- 2. "Tocar" na tabela para forçar atualização de metadados
COMMENT ON TABLE public.demand_requests IS 'Tabela de solicitações sincronizada com Kanban v2 - ' || now();

-- 3. Notificar recarregamento (Padrão Supabase)
NOTIFY pgrst, 'reload schema';

-- 4. Notificar recarregamento (Alternativo para alguns ambientes)
NOTIFY pgrst, 'reload config';

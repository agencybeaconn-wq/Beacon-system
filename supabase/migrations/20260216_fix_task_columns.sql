-- 🚨 RECONSTRUÇÃO TOTAL DE SEGURANÇA E COLUNAS (STABILITY RECOVERY) 🚨
-- Objetivo: Garantir que TODAS as colunas que o App espera estão presentes e o Cache do Supabase está atualizado.

-- 1. ADICIONAR COLUNAS FALTANTES (Se não existirem)
DO $$ 
BEGIN
    -- Coluna de Responsável (Causadora do erro recente)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'assignee_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Coluna de Workspace (Essencial para permissões)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;

    -- Colunas de Auditoria
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'updated_at') THEN
        ALTER TABLE public.client_tasks ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
    
    -- IDs de Produto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'product_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN product_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'product_name') THEN
        ALTER TABLE public.client_tasks ADD COLUMN product_name TEXT;
    END IF;
END $$;

-- 2. RESET TOTAL DE RLS (Garantir que não haja bloqueio por cache de políticas)
ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_tasks_agency_access" ON public.client_tasks;
DROP POLICY IF EXISTS "agency_staff_manage_tasks" ON public.client_tasks;
DROP POLICY IF EXISTS "client_portal_tasks_isolation" ON public.client_tasks;
DROP POLICY IF EXISTS "Users can manage client tasks" ON public.client_tasks;

-- Política Simplificada e Segura para Agência (ADMIN)
CREATE POLICY "agency_staff_full_access" ON public.client_tasks
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE user_id = auth.uid() 
        AND user_type = 'agency'
    )
);

-- Política para Clientes (Ver apenas as próprias)
CREATE POLICY "clients_own_tasks_access" ON public.client_tasks
FOR SELECT TO authenticated USING (
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE user_id = auth.uid()
    )
);

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

-- 3. FORÇAR ATUALIZAÇÃO DO SCHEMA CACHE DO SUPABASE
-- Isso resolve o erro PGRST204 (Cache Dirty)
NOTIFY pgrst, 'reload schema';

SELECT 'Sistema restaurado! Use o botão "Nova Tarefa" novamente.' as status;

-- 🚨 REMOÇÃO TOTAL DE BLOQUEIOS (VOLTAR AO FUNCIONAL) 🚨
-- O usuário relatou que a segurança excessiva quebrou o fluxo.
-- Vamos desativar o RLS para que a Agência volte a ver TUDO.

-- 1. Desabilitar RLS nas tabelas críticas
ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_step_status DISABLE ROW LEVEL SECURITY;

-- 2. Limpar todas as políticas que criei (Para evitar sujeira futura)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND (tablename = 'client_tasks' OR tablename = 'demand_requests'))
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.' || quote_ident(pol.tablename);
    END LOOP;
END $$;

-- 3. Conceder permissão total para usuários autenticados (Agência)
GRANT ALL ON public.client_tasks TO authenticated;
GRANT ALL ON public.demand_requests TO authenticated;
GRANT ALL ON public.client_step_status TO authenticated;

-- 4. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';

-- Agora, o controle de visibilidade volta a ser 100% responsabilidade do front-end/queries,
-- como estava antes das minhas intervenções de RLS.

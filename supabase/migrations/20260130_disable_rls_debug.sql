-- 🚨 NUCLEAR OPTION: DESATIVAR RLS PARA DEBUG 🚨
-- Vamos desativar momentaneamente a segurança para confirmar se as tarefas existem.

-- 1. Desativar RLS nas tabelas de Tasks e Demandas
ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_step_status DISABLE ROW LEVEL SECURITY;

-- 2. Conceder permissão total (Só para garantir que não é GRANT o problema)
GRANT ALL ON public.client_tasks TO authenticated;
GRANT ALL ON public.demand_requests TO authenticated;
GRANT ALL ON public.client_step_status TO authenticated;

-- 3. Recarregar Schema
NOTIFY pgrst, 'reload schema';

-- Se as tarefas aparecerem depois disso, CONFIRMAMOS que é problema de RLS.
-- Se não aparecerem, aí sim os dados podem não ter sido criados.

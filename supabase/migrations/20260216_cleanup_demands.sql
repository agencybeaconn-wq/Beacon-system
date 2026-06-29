-- 🚨 LIMPEZA DE DADOS: Executáveis e Demandas 🚨
-- Este script remove apenas os itens internos, mantendo os produtos e clientes intactos.

-- 1. Remover executáveis dos produtos
TRUNCATE TABLE public.agency_product_features CASCADE;

-- 2. Remover solicitações de clientes
TRUNCATE TABLE public.demand_requests CASCADE;

-- 3. Remover tarefas atribuídas aos clientes
TRUNCATE TABLE public.client_assigned_tasks CASCADE;

-- 4. Remover tarefas do Kanban (client_tasks)
TRUNCATE TABLE public.client_tasks CASCADE;

-- Log de confirmação
SELECT 'Limpeza concluída com sucesso!' as status;

-- 🛡️ IMPLEMENTAÇÃO DO PAPEL DE OPERADOR (RESTRIÇÃO DE ACESSO) 🛡️
-- Objetivo: Restringir operadores para que vejam apenas suas próprias tarefas e não acessem dados sensíveis.

-- 1. ADICIONAR COLUNA PARA CONTROLE DE PERMISSOES NO MEMBER_ACCESS_LEVELS (Se necessário)
-- Por enquanto, usaremos o campo 'role' da tabela 'team_members' com o valor 'operator'.

-- 2. RESET DE POLÍTICAS PARA CLIENT_TASKS
ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;

-- Remover políticas antigas da agência para substituir por lógica de nível de acesso
DROP POLICY IF EXISTS "agency_staff_full_access" ON public.client_tasks;
DROP POLICY IF EXISTS "agency_staff_manage_tasks" ON public.client_tasks;

-- 2.1 Política para ADMINS (Acesso Total)
CREATE POLICY "agency_admin_full_access" ON public.client_tasks
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE user_id = auth.uid() 
        AND user_type = 'agency'
        AND role = 'admin'
    )
);

-- 2.2 Política para OPERADORES (Acesso Restrito às Tarefas Atribuídas)
-- Operadores podem ver e editar tarefas onde são o assignee_id
CREATE POLICY "agency_operator_restricted_access" ON public.client_tasks
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE user_id = auth.uid() 
        AND user_type = 'agency'
        AND role = 'operator'
    )
    AND (assignee_id = auth.uid())
);

-- 3. GARANTIR QUE OPERADORES NÃO VEJAM DEMAND_REQUESTS GERAIS
ALTER TABLE public.demand_requests DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_manage_demands" ON public.demand_requests;

CREATE POLICY "agency_admin_manage_demands" ON public.demand_requests
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE user_id = auth.uid() 
        AND user_type = 'agency'
        AND role = 'admin'
    )
);

-- Operadores podem ver demandas se estiverem de alguma forma vinculadas, 
-- mas por padrão vamos deixar apenas para Admins por enquanto para máxima segurança.
-- Se precisar que vejam, podemos adicionar uma política baseada em atribuição futura.

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;

-- 4. FORÇAR ATUALIZAÇÃO DO SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

SELECT 'Papel de Operador configurado com sucesso!' as status;

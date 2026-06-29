-- 🛡️ SOLUÇÃO ROBUSTA ANTI-RECURSÃO (SECURITY DEFINER) 🛡️

-- O problema: As políticas SQL entram em loop ou bloqueio porque tentar ler 'team_members' 
-- exige permissão, que por sua vez checa 'team_members'...
-- A solução: Criar funções que rodam como "Super Usuário" para checar a permissão sem travas.

-- 1. Função Segura para Checar se é Agência/Dono
CREATE OR REPLACE FUNCTION public.check_is_agency_or_owner(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- ⚠️ Roda com privilégios do criador (bypass RLS)
SET search_path = public -- Segurança para evitar search_path injection
AS $$
BEGIN
    -- 1. É Dono?
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = (SELECT id FROM auth.users WHERE email = check_email LIMIT 1)) THEN
        RETURN TRUE;
    END IF;

    -- 2. É Staff da Agência?
    IF EXISTS (SELECT 1 FROM public.team_members WHERE lower(email) = lower(check_email) AND user_type = 'agency') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 2. Função Segura para Pegar ID do Cliente Vinculado
CREATE OR REPLACE FUNCTION public.get_user_client_id(check_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_client_id UUID;
BEGIN
    SELECT linked_client_id INTO found_client_id
    FROM public.team_members 
    WHERE lower(email) = lower(check_email)
    LIMIT 1;
    
    RETURN found_client_id;
END;
$$;

-- 3. APLICAR AS NOVAS FUNÇÕES NAS POLÍTICAS (Sem Recursão!)

-- Reset Policies
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_tasks_policy" ON public.client_tasks;

CREATE POLICY "robust_tasks_policy" ON public.client_tasks
FOR ALL USING (
    -- Permite se a Função de Segurança disser OK (Agência/Dono)
    public.check_is_agency_or_owner(auth.email())
    OR
    -- OU se a Função retornar o mesmo ID do Cliente da task
    client_id = public.get_user_client_id(auth.email())
);

-- Mesma coisa para Demandas
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_demands_policy" ON public.demand_requests;

CREATE POLICY "robust_demands_policy" ON public.demand_requests
FOR ALL USING (
    public.check_is_agency_or_owner(auth.email())
    OR
    client_id = public.get_user_client_id(auth.email())
);

-- Atualizar Cache
NOTIFY pgrst, 'reload schema';

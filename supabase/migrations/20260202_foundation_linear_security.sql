-- 🛡️ PASSO 1: ESTABILIZAÇÃO DA FUNDAÇÃO (ANTI-RECURSÃO) 🛡️
-- Este script implementa funções seguras que evitam que o banco entre em loop ao checar permissões.

-- 1. Função Segura para Checar se é Agência/Dono (Bypass RLS)
CREATE OR REPLACE FUNCTION public.safe_check_is_staff(check_email TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com privilégios de sistema
SET search_path = public
AS $$
BEGIN
    -- É Dono da Agência?
    IF EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE owner_id = (SELECT id FROM auth.users WHERE email = check_email LIMIT 1)
    ) THEN
        RETURN TRUE;
    END IF;

    -- É Staff da Agência?
    IF EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(check_email) 
        AND user_type = 'agency'
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 2. Função Segura para Pegar o ID do Cliente Vinculado
CREATE OR REPLACE FUNCTION public.safe_get_linked_client_id(check_email TEXT)
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_id UUID;
BEGIN
    SELECT linked_client_id INTO found_id
    FROM public.team_members 
    WHERE lower(email) = lower(check_email)
    LIMIT 1;

    RETURN found_id;
END;
$$;

-- 3. Aplicar Regras Limpas e Lineares nas Tabelas Core

-- A) TEAM_MEMBERS (Onde os loops costumam acontecer)
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.team_members';
    END LOOP;
END $$;

CREATE POLICY "linear_staff_manage_members" ON public.team_members 
FOR ALL USING ( public.safe_check_is_staff(auth.email()) );

CREATE POLICY "linear_client_read_self" ON public.team_members 
FOR SELECT USING ( lower(email) = lower(auth.email()) );

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- B) AGENCY_CLIENTS
ALTER TABLE public.agency_clients DISABLE ROW LEVEL SECURITY;
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'agency_clients') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.agency_clients';
    END LOOP;
END $$;

CREATE POLICY "linear_staff_manage_clients" ON public.agency_clients 
FOR ALL USING ( public.safe_check_is_staff(auth.email()) );

CREATE POLICY "linear_client_read_own_profile" ON public.agency_clients 
FOR SELECT USING ( id = public.safe_get_linked_client_id(auth.email()) );

ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;

-- C) TASK_COLUMNS (Essencial para o Kanban carregar para todos)
ALTER TABLE public.task_columns DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_columns_read_global" ON public.task_columns;
CREATE POLICY "task_columns_read_global" ON public.task_columns FOR SELECT TO authenticated USING (true);
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

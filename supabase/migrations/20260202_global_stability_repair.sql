-- 🛡️ REPARO GLOBAL DE ESTABILIDADE E SEGURANÇA 🛡️
-- Este script limpa conflitos históricos, quebra loops de recursão e restaura a visão do sistema.

-- ==========================================
-- 1. LIMPEZA TOTAL DE POLÍTICAS CONFLITANTES
-- ==========================================
-- Vamos desativar o RLS temporariamente para garantir que as alterações sejam aplicadas sem erros de permissão.
ALTER TABLE public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_columns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;

-- Limpar todas as políticas da team_members (Causa principal da recursão infinita)
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.team_members';
    END LOOP;
END $$;

-- Limpar todas as políticas da agency_clients
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'agency_clients' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.agency_clients';
    END LOOP;
END $$;

-- Limpar todas as políticas da task_columns
DROP POLICY IF EXISTS "task_columns_read" ON public.task_columns;

-- ==========================================
-- 2. CRIAÇÃO DE REGRAS LINEARES (ANTI-LOOP)
-- ==========================================

-- A) WORKSPACES: Dono vê tudo, Membros veem apenas onde estão.
DROP POLICY IF EXISTS "Users can view workspaces they own" ON public.workspaces;
CREATE POLICY "workspaces_owner_access" ON public.workspaces FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "workspaces_member_access" ON public.workspaces FOR SELECT USING (
    id IN (SELECT workspace_id FROM public.team_members WHERE lower(email) = lower(auth.email()))
);

-- B) TEAM_MEMBERS: Regra base SEM SELF-QUERY (Evita recursão)
CREATE POLICY "team_members_self_read" ON public.team_members FOR SELECT TO authenticated 
USING ( lower(email) = lower(auth.email()) );

CREATE POLICY "team_members_owner_all" ON public.team_members FOR ALL 
USING ( EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()) );

-- C) AGENCY_CLIENTS: Dono vê tudo do workspace, Cliente vê apenas a si mesmo.
CREATE POLICY "agency_clients_owner_access" ON public.agency_clients FOR ALL 
USING ( EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()) );

CREATE POLICY "agency_clients_portal_read" ON public.agency_clients FOR SELECT 
USING ( id IN (SELECT linked_client_id FROM public.team_members WHERE lower(email) = lower(auth.email())) );

-- D) TASK_COLUMNS: Visível para todos os autenticados (Essencial para o Kanban carregar)
CREATE POLICY "task_columns_read_global" ON public.task_columns FOR SELECT TO authenticated USING (true);

-- E) CLIENT_TASKS: Regra mestre (Dono/Equipe vs Cliente)
DROP POLICY IF EXISTS "master_tasks_policy" ON public.client_tasks;
CREATE POLICY "client_tasks_owner_access" ON public.client_tasks FOR ALL 
USING ( EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()) );

CREATE POLICY "client_tasks_portal_access" ON public.client_tasks FOR SELECT 
USING ( client_id IN (SELECT linked_client_id FROM public.team_members WHERE lower(email) = lower(auth.email())) );

-- ==========================================
-- 3. RESTAURAÇÃO DE DADOS MÍNIMOS
-- ==========================================
-- Garantir que as colunas do Kanban estejam lá para não quebrar a interface
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'todo', 'A Fazer', 0, 'bg-slate-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'todo');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'in_progress', 'Em Andamento', 1, 'bg-blue-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'in_progress');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'validation', 'Validação', 2, 'bg-purple-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'validation');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'done', 'Concluído', 3, 'bg-green-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'done');

-- ==========================================
-- 4. RE-ATIVAÇÃO DA SEGURANÇA
-- ==========================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

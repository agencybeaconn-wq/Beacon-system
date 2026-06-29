-- 🚨 DIAGNÓSTICO E RESTAURAÇÃO DE INFRAESTRUTURA DE TAREFAS 🚨
-- Use este script se a criação de tarefas parou de funcionar após a limpeza.

-- 1. Verificar se a coluna workspace_id existe (essencial para isolamento)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.client_tasks ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
    END IF;
END $$;

-- 2. Garantir que as colunas de Auditoria existam
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'updated_at') THEN
        ALTER TABLE public.client_tasks ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- 3. RESET DE PERMISSÕES (Garantir que Admin e Clientes consigam operar)
-- Nota: Isso resolve o erro de "Permission Denied" que pode ser mascarado como erro genérico.

ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_staff_manage_tasks" ON public.client_tasks;
CREATE POLICY "agency_staff_manage_tasks" ON public.client_tasks
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
        AND user_type = 'agency'
    )
);

DROP POLICY IF EXISTS "clients_view_own_tasks" ON public.client_tasks;
CREATE POLICY "clients_view_own_tasks" ON public.client_tasks
FOR SELECT TO authenticated USING (
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email())
    )
);

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

-- 4. Garantir Colunas do Kanban
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'todo', 'A Fazer', 0, 'bg-slate-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'todo');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'in_progress', 'Em Andamento', 1, 'bg-blue-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'in_progress');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'validation', 'Validação', 2, 'bg-purple-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'validation');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'done', 'Concluído', 3, 'bg-green-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'done');

-- 5. Commit Final
NOTIFY pgrst, 'reload schema';
SELECT 'Infraestrutura restaurada com sucesso! Tente criar a tarefa agora.' as status;

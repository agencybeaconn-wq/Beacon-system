-- GARANTIA DE INFRAESTRUTURA PARA DEMANDAS DA AGÊNCIA (LEVER OS)
-- Objetivo: Garantir que as tabelas existem e as permissões RLS estão liberadas para a Agência.

-- 1. Tabela de Colunas (Se não existir)
CREATE TABLE IF NOT EXISTS public.task_columns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT 'bg-slate-500',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Dados iniciais se estiver vazia
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'todo', 'A Fazer', 0, 'bg-slate-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns);
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'in_progress', 'Em Andamento', 1, 'bg-blue-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'in_progress');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'validation', 'Validação', 2, 'bg-purple-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'validation');
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'done', 'Concluído', 3, 'bg-green-500' WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'done');

-- 2. Garantir colunas essenciais em client_tasks
-- Adiciona created_at e updated_at se não existirem (já devem existir, mas segurança)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_tasks' AND column_name = 'updated_at') THEN
        ALTER TABLE public.client_tasks ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
    END IF;
END $$;

-- 3. PERMISSÕES RLS (RESET PARA AGÊNCIA E CLIENTES)
ALTER TABLE public.client_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_columns DISABLE ROW LEVEL SECURITY;

-- Políticas client_tasks
DROP POLICY IF EXISTS "client_tasks_agency_access" ON public.client_tasks;
CREATE POLICY "client_tasks_agency_access" ON public.client_tasks
    FOR ALL TO authenticated USING (true); -- Permitir tudo para agência/admin temporariamente para teste

-- Políticas task_columns
DROP POLICY IF EXISTS "task_columns_read" ON public.task_columns;
CREATE POLICY "task_columns_read" ON public.task_columns
    FOR SELECT TO authenticated USING (true);

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.client_tasks TO authenticated;
GRANT ALL ON public.task_columns TO authenticated;

-- 🚀 RESTAURAÇÃO DE INFRAESTRUTURA KANBAN
-- Este script garante que as colunas padrão existam para todos

-- 1. Inserir ou Restaurar Colunas Padrão
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'todo', 'A Fazer', 0, 'bg-slate-500' 
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'todo');

INSERT INTO public.task_columns (id, title, position, color)
SELECT 'in_progress', 'Em Andamento', 1, 'bg-blue-500' 
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'in_progress');

INSERT INTO public.task_columns (id, title, position, color)
SELECT 'validation', 'Validação', 2, 'bg-purple-500' 
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'validation');

INSERT INTO public.task_columns (id, title, position, color)
SELECT 'done', 'Concluído', 3, 'bg-green-500' 
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'done');

-- 2. Garantir RLS aberto para leitura das colunas (Essencial para o Cliente ver o quadro)
ALTER TABLE public.task_columns DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_columns_read" ON public.task_columns;
CREATE POLICY "task_columns_read" ON public.task_columns FOR SELECT TO authenticated USING (true);
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

-- 3. Notificar recarga
NOTIFY pgrst, 'reload schema';

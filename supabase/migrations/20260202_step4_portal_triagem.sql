-- 📁 ETAPA 4: ENTREGA TRANSPARENTE (PORTAL SYNC) 📁
-- Objetivo: Criar a coluna de Triagem para demandas automáticas do portal.

-- 1. Adicionar coluna 'triagem' se não existir
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'triagem', 'Triagem / Inbox', -1, 'bg-amber-500' 
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'triagem');

-- 2. Recalibrar posições para garantir que Triagem seja a primeira
UPDATE public.task_columns SET position = -1 WHERE id = 'triagem';
UPDATE public.task_columns SET position = 0 WHERE id = 'todo';
UPDATE public.task_columns SET position = 1 WHERE id = 'in_progress';
UPDATE public.task_columns SET position = 2 WHERE id = 'validation';
UPDATE public.task_columns SET position = 3 WHERE id = 'done';

NOTIFY pgrst, 'reload schema';

-- Migration: renomear "Contato" para "LEAD" e mover "1º Contato" para a 2ª posição
-- Aplica-se a todos os workspaces que tenham essas colunas (idempotente).
-- Demais colunas mantêm a sequência: Call Agendada, Follow Up, Reativação, Fechamento.

-- 1. Renomeia a coluna "Contato" para "LEAD" (case-insensitive, ignora "1º Contato")
UPDATE public.crm_kanban_columns
SET title = 'LEAD'
WHERE lower(title) = 'contato';

-- 2. Reordena as colunas conhecidas para a sequência desejada.
-- Sem constraint UNIQUE em (workspace_id, order_index), os updates podem ser sequenciais.
UPDATE public.crm_kanban_columns
SET order_index = 0
WHERE title = 'LEAD';

UPDATE public.crm_kanban_columns
SET order_index = 1
WHERE lower(title) IN ('1º contato', '1° contato', '1o contato', '1 contato', 'primeiro contato');

UPDATE public.crm_kanban_columns
SET order_index = 2
WHERE lower(title) = 'call agendada';

UPDATE public.crm_kanban_columns
SET order_index = 3
WHERE lower(title) IN ('follow up', 'follow-up', 'followup');

UPDATE public.crm_kanban_columns
SET order_index = 4
WHERE lower(title) IN ('reativação', 'reativacao');

UPDATE public.crm_kanban_columns
SET order_index = 5
WHERE lower(title) = 'fechamento';

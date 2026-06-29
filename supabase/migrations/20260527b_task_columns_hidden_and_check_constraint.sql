-- ═══════════════════════════════════════════════════════════════════════
-- task_columns: flag hidden + CHECK constraint em client_tasks.status
-- ═══════════════════════════════════════════════════════════════════════
-- 1) task_columns.hidden — esconde colunas do kanban principal sem deletar.
--    "Concluído" (387 tasks) sai do quadro → kanban mostra 4 colunas
--    operacionais. Histórico futuro lê hidden=true também.
--
-- 2) CHECK via trigger em client_tasks.status — impede insert/update com
--    status que não existe em task_columns. Bug do 'concluido.'/'pending'
--    legacy não pode acontecer de novo.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.task_columns
    ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- "Concluído" sai do quadro principal (vira histórico)
UPDATE public.task_columns SET hidden = true WHERE id = 'concluido';

-- Trigger de validação (CHECK não pode referenciar outra tabela em Postgres)
CREATE OR REPLACE FUNCTION public.validate_client_task_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF NEW.status IS NULL THEN
        RAISE EXCEPTION 'client_tasks.status não pode ser NULL';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = NEW.status) THEN
        RAISE EXCEPTION 'Status "%" inválido — não existe em task_columns. Valores válidos: %',
            NEW.status,
            (SELECT string_agg(id, ', ') FROM public.task_columns);
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_validate_client_task_status ON public.client_tasks;
CREATE TRIGGER tr_validate_client_task_status
    BEFORE INSERT OR UPDATE OF status ON public.client_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_client_task_status();

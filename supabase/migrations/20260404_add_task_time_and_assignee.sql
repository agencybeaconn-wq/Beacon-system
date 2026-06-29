-- Adicionar campos de tempo estimado e responsável por tarefa no onboarding
-- estimated_minutes: tempo manual definido pelo admin (em minutos)
-- assigned_to: UUID do membro do time responsável pela tarefa

ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID DEFAULT NULL;

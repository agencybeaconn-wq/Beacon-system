-- Limite em dias para cada fase do onboarding
-- Quando a fase inicia, due_date = started_at + due_days_limit dias
ALTER TABLE onboarding_phases ADD COLUMN IF NOT EXISTS due_days_limit INTEGER DEFAULT NULL;

-- Limpa onboardings que foram criados sem fases (bug do INT vs NUMERIC)
-- Isso vai apagar os registros quebrados para que o sistema recrie corretamente

DELETE FROM public.onboarding_timeline WHERE onboarding_id IN (
    SELECT o.id FROM public.onboarding o
    LEFT JOIN public.onboarding_phases op ON op.onboarding_id = o.id
    WHERE op.id IS NULL
);

DELETE FROM public.onboarding WHERE id IN (
    SELECT o.id FROM public.onboarding o
    LEFT JOIN public.onboarding_phases op ON op.onboarding_id = o.id
    WHERE op.id IS NULL
);

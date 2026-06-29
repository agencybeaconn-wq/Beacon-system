-- PASSO 2: RLS Policies

ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage onboarding" ON public.onboarding;
CREATE POLICY "Users can manage onboarding" ON public.onboarding
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.agency_clients ac
        WHERE ac.id = onboarding.client_id
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = ac.workspace_id
            AND (
                w.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()
                )
            )
        )
    )
);

ALTER TABLE public.onboarding_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage onboarding phases" ON public.onboarding_phases;
CREATE POLICY "Users can manage onboarding phases" ON public.onboarding_phases
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.onboarding o
        JOIN public.agency_clients ac ON ac.id = o.client_id
        WHERE o.id = onboarding_phases.onboarding_id
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = ac.workspace_id
            AND (
                w.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()
                )
            )
        )
    )
);

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage onboarding tasks" ON public.onboarding_tasks;
CREATE POLICY "Users can manage onboarding tasks" ON public.onboarding_tasks
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.onboarding_phases op
        JOIN public.onboarding o ON o.id = op.onboarding_id
        JOIN public.agency_clients ac ON ac.id = o.client_id
        WHERE op.id = onboarding_tasks.phase_id
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = ac.workspace_id
            AND (
                w.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()
                )
            )
        )
    )
);

ALTER TABLE public.onboarding_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage onboarding timeline" ON public.onboarding_timeline;
CREATE POLICY "Users can manage onboarding timeline" ON public.onboarding_timeline
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.onboarding o
        JOIN public.agency_clients ac ON ac.id = o.client_id
        WHERE o.id = onboarding_timeline.onboarding_id
        AND EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = ac.workspace_id
            AND (
                w.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()
                )
            )
        )
    )
);

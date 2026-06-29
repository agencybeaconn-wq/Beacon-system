-- PASSO 1: Coluna + Tabelas + Indexes

ALTER TABLE public.agency_clients
ADD COLUMN IF NOT EXISTS onboarding_type TEXT;

CREATE TABLE IF NOT EXISTS public.onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('mrr_start', 'mrr_growth', 'avulso_tema', 'avulso_reformulacao', 'avulso_arte')),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'pausado')),
    current_phase TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    assigned_cs UUID,
    assigned_designer UUID,
    assigned_traffic UUID,
    assigned_tech UUID,
    whatsapp_group_created BOOLEAN DEFAULT false,
    portal_access_granted BOOLEAN DEFAULT false,
    briefing_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_id UUID NOT NULL REFERENCES public.onboarding(id) ON DELETE CASCADE,
    phase_key TEXT NOT NULL,
    phase_name TEXT NOT NULL,
    phase_order INT NOT NULL DEFAULT 0,
    parallel_group TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'pulado')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phase_id UUID NOT NULL REFERENCES public.onboarding_phases(id) ON DELETE CASCADE,
    task_key TEXT NOT NULL,
    task_name TEXT NOT NULL,
    task_description TEXT,
    is_required BOOLEAN DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'pulado', 'bloqueado')),
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    task_order INT NOT NULL DEFAULT 0,
    depends_on UUID REFERENCES public.onboarding_tasks(id)
);

CREATE TABLE IF NOT EXISTS public.onboarding_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_id UUID NOT NULL REFERENCES public.onboarding(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'phase_started', 'phase_completed', 'task_completed', 'task_unchecked',
        'note_added', 'briefing_sent', 'briefing_completed',
        'whatsapp_created', 'portal_granted', 'meeting_scheduled', 'status_changed'
    )),
    event_data JSONB DEFAULT '{}'::jsonb,
    performed_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_client_id ON public.onboarding(client_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_phases_onboarding_id ON public.onboarding_phases(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_phase_id ON public.onboarding_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_timeline_onboarding_id ON public.onboarding_timeline(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_timeline_created_at ON public.onboarding_timeline(created_at DESC);

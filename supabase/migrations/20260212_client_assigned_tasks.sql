-- Tabela de tarefas atribuídas pela agência ao cliente (sistema inverso)
CREATE TABLE IF NOT EXISTS public.client_assigned_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | done
    priority TEXT DEFAULT 'medium',           -- low | medium | high | critical
    category TEXT,
    due_date TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comentários
COMMENT ON TABLE public.client_assigned_tasks IS 'Tarefas atribuídas pela agência ao cliente para execução';
COMMENT ON COLUMN public.client_assigned_tasks.status IS 'pending = Pendente, in_progress = Em Andamento, done = Concluído';

-- RLS
ALTER TABLE public.client_assigned_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage_assigned_tasks" ON public.client_assigned_tasks
    FOR ALL USING (true) WITH CHECK (true);

-- Permissões
GRANT ALL ON public.client_assigned_tasks TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_client ON public.client_assigned_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_workspace ON public.client_assigned_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assigned_tasks_status ON public.client_assigned_tasks(status);

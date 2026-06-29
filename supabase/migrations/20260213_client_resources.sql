-- Tabela de recursos/links compartilhados com o cliente
CREATE TABLE IF NOT EXISTS public.client_resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'link',  -- gpt_agent | google_sheets | google_docs | notion | figma | canva | trello | slack | whatsapp | drive | link
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.client_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage_client_resources" ON public.client_resources
    FOR ALL USING (true) WITH CHECK (true);

-- Permissões
GRANT ALL ON public.client_resources TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_client_resources_client ON public.client_resources(client_id);
CREATE INDEX IF NOT EXISTS idx_client_resources_workspace ON public.client_resources(workspace_id);

COMMENT ON TABLE public.client_resources IS 'Links e recursos compartilhados pela agência com o cliente (planilhas, agentes IA, etc.)';

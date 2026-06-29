-- Migration: MOTOR DE MÉTRICAS (VERSÃO FINAL & ESTÁVEL)
-- Este script é auto-contido e garante que as funções de segurança existam.

-- 1. Funções de Segurança (Garantir que existam com a assinatura correta)
CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = target_workspace_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.team_members
        WHERE workspace_id = target_workspace_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'owner')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members 
        WHERE workspace_id = target_workspace_id 
        AND user_id = auth.uid()
    ) OR public.is_workspace_admin(target_workspace_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar a tabela se não existir
CREATE TABLE IF NOT EXISTS public.client_smart_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NULL, -- NULL para Master Sheet
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    sheets JSONB NOT NULL DEFAULT '{}',
    active_sheet TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices de Unicidade
DROP INDEX IF EXISTS client_smart_data_unique_client_idx;
CREATE UNIQUE INDEX client_smart_data_unique_client_idx ON public.client_smart_data (client_id) WHERE client_id IS NOT NULL;

DROP INDEX IF EXISTS client_smart_data_unique_master_idx;
CREATE UNIQUE INDEX client_smart_data_unique_master_idx ON public.client_smart_data (workspace_id) WHERE client_id IS NULL;

-- 4. Habilitar RLS
ALTER TABLE public.client_smart_data ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso
DROP POLICY IF EXISTS "Admin access for client_smart_data" ON public.client_smart_data;
CREATE POLICY "Admin access for client_smart_data" 
ON public.client_smart_data
FOR ALL USING (
    public.is_workspace_admin(workspace_id)
);

DROP POLICY IF EXISTS "Member read access for client_smart_data" ON public.client_smart_data;
CREATE POLICY "Member read access for client_smart_data"
ON public.client_smart_data
FOR SELECT USING (
    public.is_workspace_member(workspace_id)
);

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_client_smart_data_updated_at ON public.client_smart_data;
CREATE TRIGGER update_client_smart_data_updated_at
    BEFORE UPDATE ON public.client_smart_data
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

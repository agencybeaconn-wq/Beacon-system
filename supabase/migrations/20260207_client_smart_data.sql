-- Migration: Create Client Smart Data Persistence
-- Table to store processed spreadsheet data per client

CREATE TABLE IF NOT EXISTS public.client_smart_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    sheets JSONB NOT NULL DEFAULT '{}',
    active_sheet TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_smart_data ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies
DROP POLICY IF EXISTS "Admin access for client_smart_data" ON public.client_smart_data;
CREATE POLICY "Admin access for client_smart_data" 
ON public.client_smart_data
FOR ALL USING (
    public.is_workspace_admin(workspace_id)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_client_smart_data_updated_at ON public.client_smart_data;
CREATE TRIGGER update_client_smart_data_updated_at
    BEFORE UPDATE ON public.client_smart_data
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

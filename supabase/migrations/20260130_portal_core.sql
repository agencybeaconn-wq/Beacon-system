-- CLIENT PORTAL CORE MIGRATION
-- Purpose: Enable secure client-specific access and link users to agency_clients

-- 1. EXTEND TEAM MEMBERS
DO $$ 
BEGIN
    -- Add linked_client_id to link a user directly to a specific client/company
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'linked_client_id') THEN
        ALTER TABLE public.team_members ADD COLUMN linked_client_id UUID REFERENCES public.agency_clients(id);
    END IF;

    -- Add user_type to distinguish between internal agency staff and external clients
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'user_type') THEN
        ALTER TABLE public.team_members ADD COLUMN user_type TEXT DEFAULT 'agency';
    END IF;
END $$;

-- 2. SECURITY POLICIES (RLS)
-- We need to ensure clients can only see what belongs to them.

-- Enable RLS on core tables if not already enabled
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_step_status ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy: Client Access
-- Allows users with user_type = 'client' to view/create data only for their linked_client_id
CREATE OR REPLACE POLICY "client_portal_isolation" ON public.demand_requests
    FOR ALL
    USING (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR 
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

CREATE OR REPLACE POLICY "client_portal_tasks_isolation" ON public.client_tasks
    FOR SELECT
    USING (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR 
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

CREATE OR REPLACE POLICY "client_portal_steps_isolation" ON public.client_step_status
    FOR SELECT
    USING (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR 
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

-- 3. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

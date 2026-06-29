-- MASTER HARMONY MIGRATION
-- Purpose: Align database schema with frontend expectations (team_members, demands, tasks)

-- 1. HARMONIZE TEAM MEMBERS
DO $$ 
BEGIN
    -- Rename workspace_members to team_members if workspace_members exists and team_members doesnt
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        ALTER TABLE public.workspace_members RENAME TO team_members;
    END IF;

    -- Ensure team_members has the expected columns
    -- if it was created by another migration as workspace_members
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'status') THEN
            ALTER TABLE public.team_members ADD COLUMN status TEXT DEFAULT 'pending';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'email') THEN
            ALTER TABLE public.team_members ADD COLUMN email TEXT;
            -- Backfill email from auth.users if possible
            UPDATE public.team_members tm
            SET email = u.email
            FROM auth.users u
            WHERE tm.user_id = u.id;
        END IF;
    END IF;
END $$;

-- 2. FIX AGENCY CLIENTS COLUMNS
ALTER TABLE public.agency_clients 
ADD COLUMN IF NOT EXISTS assigned_products UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS selected_ad_accounts TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#7C3AED';

-- 3. CREATE DEMAND REQUESTS (for Client Portal)
CREATE TABLE IF NOT EXISTS public.demand_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    client_id UUID REFERENCES agency_clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    area TEXT,
    client_priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    attachments TEXT[], -- Array of URLs
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for demand_requests
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage workspace demands" ON public.demand_requests;
CREATE POLICY "Users can manage workspace demands" ON public.demand_requests
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM workspaces w
        WHERE w.id = demand_requests.workspace_id
        AND (w.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()))
    )
);

-- 4. CREATE CLIENT TASKS (for Demand Board)
CREATE TABLE IF NOT EXISTS public.client_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES agency_clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    area TEXT,
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    checklist JSONB DEFAULT '[]'::jsonb,
    product_id TEXT,
    product_name TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for client_tasks
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage client tasks" ON public.client_tasks;
CREATE POLICY "Users can manage client tasks" ON public.client_tasks
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM agency_clients ac
        WHERE ac.id = client_tasks.client_id
        AND EXISTS (
             SELECT 1 FROM workspaces w
             WHERE w.id = ac.workspace_id
             AND (w.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()))
        )
    )
);

-- 5. CREATE CLIENT STEP STATUS (for Timeline Persistence)
CREATE TABLE IF NOT EXISTS public.client_step_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES agency_clients(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, step_id)
);

-- RLS for client_step_status
ALTER TABLE public.client_step_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage step status" ON public.client_step_status;
CREATE POLICY "Users can manage step status" ON public.client_step_status
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM agency_clients ac
        WHERE ac.id = client_step_status.client_id
        AND EXISTS (
             SELECT 1 FROM workspaces w
             WHERE w.id = ac.workspace_id
             AND (w.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.workspace_id = w.id AND tm.user_id = auth.uid()))
        )
    )
);

-- 6. ENSURE STORAGE FOR ATTACHMENTS
-- Note: Bucket creation via SQL requires extensions or vault, 
-- but we can at least ensure we recommend it.
-- This part is usually done via UI, but here is the policy if it exists.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT DO NOTHING;

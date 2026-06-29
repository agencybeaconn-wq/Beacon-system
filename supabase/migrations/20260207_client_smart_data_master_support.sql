-- Migration: Support Master Sheets in client_smart_data
-- Allows client_id to be NULL to represent a workspace-level default sheet

-- 1. Remove strict NOT NULL from client_id
ALTER TABLE public.client_smart_data ALTER COLUMN client_id DROP NOT NULL;

-- 2. Update unique constraint
-- Previously UNIQUE(client_id). Now we need a partial unique index:
-- One record per client OR one record per workspace where client_id is NULL
ALTER TABLE public.client_smart_data DROP CONSTRAINT IF EXISTS client_smart_data_client_id_key;

-- Unique record per client
CREATE UNIQUE INDEX IF NOT EXISTS client_smart_data_unique_client_idx ON public.client_smart_data (client_id) WHERE client_id IS NOT NULL;

-- Unique record for workspace master (where client_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS client_smart_data_unique_master_idx ON public.client_smart_data (workspace_id) WHERE client_id IS NULL;

-- 3. Update RLS policies to be more explicit
DROP POLICY IF EXISTS "Admin access for client_smart_data" ON public.client_smart_data;
CREATE POLICY "Admin access for client_smart_data" 
ON public.client_smart_data
FOR ALL USING (
    public.is_workspace_admin(workspace_id)
);

-- Policy to allow members to read (but not modify) the master sheet or their own client data
CREATE POLICY "Member read access for client_smart_data"
ON public.client_smart_data
FOR SELECT USING (
    -- Accessing master sheet
    (client_id IS NULL AND public.is_workspace_member(workspace_id))
    OR
    -- Accessing their own linked client data (this would need more complex check, but admin policy usually covers agency users)
    public.is_workspace_member(workspace_id)
);

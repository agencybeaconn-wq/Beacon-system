-- Add subtasks and assigned_member_id to agency_product_features
ALTER TABLE public.agency_product_features 
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES public.workspace_members(id) ON DELETE SET NULL;

-- Refresh schema cache (optional but helpful if postgrest is used)
NOTIFY pgrst, 'reload schema';

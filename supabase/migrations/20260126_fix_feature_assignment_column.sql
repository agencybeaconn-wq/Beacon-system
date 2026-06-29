-- 1. Add missing column to agency_product_features
-- Linked to team_members(id) which is the table actually used for your team.
ALTER TABLE public.agency_product_features 
ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

-- 2. Ensure subtasks column also exists (just in case)
ALTER TABLE public.agency_product_features 
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Fix: assigned_member_id FK points to workspace_members(id) but app uses team_members(id)
-- The original migration created FK to workspace_members, and the fix migration used
-- ADD COLUMN IF NOT EXISTS which was a no-op since the column already existed.

-- 1. Drop the old FK constraint (pointing to workspace_members)
ALTER TABLE public.agency_product_features
DROP CONSTRAINT IF EXISTS agency_product_features_assigned_member_id_fkey;

-- 2. Clear any orphaned assigned_member_id values that don't exist in team_members
UPDATE public.agency_product_features
SET assigned_member_id = NULL
WHERE assigned_member_id IS NOT NULL
AND assigned_member_id NOT IN (SELECT id FROM public.team_members);

-- 3. Add the correct FK constraint pointing to team_members(id)
ALTER TABLE public.agency_product_features
ADD CONSTRAINT agency_product_features_assigned_member_id_fkey
FOREIGN KEY (assigned_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Fix infinite recursion in workspace_members policy
-- This happens when a policy queries the same table it is protecting.

-- 1. Helper function to bypass RLS recursion 
-- (SECURITY DEFINER runs with creator privileges, bypassing RLS)
CREATE OR REPLACE FUNCTION public.check_is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members 
        WHERE workspace_id = p_workspace_id 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Policy
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;

CREATE POLICY "Users can view members of their workspaces" ON public.workspace_members
FOR SELECT USING (
    -- You can see yourself
    user_id = auth.uid()
    -- OR you are the owner of the workspace (queries workspaces table, no recursion)
    OR EXISTS (
        SELECT 1 FROM public.workspaces 
        WHERE id = workspace_members.workspace_id 
        AND owner_id = auth.uid()
    )
    -- OR you are a member of the workspace (via the SECURITY DEFINER function)
    OR public.check_is_workspace_member(workspace_id)
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

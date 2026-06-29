-- Fix Database constraint to allow deleting users

-- 1. Alter team_members to CASCADE delete when auth user is deleted
ALTER TABLE public.team_members
DROP CONSTRAINT IF EXISTS team_members_user_id_fkey,
ADD CONSTRAINT team_members_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- 2. If 'workspace_members' is used, do the same
ALTER TABLE public.workspace_members
DROP CONSTRAINT IF EXISTS workspace_members_user_id_fkey,
ADD CONSTRAINT workspace_members_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- 3. Ensure 'member_roles' cascades when 'team_members' is deleted
-- (Assuming member_roles links to team_members.id)
ALTER TABLE public.member_roles
DROP CONSTRAINT IF EXISTS member_roles_member_id_fkey,
ADD CONSTRAINT member_roles_member_id_fkey
    FOREIGN KEY (member_id)
    REFERENCES public.team_members(id)
    ON DELETE CASCADE;

-- 4. Ensure 'member_access_levels' cascades too
ALTER TABLE public.member_access_levels
DROP CONSTRAINT IF EXISTS member_access_levels_member_id_fkey,
ADD CONSTRAINT member_access_levels_member_id_fkey
    FOREIGN KEY (member_id)
    REFERENCES public.team_members(id)
    ON DELETE CASCADE;

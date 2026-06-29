-- Allow users to view their own team_members rows based on email
-- This enables the "Global Rescue Mission" in PermissionsContext to work even across workspaces
-- or when the user hasn't fully joined yet.

CREATE POLICY "Users can view their own team_member rows by email" ON public.team_members
FOR SELECT
USING (
  lower(email) = lower(auth.email())
);

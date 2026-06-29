-- Create workspace_members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_members' AND policyname = 'Users can view members of their workspaces') THEN
        CREATE POLICY "Users can view members of their workspaces" ON public.workspace_members
            FOR SELECT USING (
                auth.uid() IN (SELECT user_id FROM public.workspace_members WHERE workspace_id = workspace_members.workspace_id)
                OR auth.uid() IN (SELECT owner_id FROM public.workspaces WHERE id = workspace_members.workspace_id)
            );
    END IF;
END $$;

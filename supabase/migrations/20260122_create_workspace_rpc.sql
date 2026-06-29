-- Create workspaces table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    owner_id uuid NOT NULL REFERENCES auth.users(id),
    plan_type text DEFAULT 'free',
    max_fb_profiles integer DEFAULT 1,
    max_members integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS Policies for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can insert their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can update their own workspaces" ON public.workspaces;

CREATE POLICY "Users can view their own workspaces"
ON public.workspaces FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own workspaces"
ON public.workspaces FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own workspaces"
ON public.workspaces FOR UPDATE
USING (auth.uid() = owner_id);

-- Create RPC function to safely create workspace
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
    p_name text,
    p_owner_id uuid,
    p_plan_type text,
    p_max_fb_profiles integer,
    p_max_members integer
)
RETURNS SETOF public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    -- Check if user already has a workspace (optional enforcement)
    -- IF EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = p_owner_id) THEN
    --    RETURN QUERY SELECT * FROM public.workspaces WHERE owner_id = p_owner_id LIMIT 1;
    -- END IF;

    INSERT INTO public.workspaces (name, owner_id, plan_type, max_fb_profiles, max_members)
    VALUES (p_name, p_owner_id, p_plan_type, p_max_fb_profiles, p_max_members)
    RETURNING id INTO v_workspace_id;

    RETURN QUERY SELECT * FROM public.workspaces WHERE id = v_workspace_id;
END;
$$;

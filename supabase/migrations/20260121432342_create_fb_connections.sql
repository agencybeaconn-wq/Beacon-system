-- Create fb_connections table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.fb_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    instagram_actor_id TEXT,
    name TEXT,
    page_id TEXT,
    status TEXT DEFAULT 'connected',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID
);

-- Enable RLS
ALTER TABLE public.fb_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own fb_connections" ON public.fb_connections;
DROP POLICY IF EXISTS "Users can insert their own fb_connections" ON public.fb_connections;
DROP POLICY IF EXISTS "Users can update their own fb_connections" ON public.fb_connections;
DROP POLICY IF EXISTS "Users can delete their own fb_connections" ON public.fb_connections;
DROP POLICY IF EXISTS "Service role can manage all fb_connections" ON public.fb_connections;

-- Policy for service role (edge functions use service role key)
CREATE POLICY "Service role can manage all fb_connections"
ON public.fb_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy for authenticated users to view their own connections
CREATE POLICY "Users can view their own fb_connections"
ON public.fb_connections
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Policy for authenticated users to insert connections
CREATE POLICY "Users can insert their own fb_connections"
ON public.fb_connections
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Policy for authenticated users to update their own connections
CREATE POLICY "Users can update their own fb_connections"
ON public.fb_connections
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Policy for authenticated users to delete their own connections
CREATE POLICY "Users can delete their own fb_connections"
ON public.fb_connections
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Grant permissions
GRANT ALL ON public.fb_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fb_connections TO authenticated;

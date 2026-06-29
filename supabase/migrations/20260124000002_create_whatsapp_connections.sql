-- Create WhatsApp Connections Table
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected', -- disconnected, connecting, connected, error
    phone_number TEXT,
    api_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, instance_name)
);

-- RLS
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_connections' AND policyname = 'Users can view their own whatsapp connections') THEN
        CREATE POLICY "Users can view their own whatsapp connections" ON public.whatsapp_connections FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_connections' AND policyname = 'Users can insert their own whatsapp connections') THEN
        CREATE POLICY "Users can insert their own whatsapp connections" ON public.whatsapp_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_connections' AND policyname = 'Users can update their own whatsapp connections') THEN
        CREATE POLICY "Users can update their own whatsapp connections" ON public.whatsapp_connections FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_connections' AND policyname = 'Users can delete their own whatsapp connections') THEN
        CREATE POLICY "Users can delete their own whatsapp connections" ON public.whatsapp_connections FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON public.whatsapp_connections;
CREATE TRIGGER update_whatsapp_connections_updated_at
    BEFORE UPDATE ON public.whatsapp_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

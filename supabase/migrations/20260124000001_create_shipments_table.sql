-- Create shipments table
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    sub_status TEXT,
    is_taxed BOOLEAN DEFAULT false,
    needs_attention BOOLEAN DEFAULT false,
    is_atrasado BOOLEAN DEFAULT false,
    last_event_description TEXT,
    last_event_time TIMESTAMPTZ,
    origin_country TEXT,
    destination_country TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Create Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'Users can view their own shipments') THEN
        CREATE POLICY "Users can view their own shipments" ON public.shipments FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'Users can insert their own shipments') THEN
        CREATE POLICY "Users can insert their own shipments" ON public.shipments FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'Users can update their own shipments') THEN
        CREATE POLICY "Users can update their own shipments" ON public.shipments FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipments' AND policyname = 'Users can delete their own shipments') THEN
        CREATE POLICY "Users can delete their own shipments" ON public.shipments FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON public.shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON public.shipments(tracking_number);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_shipments_updated_at ON public.shipments;
CREATE TRIGGER update_shipments_updated_at
    BEFORE UPDATE ON public.shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

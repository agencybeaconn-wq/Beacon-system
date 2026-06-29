-- FINAL SETUP & FIXES
-- Purpose: Fix missing columns, create storage bucket, and refresh schema cache

-- 1. FIX MISSING COLUMNS IN agency_clients
DO $$ 
BEGIN
    -- payment_due_day
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agency_clients' AND column_name = 'payment_due_day') THEN
        ALTER TABLE public.agency_clients ADD COLUMN payment_due_day INTEGER DEFAULT 5;
    END IF;

    -- fee_fixed (fallback check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agency_clients' AND column_name = 'fee_fixed') THEN
        ALTER TABLE public.agency_clients ADD COLUMN fee_fixed NUMERIC DEFAULT 0;
    END IF;

    -- commission_rate (fallback check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agency_clients' AND column_name = 'commission_rate') THEN
        ALTER TABLE public.agency_clients ADD COLUMN commission_rate NUMERIC DEFAULT 0;
    END IF;
    
    -- primary_color (fallback check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agency_clients' AND column_name = 'primary_color') THEN
        ALTER TABLE public.agency_clients ADD COLUMN primary_color TEXT DEFAULT '#7C3AED';
    END IF;
END $$;

-- 2. CREATE STORAGE BUCKET (attachments)
-- Note: Requires storage schema access
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. STORAGE POLICIES (Allow authenticated users to manage attachments)
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'attachments')
WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'attachments');

-- 4. REFRESH SCHEMA CACHE
-- This forces Supabase to realize the columns exist immediately
NOTIFY pgrst, 'reload schema';

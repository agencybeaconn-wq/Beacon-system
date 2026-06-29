-- 🚨 FINAL FIX FOR CRM SCHEMA 🚨
-- This migration fixes two critical issues:
-- 1. Adds 'site_url' column which was missing and causing save errors.
-- 2. Converts 'lead_status' from ENUM to TEXT to allow custom column names.

DO $$ 
BEGIN 
    -- 1. Add site_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='site_url') THEN
        ALTER TABLE public.crm_leads ADD COLUMN site_url TEXT;
    END IF;

    -- 2. Change lead_status to TEXT (Drop Enum constraint)
    -- This uses a safe cast to preserve existing data
    ALTER TABLE public.crm_leads 
    ALTER COLUMN lead_status TYPE TEXT;

    -- 3. Drop the enum type if it exists to prevent future confusion
    DROP TYPE IF EXISTS public.crm_lead_status;

END $$;

SELECT 'Schema CRM corrigido com sucesso!' as status;

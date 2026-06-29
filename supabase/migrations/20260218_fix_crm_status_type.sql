-- Migration to fix lead_status type mismatch
-- Changes crm_lead_status from enum to text to support dynamic column slugs

-- 1. Drop existing policies temporarily if needed (usually not required for type change but safer)
-- 2. Alter column type
ALTER TABLE public.crm_leads 
ALTER COLUMN lead_status TYPE TEXT;

-- 3. Drop the enum type as it's no longer used
DROP TYPE IF EXISTS public.crm_lead_status;

-- 4. Ensure existing data is preserved (Postgres handles ENUM to TEXT automatically)
SELECT 'Migration Lead Status to Text completed' as status;

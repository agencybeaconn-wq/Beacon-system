-- 1. Add missing columns to agency_clients to avoid query failures and fallback issues
ALTER TABLE public.agency_clients ADD COLUMN IF NOT EXISTS profit_gateway_percent NUMERIC DEFAULT 0;
ALTER TABLE public.agency_clients ADD COLUMN IF NOT EXISTS profit_tax_percent NUMERIC DEFAULT 0;
ALTER TABLE public.agency_clients ADD COLUMN IF NOT EXISTS profit_fixed_costs NUMERIC DEFAULT 0;

-- 2. Update RLS policy to allow agency users to see team members in their workspace
-- This lets the dashboard see the linked client's email
DROP POLICY IF EXISTS "Agency users can view all members in workspace" ON public.team_members;
CREATE POLICY "Agency users can view all members in workspace" 
ON public.team_members
FOR SELECT 
TO authenticated 
USING (
  workspace_id IN (
    SELECT workspace_id FROM team_members WHERE user_id = auth.uid()
  )
  OR 
  lower(email) = lower(auth.email())
);

-- 3. Verify columns
COMMENT ON COLUMN agency_clients.profit_gateway_percent IS 'Calculation field for gateway fees';
COMMENT ON COLUMN agency_clients.profit_tax_percent IS 'Calculation field for taxes';
COMMENT ON COLUMN agency_clients.profit_fixed_costs IS 'Calculation field for fixed operational costs';

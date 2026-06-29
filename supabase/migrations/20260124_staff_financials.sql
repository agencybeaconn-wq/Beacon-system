-- Migration: Add Staff Financial Fields and Commissions
-- Run this in Supabase SQL Editor

-- 1. Alter team_members to add base_salary and default commission
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS base_salary NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 0; -- Default %

-- 2. Create member_commissions table for client-specific rates
CREATE TABLE IF NOT EXISTS public.member_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- Specific % for this client
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id, client_id)
);

-- Enable RLS
ALTER TABLE public.member_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_commissions
DROP POLICY IF EXISTS "Workspace owners and admins can manage commissions" ON public.member_commissions;
CREATE POLICY "Workspace owners and admins can manage commissions"
ON public.member_commissions
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.team_members tm_member
        JOIN public.workspaces w ON w.id = tm_member.workspace_id
        WHERE tm_member.id = member_commissions.member_id
        AND (
            w.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.team_members tm_admin
                WHERE tm_admin.workspace_id = w.id
                AND tm_admin.user_id = auth.uid()
                AND tm_admin.role = 'admin'
            )
        )
    )
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_member_commissions_updated_at ON public.member_commissions;
CREATE TRIGGER update_member_commissions_updated_at
    BEFORE UPDATE ON public.member_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

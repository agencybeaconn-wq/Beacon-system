-- Migration: Create Financial Tables and Link Clients to Workspaces
-- Run this in Supabase SQL Editor

-- 0. Ensure agency_clients has workspace_id and is linked
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agency_clients' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.agency_clients ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
        
        -- Backfill workspace_id from user_id if possible
        -- (Assuming user_id in agency_clients is the owner of the workspace)
        UPDATE public.agency_clients ac
        SET workspace_id = w.id
        FROM public.workspaces w
        WHERE w.owner_id = ac.user_id
        AND ac.workspace_id IS NULL;
    END IF;
END $$;

-- 1. Table for Agency Expenses (Fixed Costs)
-- Create agency_expenses table
CREATE TABLE IF NOT EXISTS public.agency_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL CHECK (category IN ('staff', 'tool', 'other')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
    due_date DATE NOT NULL,
    payment_date DATE,
    recurrence_type TEXT NOT NULL DEFAULT 'variable' CHECK (recurrence_type IN ('fixed', 'variable')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create client_invoices (faturas virtuais) table
CREATE TABLE IF NOT EXISTS public.client_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
    due_date DATE NOT NULL,
    payment_date DATE,
    month_reference TEXT NOT NULL, -- Format YYYY-MM
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, month_reference)
);

-- Enable RLS
ALTER TABLE public.agency_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies
-- For agency_expenses: access if user is owner of the workspace OR an admin member
DROP POLICY IF EXISTS "Workspace owners and admins can manage expenses" ON public.agency_expenses;
CREATE POLICY "Workspace owners and admins can manage expenses"
ON public.agency_expenses
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE workspaces.id = agency_expenses.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = agency_expenses.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'admin'
    )
);

-- For client_invoices: access if client belongs to a workspace owned by user OR user is admin
DROP POLICY IF EXISTS "Workspace owners and admins can manage client invoices" ON public.client_invoices;
CREATE POLICY "Workspace owners and admins can manage client invoices"
ON public.client_invoices
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.agency_clients ac
        WHERE ac.id = client_invoices.client_id
        AND (
            EXISTS (
                SELECT 1 FROM public.workspaces w
                WHERE w.id = ac.workspace_id
                AND w.owner_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM public.team_members tm
                WHERE tm.workspace_id = ac.workspace_id
                AND tm.user_id = auth.uid()
                AND tm.role = 'admin'
            )
        )
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_agency_expenses_updated_at ON public.agency_expenses;
CREATE TRIGGER update_agency_expenses_updated_at
    BEFORE UPDATE ON public.agency_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_invoices_updated_at ON public.client_invoices;
CREATE TRIGGER update_client_invoices_updated_at
    BEFORE UPDATE ON public.client_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

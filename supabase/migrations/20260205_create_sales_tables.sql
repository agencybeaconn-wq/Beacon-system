-- Migration: Create Sales Records and Goals Tables
-- Run this in Supabase SQL Editor

-- 1. Table for Sales Records (Entradas/Vendas Avulsas)
CREATE TABLE IF NOT EXISTS public.sales_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    service TEXT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('pix', 'cartao', 'boleto', 'transferencia', 'dinheiro', 'outro')),
    entry_type TEXT CHECK (entry_type IN ('percentage', 'fixed')) DEFAULT 'fixed',
    entry_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    balance_due_date DATE,
    status TEXT NOT NULL CHECK (status IN ('pendente', 'parcial', 'pago')) DEFAULT 'pendente',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for Monthly Sales Goals
CREATE TABLE IF NOT EXISTS public.sales_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month_reference TEXT NOT NULL, -- Format YYYY-MM
    goal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, month_reference)
);

-- Enable RLS
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_records
DROP POLICY IF EXISTS "Workspace owners and admins can manage sales_records" ON public.sales_records;
CREATE POLICY "Workspace owners and admins can manage sales_records"
ON public.sales_records
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE workspaces.id = sales_records.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = sales_records.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
);

-- RLS Policies for sales_goals
DROP POLICY IF EXISTS "Workspace owners and admins can manage sales_goals" ON public.sales_goals;
CREATE POLICY "Workspace owners and admins can manage sales_goals"
ON public.sales_goals
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE workspaces.id = sales_goals.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = sales_goals.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_sales_records_updated_at ON public.sales_records;
CREATE TRIGGER update_sales_records_updated_at
    BEFORE UPDATE ON public.sales_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_goals_updated_at ON public.sales_goals;
CREATE TRIGGER update_sales_goals_updated_at
    BEFORE UPDATE ON public.sales_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration: Criar tabelas financeiras da Lever Academy
-- Dados 100% manuais, sem dependência de clientes/staff da agência

-- 1. Receitas manuais da Academy
CREATE TABLE IF NOT EXISTS public.academy_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    client_name TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('pix', 'cartao', 'boleto', 'transferencia', 'dinheiro', 'outro')),
    due_date DATE NOT NULL,
    payment_date DATE,
    status TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
    category TEXT CHECK (category IN ('curso', 'mentoria', 'material', 'outro')) DEFAULT 'curso',
    month_reference TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Despesas manuais da Academy
CREATE TABLE IF NOT EXISTS public.academy_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    category TEXT CHECK (category IN ('plataforma', 'marketing', 'professor', 'material', 'infraestrutura', 'outro')) DEFAULT 'outro',
    recurrence_type TEXT CHECK (recurrence_type IN ('fixed', 'variable')) DEFAULT 'variable',
    due_date DATE NOT NULL,
    payment_date DATE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
    month_reference TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Metas mensais da Academy
CREATE TABLE IF NOT EXISTS public.academy_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month_reference TEXT NOT NULL,
    goal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, month_reference)
);

-- Enable RLS
ALTER TABLE public.academy_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_goals ENABLE ROW LEVEL SECURITY;

-- RLS: academy_revenue
DROP POLICY IF EXISTS "Workspace owners and admins can manage academy_revenue" ON public.academy_revenue;
CREATE POLICY "Workspace owners and admins can manage academy_revenue"
ON public.academy_revenue
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE workspaces.id = academy_revenue.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = academy_revenue.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
);

-- RLS: academy_expenses
DROP POLICY IF EXISTS "Workspace owners and admins can manage academy_expenses" ON public.academy_expenses;
CREATE POLICY "Workspace owners and admins can manage academy_expenses"
ON public.academy_expenses
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE workspaces.id = academy_expenses.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = academy_expenses.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
);

-- RLS: academy_goals
DROP POLICY IF EXISTS "Workspace owners and admins can manage academy_goals" ON public.academy_goals;
CREATE POLICY "Workspace owners and admins can manage academy_goals"
ON public.academy_goals
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE workspaces.id = academy_goals.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_members.workspace_id = academy_goals.workspace_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('admin', 'owner')
    )
);

-- Triggers updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_academy_revenue_updated_at ON public.academy_revenue;
CREATE TRIGGER update_academy_revenue_updated_at
    BEFORE UPDATE ON public.academy_revenue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_academy_expenses_updated_at ON public.academy_expenses;
CREATE TRIGGER update_academy_expenses_updated_at
    BEFORE UPDATE ON public.academy_expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_academy_goals_updated_at ON public.academy_goals;
CREATE TRIGGER update_academy_goals_updated_at
    BEFORE UPDATE ON public.academy_goals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

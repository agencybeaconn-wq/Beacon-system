-- 🚨 CONSOLIDATED FIXES: CRM & FINANCIAL 🚨
-- This script ensures all tables and columns needed for the latest updates are present.

-- 1. CRM DYNAMIC COLUMNS
CREATE TABLE IF NOT EXISTS public.crm_kanban_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.crm_kanban_columns ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Workspace isolation for crm_kanban_columns') THEN
        CREATE POLICY "Workspace isolation for crm_kanban_columns" 
        ON public.crm_kanban_columns FOR ALL 
        USING (workspace_id IN (SELECT id FROM public.workspaces));
    END IF;
END $$;

-- Seed default columns for existing workspaces
INSERT INTO public.crm_kanban_columns (workspace_id, title, color, order_index)
SELECT w.id, t.title, t.color, t.idx
FROM public.workspaces w
CROSS JOIN (
    VALUES 
        ('Contato', 'bg-blue-500/20 border-blue-500/30 text-blue-400', 0),
        ('Envio de Resposta', 'bg-amber-500/20 border-amber-500/30 text-amber-400', 1),
        ('Follow Up', 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400', 2),
        ('Fechamento', 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400', 3)
) AS t(title, color, idx)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_kanban_columns WHERE workspace_id = w.id);


-- 2. PARTNERS PRO-LABORE
CREATE TABLE IF NOT EXISTS public.partners_prolabore (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_day INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active', -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.partners_prolabore ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Workspace isolation for partners_prolabore') THEN
        CREATE POLICY "Workspace isolation for partners_prolabore" 
        ON public.partners_prolabore FOR ALL 
        USING (workspace_id IN (SELECT id FROM public.workspaces));
    END IF;
END $$;


-- 3. TEAM MEMBERS MISSING COLUMNS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='is_accounting_staff') THEN
        ALTER TABLE public.team_members ADD COLUMN is_accounting_staff BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='base_salary') THEN
        ALTER TABLE public.team_members ADD COLUMN base_salary DECIMAL(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='commission_rate') THEN
        ALTER TABLE public.team_members ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;

SELECT 'Migração consolidada aplicada com sucesso!' as status;

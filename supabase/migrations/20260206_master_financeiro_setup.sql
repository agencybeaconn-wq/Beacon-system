-- MASTER FINANCIAL DATABASE SETUP - REVISADO
-- Módulo: Financeiro & Vendas
-- Objetivo: Criar todas as tabelas, constraints e políticas de segurança (RLS) necessárias.
-- Instruções: Copie e cole este script no SQL Editor do Supabase.

-- ==========================================
-- 0. FUNÇÕES AUXILIARES DE INFRAESTRUTURA
-- ==========================================

-- Trigger para updated_at (caso não exista)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se é Admin ou Owner do Workspace
CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = target_workspace_id AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.team_members
        WHERE workspace_id = target_workspace_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'owner')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 1. TABELAS DE VENDAS E METAS
-- ==========================================

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

CREATE TABLE IF NOT EXISTS public.sales_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month_reference TEXT NOT NULL, -- Formato YYYY-MM
    goal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, month_reference)
);

-- ==========================================
-- 2. TABELAS DE CUSTOS E DESPESAS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.agency_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    category TEXT CHECK (category IN ('staff', 'tool', 'other')) DEFAULT 'other',
    status TEXT CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
    due_date DATE NOT NULL,
    payment_date DATE,
    recurrence_type TEXT CHECK (recurrence_type IN ('fixed', 'variable')) DEFAULT 'variable',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.variable_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    category TEXT,
    related_transaction_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_sku TEXT NOT NULL,
    cost_per_unit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. TABELAS DE RECEITAS E FATURAS (AGÊNCIA)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.client_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
    due_date DATE NOT NULL,
    payment_date DATE,
    month_reference TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 4. TRANSAÇÕES E MARKETING (PERFORMANCE)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    type TEXT CHECK (type IN ('income', 'refund', 'chargeback')),
    status TEXT CHECK (status IN ('pending', 'paid', 'failed')),
    source TEXT NOT NULL,
    external_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_spend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    platform TEXT CHECK (platform IN ('meta_ads', 'google_ads', 'tiktok_ads', 'other')),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    campaign_name TEXT,
    campaign_id TEXT,
    impressions INTEGER,
    clicks INTEGER,
    conversions INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 5. COMISSÕES E STAFF
-- ==========================================

CREATE TABLE IF NOT EXISTS public.member_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id, client_id)
);

-- Ajuste de Colunas e Tipos Faltantes
DO $$ 
BEGIN 
    -- agency_clients: lucro e taxas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agency_clients' AND column_name='profit_gateway_percent') THEN
        ALTER TABLE public.agency_clients ADD COLUMN profit_gateway_percent NUMERIC(5, 2) DEFAULT 3;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agency_clients' AND column_name='profit_tax_percent') THEN
        ALTER TABLE public.agency_clients ADD COLUMN profit_tax_percent NUMERIC(5, 2) DEFAULT 10;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agency_clients' AND column_name='profit_fixed_costs') THEN
        ALTER TABLE public.agency_clients ADD COLUMN profit_fixed_costs NUMERIC(15, 2) DEFAULT 0;
    END IF;

    -- team_members: financeiro de colaboradores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='base_salary') THEN
        ALTER TABLE public.team_members ADD COLUMN base_salary NUMERIC(15, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='commission_rate') THEN
        ALTER TABLE public.team_members ADD COLUMN commission_rate NUMERIC(5, 2) DEFAULT 0;
    END IF;
END $$;

-- ==========================================
-- 6. POLÍTICAS DE SEGURANÇA (RLS)
-- ==========================================

-- Habilitar RLS em todas as tabelas
DO $$ 
DECLARE
    tbl TEXT;
BEGIN 
    FOR tbl IN SELECT unnest(ARRAY['sales_records', 'sales_goals', 'agency_expenses', 'variable_costs', 'product_costs', 'client_invoices', 'financial_transactions', 'marketing_spend', 'member_commissions']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

-- Aplicar políticas simplificadas para tabelas com workspace_id direto
DO $$ 
DECLARE
    tbl TEXT;
BEGIN 
    FOR tbl IN SELECT unnest(ARRAY['sales_records', 'sales_goals', 'agency_expenses', 'variable_costs', 'product_costs', 'financial_transactions', 'marketing_spend']) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin access for %I" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "Admin access for %I" ON public.%I FOR ALL USING (public.is_workspace_admin(workspace_id))', tbl, tbl);
    END LOOP;
END $$;

-- Políticas especiais (acesso via relação)
DROP POLICY IF EXISTS "Admin access for client_invoices" ON public.client_invoices;
CREATE POLICY "Admin access for client_invoices" ON public.client_invoices 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.agency_clients 
        WHERE agency_clients.id = client_invoices.client_id 
        AND public.is_workspace_admin(agency_clients.workspace_id)
    )
);

DROP POLICY IF EXISTS "Admin access for member_commissions" ON public.member_commissions;
CREATE POLICY "Admin access for member_commissions" ON public.member_commissions 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.team_members 
        WHERE team_members.id = member_commissions.member_id 
        AND public.is_workspace_admin(team_members.workspace_id)
    )
);

-- ==========================================
-- 7. MIGRAÇÃO DE DADOS (CONSOLIDAÇÃO)
-- ==========================================

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fixed_costs') THEN
        -- Movemos o que é fixo e ativo para agency_expenses se ainda não existir
        INSERT INTO public.agency_expenses (workspace_id, description, amount, category, status, due_date, recurrence_type, created_at)
        SELECT 
            fc.workspace_id, fc.name, fc.amount, 'other', 'paid', CURRENT_DATE, 'fixed', fc.created_at
        FROM public.fixed_costs fc
        WHERE fc.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM public.agency_expenses ae 
            WHERE ae.description = fc.name AND ae.workspace_id = fc.workspace_id
        );
    END IF;
END $$;

-- ==========================================
-- 8. TRIGGERS DE AUTOMAÇÃO
-- ==========================================

-- Trigger de data de atualização (updated_at)
DO $$ 
DECLARE
    tbl TEXT;
BEGIN 
    FOR tbl IN SELECT unnest(ARRAY['sales_records', 'sales_goals', 'agency_expenses', 'client_invoices', 'member_commissions']) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', tbl, tbl);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl, tbl);
    END LOOP;
END $$;

-- Automação: Marcar faturas como overdue
CREATE OR REPLACE FUNCTION public.check_overdue_invoices()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.client_invoices
    SET status = 'overdue'
    WHERE status = 'pending' AND due_date < CURRENT_DATE;
    RETURN NULL; -- AFTER trigger pode retornar NULL
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_overdue_on_invoice_change ON public.client_invoices;
CREATE TRIGGER tr_check_overdue_on_invoice_change
AFTER INSERT OR UPDATE ON public.client_invoices
FOR EACH STATEMENT EXECUTE FUNCTION public.check_overdue_invoices();

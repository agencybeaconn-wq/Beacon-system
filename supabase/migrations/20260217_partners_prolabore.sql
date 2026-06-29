-- 🚀 TABELA DE PRO-LABORE DE SÓCIOS 🚀
-- Objetivo: Gerenciar retiradas fixas de sócios separadamente de funcionários.

CREATE TABLE IF NOT EXISTS public.partners_prolabore (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_day INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active', -- active, inactive
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.partners_prolabore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace isolation for partners_prolabore" 
ON public.partners_prolabore FOR ALL 
USING (workspace_id IN (SELECT id FROM public.workspaces));

-- Inserir alguns exemplos se necessário (opcional)
-- INSERT INTO public.partners_prolabore (workspace_id, name, amount) 
-- VALUES ('id_do_workspace', 'Sócio Fundador', 5000.00);

SELECT 'Tabela partners_prolabore criada com sucesso!' as status;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Products visibility — workspace-based access instead of user_id
-- ═══════════════════════════════════════════════════════════════════════════
-- PROBLEMA: Cada usuário só vê os produtos que ele mesmo criou (RLS por user_id).
-- SOLUÇÃO: Adicionar workspace_id e mudar RLS para que todos os membros
--          do workspace vejam os mesmos produtos.

-- 1. ADICIONAR COLUNA workspace_id (se não existir)
ALTER TABLE public.agency_products
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- 2. POPULAR workspace_id PARA PRODUTOS DO OWNER
UPDATE public.agency_products ap
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.owner_id = ap.user_id
  AND ap.workspace_id IS NULL;

-- 3. DELETAR PRODUTOS DUPLICADOS (criados por quem NÃO é owner de nenhum workspace)
-- Isso remove automaticamente os produtos do Matheus sem precisar do UUID dele
DELETE FROM public.agency_product_features
WHERE product_id IN (
    SELECT ap.id FROM public.agency_products ap
    WHERE ap.workspace_id IS NULL
);

DELETE FROM public.agency_products
WHERE workspace_id IS NULL;

-- 4. AGORA SIM: TORNAR workspace_id NOT NULL (todos os restantes já têm valor)
ALTER TABLE public.agency_products
ALTER COLUMN workspace_id SET NOT NULL;

-- 5. RESETAR RLS
ALTER TABLE public.agency_products DISABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas (nomes comuns)
DROP POLICY IF EXISTS "Users can manage own products" ON public.agency_products;
DROP POLICY IF EXISTS "users_manage_own_products" ON public.agency_products;
DROP POLICY IF EXISTS "agency_products_select" ON public.agency_products;
DROP POLICY IF EXISTS "agency_products_insert" ON public.agency_products;
DROP POLICY IF EXISTS "agency_products_update" ON public.agency_products;
DROP POLICY IF EXISTS "agency_products_delete" ON public.agency_products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agency_products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.agency_products;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.agency_products;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.agency_products;

-- 6. CRIAR NOVAS POLÍTICAS BASEADAS EM WORKSPACE
-- SELECT: Qualquer membro do workspace pode ver os produtos
CREATE POLICY "workspace_members_view_products" ON public.agency_products
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = agency_products.workspace_id
        AND tm.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = agency_products.workspace_id
        AND w.owner_id = auth.uid()
    )
);

-- INSERT: Apenas admins e owners do workspace
CREATE POLICY "workspace_admins_create_products" ON public.agency_products
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = agency_products.workspace_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = agency_products.workspace_id
        AND w.owner_id = auth.uid()
    )
);

-- UPDATE: Apenas admins e owners do workspace
CREATE POLICY "workspace_admins_update_products" ON public.agency_products
FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = agency_products.workspace_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = agency_products.workspace_id
        AND w.owner_id = auth.uid()
    )
);

-- DELETE: Apenas admins e owners do workspace
CREATE POLICY "workspace_admins_delete_products" ON public.agency_products
FOR DELETE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.workspace_id = agency_products.workspace_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = agency_products.workspace_id
        AND w.owner_id = auth.uid()
    )
);

ALTER TABLE public.agency_products ENABLE ROW LEVEL SECURITY;

-- 7. MESMA CORREÇÃO PARA agency_product_features
ALTER TABLE public.agency_product_features DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own features" ON public.agency_product_features;
DROP POLICY IF EXISTS "users_manage_own_features" ON public.agency_product_features;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agency_product_features;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.agency_product_features;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.agency_product_features;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.agency_product_features;

-- Features herdam o acesso do produto pai
CREATE POLICY "workspace_members_view_features" ON public.agency_product_features
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.agency_products ap
        JOIN public.workspaces w ON w.id = ap.workspace_id
        LEFT JOIN public.team_members tm ON tm.workspace_id = ap.workspace_id AND tm.user_id = auth.uid()
        WHERE ap.id = agency_product_features.product_id
        AND (tm.user_id IS NOT NULL OR w.owner_id = auth.uid())
    )
);

CREATE POLICY "workspace_admins_manage_features" ON public.agency_product_features
FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.agency_products ap
        JOIN public.workspaces w ON w.id = ap.workspace_id
        LEFT JOIN public.team_members tm ON tm.workspace_id = ap.workspace_id AND tm.user_id = auth.uid()
        WHERE ap.id = agency_product_features.product_id
        AND (
            w.owner_id = auth.uid()
            OR (tm.user_id IS NOT NULL AND tm.role = 'admin')
        )
    )
);

ALTER TABLE public.agency_product_features ENABLE ROW LEVEL SECURITY;

-- 8. FORÇAR ATUALIZAÇÃO DO SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

SELECT 'Products visibility fix applied!' as status;

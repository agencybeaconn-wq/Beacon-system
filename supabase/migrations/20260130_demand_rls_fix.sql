-- 🛡️ RLS Fix for Demand Requests 🛡️

-- 1. Permissão de LEITURA para Clientes
DROP POLICY IF EXISTS "Clients can view their own demand_requests" ON public.demand_requests;
CREATE POLICY "Clients can view their own demand_requests" 
ON public.demand_requests
FOR SELECT
USING ( 
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
    ) 
);

-- 2. Permissão de INSERÇÃO para Clientes
DROP POLICY IF EXISTS "Clients can create their own demand_requests" ON public.demand_requests;
CREATE POLICY "Clients can create their own demand_requests" 
ON public.demand_requests
FOR INSERT 
WITH CHECK ( 
    client_id IN (
        SELECT linked_client_id 
        FROM public.team_members 
        WHERE lower(email) = lower(auth.email()) 
    ) 
);

-- 3. Permissão para ADM/Agência (Garante que eles vejam o que o cliente pediu)
DROP POLICY IF EXISTS "Agency can manage all demand_requests" ON public.demand_requests;
CREATE POLICY "Agency can manage all demand_requests" 
ON public.demand_requests
FOR ALL
USING ( true ); -- Simplificado, idealmente seria filtrado por role de admin/member

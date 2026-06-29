-- 🚨 MASTER RESET: Resolva TUDO em um comando 🚨

-- 1. LIMPAR POLÍTICAS ANTIGAS (Garante que não haja conflitos)
DROP POLICY IF EXISTS "Users can view their own team_member rows by email" ON public.team_members;

-- 2. CRIAR POLÍTICA DE LEITURA GLOBAL (Essencial para o portal)
-- Permite que o usuário veja seu próprio registro mesmo fora do workspace principal
CREATE POLICY "Users can view their own team_member rows by email" 
ON public.team_members
FOR SELECT
USING ( lower(email) = lower(auth.email()) );

-- 3. FORÇAR VÍNCULO DE DADOS (Usa LIKE para ignorar espaços ou erros de digitação)
UPDATE public.team_members
SET 
  linked_client_id = (SELECT id FROM public.agency_clients WHERE name ILIKE '%Julico%' LIMIT 1),
  user_type = 'client', 
  role = 'member'
WHERE email ILIKE '%julicosportss%';

-- 4. VERIFICAÇÃO FINAL (O resultado deve mostrar o Client ID vinculado)
SELECT email, linked_client_id, user_type, workspace_id
FROM public.team_members 
WHERE email ILIKE '%julicosportss%';

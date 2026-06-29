-- Corrige a restrição de chave estrangeira que impede a exclusão de clientes
-- quando existem membros da equipe (team_members) vinculados a eles.

-- 1. Remove a restrição atual (que por padrão é NO ACTION / RESTRICT)
ALTER TABLE public.team_members 
DROP CONSTRAINT IF EXISTS team_members_linked_client_id_fkey;

-- 2. Readiciona a restrição com ON DELETE SET NULL
-- Isso garante que, se o cliente for excluído, o campo linked_client_id no membro da equipe vire NULL
-- em vez de impedir a exclusão do cliente.
ALTER TABLE public.team_members
ADD CONSTRAINT team_members_linked_client_id_fkey 
FOREIGN KEY (linked_client_id) 
REFERENCES public.agency_clients(id) 
ON DELETE SET NULL;

COMMENT ON CONSTRAINT team_members_linked_client_id_fkey ON public.team_members IS 'Permite excluir o cliente desvinculando os membros da equipe em vez de bloquear a exclusão.';

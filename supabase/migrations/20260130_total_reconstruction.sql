-- 🚨 RECONSTRUÇÃO TOTAL: Use isto se o UPDATE continuar dando 0 rows 🚨

-- 1. Remover qualquer vestígio do usuário (para limpar conflitos de ID/Espaços)
DELETE FROM public.team_members 
WHERE email ILIKE '%julicosportss%';

-- 2. Inserir do zero com os dados corretos
-- Nota: Substituímos o ID do workspace pelo ID padrão ou o ID que você usa.
-- Vou usar uma subquery para achar o ID do cliente Julico Sports automaticamente.

INSERT INTO public.team_members (workspace_id, email, role, status, linked_client_id, user_type)
VALUES (
  (SELECT id FROM public.workspaces LIMIT 1), -- Pega o primeiro workspace
  'julicosportss@gmail.com',
  'member',
  'active',
  (SELECT id FROM public.agency_clients WHERE name ILIKE '%Julico%' LIMIT 1),
  'client'
);

-- 3. Validar se agora ele aparece
SELECT * FROM public.team_members WHERE email = 'julicosportss@gmail.com';

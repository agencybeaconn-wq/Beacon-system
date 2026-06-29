-- DATA REPAIR v2: Universal Link for Julico Sports
-- This version is more case-insensitive and handles potential name variations.

UPDATE public.team_members
SET 
  linked_client_id = (
      SELECT id 
      FROM public.agency_clients 
      WHERE name ILIKE '%Julico%' 
      LIMIT 1
  ),
  user_type = 'client',
  role = 'member'
WHERE 
  lower(email) = 'julicosportss@gmail.com';

-- IMPORTANT: Also ensure the workspace_id matches if needed, 
-- but usually the linked_client_id is enough for the portal shield.

-- Check results
SELECT email, linked_client_id, user_type, status 
FROM public.team_members 
WHERE lower(email) = 'julicosportss@gmail.com';

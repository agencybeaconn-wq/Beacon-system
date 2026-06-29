-- DATA REPAIR: Link the user 'julicosportss' to their client 'Julico Sports'
-- This fixes the "No responsible linked" issue and enables the Portal to work.

UPDATE public.team_members
SET 
  linked_client_id = (
      SELECT id 
      FROM public.agency_clients 
      WHERE name ILIKE '%Julico Sports%' 
      LIMIT 1
  ),
  user_type = 'client',  -- Ensure strictly marked as client
  role = 'member'        -- Reset role to standard
WHERE 
  email ILIKE 'julicosportss@gmail.com';

-- Verify the update
SELECT email, linked_client_id, user_type 
FROM public.team_members 
WHERE email ILIKE 'julicosportss@gmail.com';

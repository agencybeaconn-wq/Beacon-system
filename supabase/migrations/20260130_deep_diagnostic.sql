-- 1. DIAGNOSTIC: See what we actually have in the database
-- Run this first to see the REAL emails and IDs
SELECT id, email, linked_client_id, user_type, workspace_id 
FROM public.team_members 
WHERE lower(email) LIKE '%julico%';

-- 2. LIST CLIENTS: See the exact ID of Julico Sports
SELECT id, name FROM public.agency_clients WHERE name ILIKE '%Julico%';

-- 3. FORCED RECOVERY (Run ONLY if you found the email above)
-- Replace [EMAIL_REAL] with the email found in Step 1
-- Replace [CLIENT_ID_REAL] with the ID found in Step 2

/*
UPDATE public.team_members
SET 
  linked_client_id = '[CLIENT_ID_REAL]',
  user_type = 'client',
  role = 'member'
WHERE lower(email) = lower('[EMAIL_REAL]');
*/

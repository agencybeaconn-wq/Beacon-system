-- Add project_deadline and project_name to agency_clients
ALTER TABLE public.agency_clients
ADD COLUMN IF NOT EXISTS project_deadline TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.agency_clients
ADD COLUMN IF NOT EXISTS project_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.agency_clients.project_deadline IS 'Deadline for project completion - used in timeline and progress bars';
COMMENT ON COLUMN public.agency_clients.project_name IS 'Custom project name displayed in active projects view';

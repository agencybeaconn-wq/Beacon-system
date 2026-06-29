-- Add whatsapp_notifications toggle to team_members
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS whatsapp_notifications BOOLEAN DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN public.team_members.whatsapp_notifications IS 'When enabled, member receives WhatsApp notifications for task assignments';

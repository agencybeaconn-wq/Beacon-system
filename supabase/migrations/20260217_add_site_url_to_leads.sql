-- 🚀 ADICIONAR COLUNA SITE_URL PARA LEADS DO CRM 🚀
-- Objetivo: Permitir o armazenamento de links de sites dos clientes no CRM.

ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS site_url TEXT;

-- Forçar atualização do schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Coluna site_url adicionada com sucesso!' as status;

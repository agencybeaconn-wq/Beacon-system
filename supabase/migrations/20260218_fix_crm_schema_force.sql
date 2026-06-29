-- 🚨 FIX DEFINITIVO (FORCE) 🚨
-- O erro anterior aconteceu porque o "valor padrão" da coluna ainda estava ligado ao tipo antigo.
-- Este script remove essa ligação antes de fazer a mudança.

BEGIN;

    -- 1. Cria a coluna site_url se não existir
    DO $$ 
    BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='site_url') THEN
            ALTER TABLE public.crm_leads ADD COLUMN site_url TEXT;
        END IF;
    END $$;

    -- 2. REMOVE O VALOR PADRÃO (Isso quebra o vínculo com o ENUM antigo)
    ALTER TABLE public.crm_leads ALTER COLUMN lead_status DROP DEFAULT;

    -- 3. Converte a coluna para TEXT
    ALTER TABLE public.crm_leads ALTER COLUMN lead_status TYPE TEXT;

    -- 4. Remove o tipo antigo com força (CASCADE para garantir)
    DROP TYPE IF EXISTS public.crm_lead_status CASCADE;

    -- 5. Define um novo padrão (agora como texto simples)
    ALTER TABLE public.crm_leads ALTER COLUMN lead_status SET DEFAULT 'contato';

COMMIT;

SELECT 'Banco de dados corrigido com sucesso!' as status;

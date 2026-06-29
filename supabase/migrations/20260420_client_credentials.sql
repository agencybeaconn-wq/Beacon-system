-- Client Credentials — armazena logins/senhas de clientes (Gmail, Drive, Instagram, etc)
-- com criptografia AES via pgcrypto + chave no Supabase Vault.
--
-- Padrões:
--   - Senhas armazenadas como BYTEA (encriptado)
--   - Username/label/notes em TEXT (não-sensíveis)
--   - RLS hierárquica: agency vê tudo, client vê só os seus
--   - SECURITY DEFINER functions encapsulam encrypt/decrypt (chave nunca exposta)

-- ─── Extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Vault é instalado por default em projetos Supabase modernos.
-- Se não estiver, descomente:
-- CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ─── Vault secret pra chave AES ─────────────────────────────────────────
-- Cria a secret apenas se ainda não existir (idempotente).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM vault.secrets WHERE name = 'client_credentials_aes_key'
    ) THEN
        PERFORM vault.create_secret(
            encode(gen_random_bytes(32), 'hex'),
            'client_credentials_aes_key',
            'AES-256 key for encrypting client_credentials.password_encrypted'
        );
    END IF;
END $$;

-- ─── Tabela ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    label TEXT NOT NULL,                 -- "Gmail Pessoal", "Instagram da loja", etc
    category TEXT DEFAULT 'other',       -- 'email', 'social', 'admin', 'analytics', 'other'
    username TEXT,                       -- email ou login
    password_encrypted BYTEA,            -- pgp_sym_encrypt('senha', vault_key)
    url TEXT,                            -- URL do serviço (opcional)
    notes TEXT,                          -- notas não-sensíveis
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_credentials_client_id
    ON public.client_credentials(client_id);

CREATE INDEX IF NOT EXISTS idx_client_credentials_category
    ON public.client_credentials(client_id, category);

-- Trigger pra updated_at
CREATE OR REPLACE FUNCTION public.client_credentials_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_credentials_updated_at ON public.client_credentials;
CREATE TRIGGER trg_client_credentials_updated_at
    BEFORE UPDATE ON public.client_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.client_credentials_set_updated_at();

-- ─── RLS — hierarquia agency/client igual padrão portal_core ───────────
ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_credentials_select" ON public.client_credentials;
CREATE POLICY "client_credentials_select" ON public.client_credentials
    FOR SELECT USING (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

DROP POLICY IF EXISTS "client_credentials_insert" ON public.client_credentials;
CREATE POLICY "client_credentials_insert" ON public.client_credentials
    FOR INSERT WITH CHECK (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

DROP POLICY IF EXISTS "client_credentials_update" ON public.client_credentials;
CREATE POLICY "client_credentials_update" ON public.client_credentials
    FOR UPDATE USING (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

DROP POLICY IF EXISTS "client_credentials_delete" ON public.client_credentials;
CREATE POLICY "client_credentials_delete" ON public.client_credentials
    FOR DELETE USING (
        (SELECT user_type FROM public.team_members WHERE user_id = auth.uid() LIMIT 1) = 'agency'
        OR
        client_id = (SELECT linked_client_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1)
    );

-- ─── Helper functions: encrypt/decrypt (SECURITY DEFINER) ──────────────
-- Encapsulam o acesso ao Vault. Chamadores nunca tocam na chave diretamente.

-- Encripta uma senha pra inserir/atualizar em client_credentials.password_encrypted
CREATE OR REPLACE FUNCTION public.encrypt_client_credential(plain TEXT)
RETURNS BYTEA AS $$
DECLARE
    aes_key TEXT;
BEGIN
    SELECT decrypted_secret INTO aes_key
    FROM vault.decrypted_secrets
    WHERE name = 'client_credentials_aes_key';

    IF aes_key IS NULL THEN
        RAISE EXCEPTION 'Vault secret client_credentials_aes_key não encontrado';
    END IF;

    IF plain IS NULL OR plain = '' THEN
        RETURN NULL;
    END IF;

    RETURN extensions.pgp_sym_encrypt(plain, aes_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.encrypt_client_credential(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_client_credential(TEXT) TO service_role;

-- Decripta. Só service_role pode chamar — nunca expor a usuários autenticados.
CREATE OR REPLACE FUNCTION public.decrypt_client_credential(cipher BYTEA)
RETURNS TEXT AS $$
DECLARE
    aes_key TEXT;
BEGIN
    SELECT decrypted_secret INTO aes_key
    FROM vault.decrypted_secrets
    WHERE name = 'client_credentials_aes_key';

    IF aes_key IS NULL THEN
        RAISE EXCEPTION 'Vault secret client_credentials_aes_key não encontrado';
    END IF;

    IF cipher IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN extensions.pgp_sym_decrypt(cipher, aes_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.decrypt_client_credential(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_client_credential(BYTEA) TO service_role;

-- ─── Comments ───────────────────────────────────────────────────────────
COMMENT ON TABLE public.client_credentials IS
    'Credenciais (logins/senhas) de clientes da agência. Senhas encriptadas via pgp_sym_encrypt + vault key.';
COMMENT ON COLUMN public.client_credentials.password_encrypted IS
    'Encriptado via public.encrypt_client_credential(). Decripte só via service_role + decrypt_client_credential().';

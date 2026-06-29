# Deploy — client-credentials

Feature: Credenciais (logins/senhas) de clientes com criptografia AES-256 server-side.

## Pré-requisitos

- Supabase CLI logado na conta com acesso ao projeto Lever (`pxhmzpwvxvlwngjbjkrg`)
- Extensão `supabase_vault` habilitada (vem ativa por default em projetos Supabase modernos)

## 1. Aplicar migration

```bash
# Via Supabase CLI (precisa estar linkado: supabase link --project-ref pxhmzpwvxvlwngjbjkrg)
supabase db push

# OU manual no Dashboard:
# SQL Editor → Cole o conteúdo de supabase/migrations/20260420_client_credentials.sql
```

A migration:
- Habilita `pgcrypto`
- Cria secret `client_credentials_aes_key` no Vault (chave aleatória 32 bytes hex) — só se ainda não existe (idempotente)
- Cria tabela `public.client_credentials` com RLS (3 níveis: agency / client linkado)
- Cria 2 funções `SECURITY DEFINER`: `encrypt_client_credential` + `decrypt_client_credential`
- Funções só executáveis por `service_role` (chave nunca exposta a usuários)

## 2. Deploy da edge function

```bash
supabase functions deploy client-credentials --no-verify-jwt=false
```

A função roda com JWT do user (RLS aplicada) + service_role apenas pra chamar as RPCs criptográficas.

## 3. Validar

No SQL Editor do Supabase:

```sql
-- Confirmar secret no Vault
SELECT name, created_at FROM vault.secrets WHERE name = 'client_credentials_aes_key';
-- → 1 row

-- Confirmar tabela
SELECT count(*) FROM public.client_credentials;
-- → 0 (vazia, mas existe)

-- Confirmar RLS ativa
SELECT relrowsecurity FROM pg_class WHERE relname = 'client_credentials';
-- → t (true)

-- Testar encrypt/decrypt (rode como service_role no SQL editor)
SELECT public.decrypt_client_credential(public.encrypt_client_credential('teste-123'));
-- → 'teste-123'
```

## 4. Testar UI

1. Abrir Lever System → cliente qualquer → aba **Configurações**
2. Scrollar até **Credenciais & Acessos** (entre "Acesso ao Portal" e "Produtos Contratados")
3. Click **Adicionar** → preencher Label, Username, Password → salvar
4. Verificar que aparece na lista
5. Click ícone do olho → senha é decriptada e exibida
6. Click ícone de copiar → senha vai pra clipboard
7. Click editar → modal pré-preenchido (busca senha de novo via edge function)
8. Click trash → confirma → remove

## Segurança

- **Senhas no banco**: BYTEA encriptado via `pgp_sym_encrypt` (AES + PGP framing)
- **Chave AES**: armazenada em `vault.secrets`, ao qual só o Supabase manager tem acesso
- **Acesso à decrypt**: SECURITY DEFINER + REVOKE FROM PUBLIC + GRANT TO service_role
- **RLS**: usuários só veem credenciais dos clientes que têm acesso (via `team_members.linked_client_id` ou `user_type='agency'`)
- **Edge function**: valida JWT antes de qualquer operação. Encrypt/decrypt acontecem só server-side via RPC.
- **HTTPS only**: Supabase força TLS — senhas nunca trafegam em texto plano fora da DB.

## Rotação de chave (quando necessário)

```sql
-- 1. Criar nova chave
SELECT vault.create_secret(
    encode(gen_random_bytes(32), 'hex'),
    'client_credentials_aes_key_v2',
    'Rotated AES key'
);

-- 2. Re-encriptar todas (rode como service_role)
DO $$
DECLARE
    rec RECORD;
    plain TEXT;
BEGIN
    FOR rec IN SELECT id, password_encrypted FROM public.client_credentials WHERE password_encrypted IS NOT NULL LOOP
        plain := public.decrypt_client_credential(rec.password_encrypted);
        -- Atualiza encrypt_client_credential pra usar 'client_credentials_aes_key_v2' antes deste passo
        UPDATE public.client_credentials
            SET password_encrypted = public.encrypt_client_credential(plain)
            WHERE id = rec.id;
    END LOOP;
END $$;

-- 3. Renomear/deletar a antiga
UPDATE vault.secrets SET name = 'client_credentials_aes_key_old'
    WHERE name = 'client_credentials_aes_key';
UPDATE vault.secrets SET name = 'client_credentials_aes_key'
    WHERE name = 'client_credentials_aes_key_v2';
```

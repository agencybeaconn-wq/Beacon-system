---
name: edge-function
description: Cria ou atualiza Supabase Edge Functions seguindo os padrões do projeto Lever System.
argument-hint: [nome da função] [o que ela faz]
---

# Supabase Edge Function Skill

Quando o usuario pedir para criar ou atualizar uma Edge Function, siga estes passos:

## 1. Verificar se a funcao ja existe

Procure em `supabase/functions/` se ja existe uma pasta com o nome da funcao solicitada. Se existir, leia o codigo atual antes de modificar.

## 2. Criar nova funcao seguindo o padrao do projeto

Crie o arquivo em `supabase/functions/<nome>/index.ts` usando esta estrutura padrao:

```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    // Auth check
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Service role or user auth
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const isServiceRole = token === serviceRoleKey
    if (!isServiceRole) {
        // validate user JWT
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
            global: { headers: { Authorization: `Bearer ${token}` } }
        })
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabase = createClient(supabaseUrl, serviceRoleKey)

        // Function logic here

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
```

## 3. Regras obrigatorias

- **CORS**: Sempre importar `corsHeaders` de `'../_shared/cors.ts'` e tratar `OPTIONS`.
- **Auth**: Checar JWT do header ou service role key. Nunca confiar em `verify_jwt` do config.
- **Respostas**: Todas as respostas devem ter `Content-Type: application/json` e incluir `corsHeaders`.
- **Try/catch**: Toda logica de negocio dentro de try/catch com retorno de erro 500.
- **Env vars**: Usar `Deno.env.get()` para `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e quaisquer secrets adicionais.

## 4. Config

Crie ou atualize `supabase/config.toml` para incluir a funcao com `verify_jwt = false` (a autenticacao eh manual no codigo):

```toml
[functions.<nome>]
verify_jwt = false
```

## 5. Funcoes de referencia

Consulte funcoes existentes como exemplo de padrao:
- `supabase/functions/shopify-admin-proxy/` — proxy para Shopify Admin API
- `supabase/functions/gemini-image-gen/` — geracao de imagem com IA
- `supabase/functions/store-deployment/` — deploy de loja completa

Leia essas funcoes se precisar entender como o projeto lida com casos especificos.

## 6. Deploy

Depois de criar/atualizar a funcao, informe o usuario o comando de deploy:

```bash
npx supabase functions deploy <nome>
```

## 7. Localizacao

O arquivo principal deve estar em: `supabase/functions/<nome>/index.ts`

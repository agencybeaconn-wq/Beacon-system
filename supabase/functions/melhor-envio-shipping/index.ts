import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getOrRefreshToken(supabase: any, environment: string, clientId: string, clientSecret: string, baseUrl: string) {
    const { data, error } = await supabase
        .from('melhor_envio_tokens')
        .select('*')
        .eq('environment', environment)
        .single()

    if (error || !data) {
        throw new Error('Token do Melhor Envio não encontrado no banco de dados. Autentique o app primeiro.');
    }

    const now = new Date()
    const expiresAt = new Date(data.expires_at)

    // Dá uma margem de segurança de 1 hora (3600 ms) antes de expirar
    if (expiresAt.getTime() - now.getTime() < 3600000) {
        console.log(`[melhor-envio] Token expirando/expirado para o ambiente ${environment}. Renovando...`)

        // Tenta renovar o token
        const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: data.refresh_token,
                client_id: clientId,
                client_secret: clientSecret
            }),
        })

        const tokenData = await tokenResponse.json()
        if (tokenData.error || !tokenData.access_token) {
            throw new Error(`Falha ao renovar token: ${JSON.stringify(tokenData)}`);
        }

        const newExpiresAt = new Date()
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in)

        // Atualiza no banco
        await supabase
            .from('melhor_envio_tokens')
            .update({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: newExpiresAt.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('environment', environment)

        return tokenData.access_token
    }

    return data.access_token
}

const serve = (async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()
        const { from, to, products, options } = payload;

        if (!from || !to || !products) {
            return new Response(JSON.stringify({ error: 'Faltando parâmetros obrigatórios: from, to, ou products' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Configurações do Melhor Envio
        const clientId = Deno.env.get('MELHOR_ENVIO_CLIENT_ID')
        const clientSecret = Deno.env.get('MELHOR_ENVIO_CLIENT_SECRET')
        const environment = Deno.env.get('MELHOR_ENVIO_ENV') || 'sandbox' // 'sandbox' ou 'production'

        const baseUrl = environment === 'sandbox'
            ? 'https://sandbox.melhorenvio.com.br'
            : 'https://www.melhorenvio.com.br'

        // Inicializa o cliente Supabase com a role de Service
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Obtém o token válido (renova automaticamente se necessário)
        const accessToken = await getOrRefreshToken(supabase, environment, clientId, clientSecret, baseUrl);

        // Faz a requisição para calcular o frete
        const res = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Trybuteha Custom App (integracao@trybuteha.com.br)' // Required by ME
            },
            body: JSON.stringify({
                from,
                to,
                products,
                options // opcional: receipt, own_hand, services
            })
        });

        const calculateData = await res.json();
        return new Response(JSON.stringify(calculateData), {
            status: res.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Erro na cotação do Melhor Envio:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})

Deno.serve(instrument("melhor-envio-shipping", serve))

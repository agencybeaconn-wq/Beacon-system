import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const serve = (async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const code = url.searchParams.get('code')

        // Configurações do Melhor Envio
        const clientId = Deno.env.get('MELHOR_ENVIO_CLIENT_ID')
        const clientSecret = Deno.env.get('MELHOR_ENVIO_CLIENT_SECRET')
        const redirectUri = Deno.env.get('MELHOR_ENVIO_REDIRECT_URI')
        const environment = Deno.env.get('MELHOR_ENVIO_ENV') || 'sandbox' // 'sandbox' ou 'production'

        const baseUrl = environment === 'sandbox'
            ? 'https://sandbox.melhorenvio.com.br'
            : 'https://www.melhorenvio.com.br'

        if (!code) {
            // Se não tem code, redireciona o admin para a URL de autorização para logar no Melhor Envio
            const authUrl = `${baseUrl}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=shipping-calculate`;
            return Response.redirect(authUrl);
        }

        if (!clientId || !clientSecret || !redirectUri) {
            return new Response(JSON.stringify({ error: 'Configurações de ambiente do Melhor Envio não encontradas' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Troca o code pelo token
        const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code,
            }),
        })

        const tokenData = await tokenResponse.json()

        if (tokenData.error || !tokenData.access_token) {
            console.error('Erro ao pegar token do Melhor Envio:', tokenData);
            return new Response(JSON.stringify({ error: 'Falha ao autenticar com o Melhor Envio', details: tokenData }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { access_token, refresh_token, expires_in } = tokenData

        // Calcula a data de expiração (normalmente 30 dias em segundos)
        const expiresAt = new Date()
        expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

        // Inicializa o cliente Supabase com a role de Service
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Salva na tabela
        const { error: dbError } = await supabase
            .from('melhor_envio_tokens')
            .upsert({
                environment: environment,
                access_token: access_token,
                refresh_token: refresh_token,
                expires_at: expiresAt.toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'environment' })

        if (dbError) {
            console.error('Erro ao salvar token:', dbError);
            return new Response(JSON.stringify({ error: 'Erro de banco de dados ao salvar o token', dbError }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({ message: 'Autenticado com sucesso! O token foi salvo.', environment }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        console.error('Erro geral no OAuth Callback do Melhor Envio:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})

Deno.serve(instrument("melhor-envio-auth", serve))

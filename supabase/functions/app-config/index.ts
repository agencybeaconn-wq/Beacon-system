// @ts-ignore
declare const Deno: any;

/**
 * app-config — config remoto do app white-label (Módulo Apps Mobile).
 *
 * GET ?app_id=<uuid>  →  { app_name, status, config }
 *
 * O app Expo chama isso no boot e se monta a partir do config (remote config).
 * Endpoint público SEM JWT: o app não tem sessão Supabase. O escopo é o app_id
 * (uuid não-adivinhável) e a resposta só carrega o que já é visível dentro do
 * próprio app — nada de token, credencial ou dado de outro tenant.
 */
import { instrument } from '../_shared/logger.ts';
import { corsHeaders } from '../_shared/cors.ts';

async function getSupabase() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
}

Deno.serve(instrument('app-config', async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'GET') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const appId = new URL(req.url).searchParams.get('app_id') ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId)) {
        return new Response(JSON.stringify({ error: 'app_id inválido' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('store_apps')
        .select('app_name, status, config')
        .eq('id', appId)
        .maybeSingle();

    if (error) {
        console.error('[app-config] erro ao buscar app', appId, error.message);
        return new Response(JSON.stringify({ error: 'erro interno' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    if (!data) {
        return new Response(JSON.stringify({ error: 'app não encontrado' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            // o app cacheia local; CDN pode segurar 60s sem atrapalhar edição no painel
            'Cache-Control': 'public, max-age=60',
        },
    });
}));

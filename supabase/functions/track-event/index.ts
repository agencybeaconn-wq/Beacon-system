// @ts-ignore
declare const Deno: any;

/**
 * track-event — telemetria do app white-label (Módulo Apps Mobile).
 *
 * POST body = appEventSchema (contratos em _shared/app-contracts.ts)
 * → valida que o device pertence ao app → insere em app_events → { ok }
 *
 * Alimenta o dash (downloads/aberturas), os segmentos e os gatilhos de jornada
 * (install → boas-vindas; push_open → taxa de abertura em push_sends).
 */
import { instrument } from '../_shared/logger.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { appEventSchema } from '../_shared/app-contracts.ts';

async function getSupabase() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
}

Deno.serve(instrument('track-event', async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch {
        return new Response(JSON.stringify({ error: 'JSON inválido' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const parsed = appEventSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'payload inválido', issues: parsed.error.issues }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    const ev = parsed.data;

    const supabase = await getSupabase();

    // device precisa pertencer ao app — client_id vem do banco, não do payload
    const { data: device } = await supabase
        .from('app_devices')
        .select('id, client_id')
        .eq('id', ev.device_id)
        .eq('app_id', ev.app_id)
        .maybeSingle();
    if (!device) {
        return new Response(JSON.stringify({ error: 'device não encontrado pra esse app' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { error } = await supabase.from('app_events').insert({
        app_id: ev.app_id,
        device_id: ev.device_id,
        client_id: device.client_id,
        type: ev.type,
        payload: ev.payload,
        occurred_at: ev.occurred_at,
    });
    if (error) {
        console.error('[track-event] insert falhou', ev.type, error.message);
        return new Response(JSON.stringify({ error: 'erro interno' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // push_open marca o recibo correspondente como aberto (melhor esforço)
    if (ev.type === 'push_open' && typeof ev.payload['push_send_id'] === 'number') {
        await supabase
            .from('push_sends')
            .update({ status: 'aberto', opened_at: new Date().toISOString() })
            .eq('id', ev.payload['push_send_id'])
            .eq('device_id', ev.device_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}));

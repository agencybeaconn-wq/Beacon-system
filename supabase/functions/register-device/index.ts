// @ts-ignore
declare const Deno: any;

/**
 * register-device — registro/heartbeat de device do app white-label.
 *
 * POST body = deviceRegistrationSchema (contratos em _shared/app-contracts.ts)
 * → upsert em app_devices por (app_id, installation_id) → { device_id, novo }
 *
 * O app chama no primeiro boot (novo=true dispara jornada de boas-vindas via
 * evento 'install' que o próprio app envia na sequência) e a cada abertura
 * (atualiza last_seen_at, versão, customer logado).
 */
import { instrument } from '../_shared/logger.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { deviceRegistrationSchema } from '../_shared/app-contracts.ts';
import { dentroDoLimite } from '../_shared/rate-limit.ts';

async function getSupabase() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
}

Deno.serve(instrument('register-device', async (req: Request) => {
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

    const parsed = deviceRegistrationSchema.safeParse(body);
    if (!parsed.success) {
        return new Response(JSON.stringify({ error: 'payload inválido', issues: parsed.error.issues }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    const reg = parsed.data;

    const supabase = await getSupabase();

    // #12 rate-limit: registro é upsert por installation; um app_id vazado não
    // pode criar devices sem teto. Generoso por app (heartbeat reabre sessão),
    // apertado por IP (o abusador anônimo).
    const ok = await dentroDoLimite(supabase, 'register', reg.app_id, req, {
        app: [600, 60], ip: [60, 60],
    });
    if (!ok) {
        return new Response(JSON.stringify({ error: 'muitas requisições' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // app precisa existir — também dá o client_id (fonte: banco, nunca o payload)
    const { data: app } = await supabase
        .from('store_apps')
        .select('id, client_id')
        .eq('id', reg.app_id)
        .maybeSingle();
    if (!app) {
        return new Response(JSON.stringify({ error: 'app não encontrado' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { data: existing } = await supabase
        .from('app_devices')
        .select('id')
        .eq('app_id', reg.app_id)
        .eq('installation_id', reg.installation_id)
        .maybeSingle();

    const baseRow = {
        app_id: reg.app_id,
        client_id: app.client_id,
        installation_id: reg.installation_id,
        platform: reg.platform,
        app_version: reg.app_version,
        os_version: reg.os_version,
        device_model: reg.device_model,
        locale: reg.locale,
        shopify_customer_id: reg.shopify_customer_id,
        last_seen_at: new Date().toISOString(),
    };

    if (existing) {
        // Heartbeat sem token não apaga um canal que já funcionava. Só uma
        // tentativa com token novo altera o estado de push.
        const update = {
            ...baseRow,
            ...(reg.expo_push_token ? {
                expo_push_token: reg.expo_push_token,
                push_enabled: true,
                disabled_reason: null,
            } : {}),
        };
        const { error } = await supabase.from('app_devices').update(update).eq('id', existing.id);
        if (error) {
            console.error('[register-device] update falhou', existing.id, error.message);
            return new Response(JSON.stringify({ error: 'erro interno' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({ device_id: existing.id, novo: false }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { data: created, error } = await supabase
        .from('app_devices')
        .insert({
            ...baseRow,
            expo_push_token: reg.expo_push_token,
            push_enabled: Boolean(reg.expo_push_token),
            disabled_reason: reg.expo_push_token ? null : 'sem_permissao_ou_token',
        })
        .select('id')
        .single();
    if (error || !created) {
        console.error('[register-device] insert falhou', error?.message);
        return new Response(JSON.stringify({ error: 'erro interno' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ device_id: created.id, novo: true }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}));

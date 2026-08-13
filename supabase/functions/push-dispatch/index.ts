// @ts-ignore
declare const Deno: any;

/**
 * push-dispatch — motor de envio de push do Módulo Apps Mobile (E3).
 *
 * POST { campaign_id }            → envia essa campanha agora
 * POST { tick: true }             → varre campanhas agendadas vencidas (pg_cron)
 * POST { device_id, payload }     → push avulso de teste
 *
 * Auth manual (o gateway roda com --no-verify-jwt):
 *  - máquina (cron/scripts): header `x-dispatch-secret` = secret DISPATCH_SECRET,
 *    ou Authorization com a service role key. O secret próprio existe porque o
 *    formato da chave injetada pelo runtime varia (legacy JWT vs sb_secret_*),
 *    e autenticação não pode depender disso.
 *  - usuário: JWT no Authorization; a RLS decide se ele enxerga a campanha.
 *
 * Regras que o motor garante:
 *  - lotes de 100 (limite da Expo Push API)
 *  - recibo individual em push_sends, com push_send_id embutido no payload
 *    (é o que fecha o ciclo de abertura via track-event)
 *  - teto anti-spam por device/dia (store_apps.push_limits) — rastreio não conta
 *  - DeviceNotRegistered → desliga o device (não insiste em token morto)
 */
import { corsHeaders } from '../_shared/cors.ts';
import { instrument } from '../_shared/logger.ts';
import { pushPayloadSchema, segmentDefinitionSchema } from '../_shared/app-contracts.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const LOTE = 100;

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

interface Device {
    id: string;
    expo_push_token: string;
    platform: string;
    shopify_customer_id: string | null;
    first_seen_at: string;
    last_seen_at: string;
}

/** Aplica o filtro do segmento sobre os devices do cliente. */
async function resolverAlvo(
    supabase: any, clientId: string, appId: string, segmentId: string | null,
): Promise<Device[]> {
    const { data: devices } = await supabase
        .from('app_devices')
        .select('id, expo_push_token, platform, shopify_customer_id, first_seen_at, last_seen_at')
        .eq('app_id', appId)
        .eq('push_enabled', true);
    let alvo: Device[] = devices ?? [];
    if (!segmentId || alvo.length === 0) return alvo;

    const { data: seg } = await supabase
        .from('segments').select('definition').eq('id', segmentId).maybeSingle();
    const parsed = segmentDefinitionSchema.safeParse(seg?.definition ?? {});
    if (!parsed.success) return alvo;
    const f = parsed.data;
    const agora = Date.now();
    const dias = (iso: string) => (agora - new Date(iso).getTime()) / 86400000;

    if (f.platform) alvo = alvo.filter((d) => d.platform === f.platform);
    if (f.inativo_dias !== null) alvo = alvo.filter((d) => dias(d.last_seen_at) >= f.inativo_dias!);
    if (f.instalou_ha_dias !== null) alvo = alvo.filter((d) => dias(d.first_seen_at) <= f.instalou_ha_dias!);

    // filtros que dependem de compra olham o CRM do app (por customer)
    if (f.comprou !== null || f.gasto_minimo !== null) {
        const { data: clientes } = await supabase
            .from('app_customers')
            .select('shopify_customer_id, orders_app_count, total_spent_app')
            .eq('client_id', clientId);
        const porId = new Map<string, { pedidos: number; gasto: number }>(
            (clientes ?? []).map((c: any) => [
                String(c.shopify_customer_id),
                { pedidos: Number(c.orders_app_count ?? 0), gasto: Number(c.total_spent_app ?? 0) },
            ]),
        );
        alvo = alvo.filter((d) => {
            const c = d.shopify_customer_id ? porId.get(d.shopify_customer_id) : undefined;
            const comprou = !!c && c.pedidos > 0;
            if (f.comprou === 'sim' && !comprou) return false;
            if (f.comprou === 'nao' && comprou) return false;
            if (f.gasto_minimo !== null && (c?.gasto ?? 0) < f.gasto_minimo) return false;
            return true;
        });
    }
    return alvo;
}

/** Remove devices que já bateram o teto diário de push de marketing. */
async function aplicarTeto(
    supabase: any, devices: Device[], tetoDia: number,
): Promise<{ permitidos: Device[]; bloqueados: number }> {
    if (devices.length === 0) return { permitidos: [], bloqueados: 0 };
    const desde = new Date(Date.now() - 86400000).toISOString();
    const { data: envios } = await supabase
        .from('push_sends')
        .select('device_id')
        .in('device_id', devices.map((d) => d.id))
        .in('kind', ['campanha', 'jornada'])
        .gte('sent_at', desde);
    const contagem = new Map<string, number>();
    for (const e of envios ?? []) {
        contagem.set(e.device_id, (contagem.get(e.device_id) ?? 0) + 1);
    }
    const permitidos = devices.filter((d) => (contagem.get(d.id) ?? 0) < tetoDia);
    return { permitidos, bloqueados: devices.length - permitidos.length };
}

/**
 * Envia para os devices e grava os recibos.
 * O push_send_id é criado ANTES do envio pra viajar no payload — sem isso não
 * dá pra atribuir a abertura de volta ao envio.
 */
async function enviar(
    supabase: any, clientId: string, devices: Device[], payload: any,
    kind: string, campaignId: string | null, journeyRunId: string | null,
): Promise<{ enviados: number; falhas: number }> {
    let enviados = 0;
    let falhas = 0;

    for (let i = 0; i < devices.length; i += LOTE) {
        const lote = devices.slice(i, i + LOTE);

        const { data: recibos, error: erroRecibo } = await supabase
            .from('push_sends')
            .insert(lote.map((d) => ({
                client_id: clientId, device_id: d.id,
                campaign_id: campaignId, journey_run_id: journeyRunId,
                kind, payload, status: 'enviado',
            })))
            .select('id, device_id');
        if (erroRecibo) {
            console.error('[push-dispatch] recibos falharam', erroRecibo.message);
            falhas += lote.length;
            continue;
        }
        const reciboPorDevice = new Map<string, number>(
            (recibos ?? []).map((r: any) => [r.device_id, r.id]),
        );

        const mensagens = lote.map((d) => ({
            to: d.expo_push_token,
            sound: 'default',
            title: payload.title,
            body: payload.body,
            ...(payload.image_url ? { richContent: { image: payload.image_url } } : {}),
            data: {
                deep_link: payload.deep_link ?? null,
                push_send_id: reciboPorDevice.get(d.id) ?? null,
            },
        }));

        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(mensagens),
            });
            const body = await res.json();
            const tickets: any[] = body?.data ?? [];

            for (let j = 0; j < lote.length; j++) {
                const device = lote[j];
                const ticket = tickets[j];
                const reciboId = reciboPorDevice.get(device.id);
                if (!reciboId) continue;

                if (ticket?.status === 'ok') {
                    enviados++;
                    await supabase.from('push_sends')
                        .update({ expo_ticket_id: ticket.id }).eq('id', reciboId);
                } else {
                    falhas++;
                    const motivo = ticket?.details?.error ?? ticket?.message ?? 'erro desconhecido';
                    await supabase.from('push_sends')
                        .update({ status: 'falha', error: String(motivo).slice(0, 300) })
                        .eq('id', reciboId);
                    // token morto: para de insistir
                    if (ticket?.details?.error === 'DeviceNotRegistered') {
                        await supabase.from('app_devices')
                            .update({ push_enabled: false, disabled_reason: 'DeviceNotRegistered' })
                            .eq('id', device.id);
                    }
                }
            }
        } catch (e: any) {
            console.error('[push-dispatch] Expo Push API falhou', e.message);
            falhas += lote.length;
            await supabase.from('push_sends')
                .update({ status: 'falha', error: String(e.message).slice(0, 300) })
                .in('id', [...reciboPorDevice.values()]);
        }
    }
    return { enviados, falhas };
}

async function processarCampanha(supabase: any, campaignId: string) {
    const { data: c } = await supabase
        .from('push_campaigns')
        .select('id, client_id, app_id, payload, segment_id, status')
        .eq('id', campaignId).maybeSingle();
    if (!c) return { erro: 'campanha não encontrada' };
    if (['enviando', 'enviada'].includes(c.status)) {
        return { erro: `campanha já ${c.status}` };
    }

    const payload = pushPayloadSchema.safeParse(c.payload);
    if (!payload.success) {
        await supabase.from('push_campaigns')
            .update({ status: 'erro', error: 'payload inválido' }).eq('id', c.id);
        return { erro: 'payload inválido' };
    }

    // trava otimista: só segue quem conseguiu mudar o status (evita envio dobrado)
    const { data: travou } = await supabase.from('push_campaigns')
        .update({ status: 'enviando' })
        .eq('id', c.id).neq('status', 'enviando').select('id');
    if (!travou || travou.length === 0) return { erro: 'campanha já está sendo enviada' };

    const { data: app } = await supabase
        .from('store_apps').select('push_limits').eq('id', c.app_id).maybeSingle();
    const teto = Number(app?.push_limits?.max_marketing_per_day ?? 3);

    const alvo = await resolverAlvo(supabase, c.client_id, c.app_id, c.segment_id);
    const { permitidos, bloqueados } = await aplicarTeto(supabase, alvo, teto);
    const { enviados, falhas } = await enviar(
        supabase, c.client_id, permitidos, payload.data, 'campanha', c.id, null,
    );

    await supabase.from('push_campaigns').update({
        status: 'enviada',
        sent_count: enviados,
        error: falhas > 0 ? `${falhas} falha(s) de envio` : null,
    }).eq('id', c.id);

    return { campanha: c.id, alvo: alvo.length, bloqueados_por_teto: bloqueados, enviados, falhas };
}

Deno.serve(instrument('push-dispatch', async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const dispatchSecret = Deno.env.get('DISPATCH_SECRET') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
    const secretHeader = req.headers.get('x-dispatch-secret') ?? '';

    // máquina: secret dedicado (formato de chave do runtime é irrelevante)
    // ou a service role key no Authorization (compatibilidade)
    const isServiceRole =
        (dispatchSecret !== '' && secretHeader === dispatchSecret) ||
        (serviceRoleKey !== '' && token === serviceRoleKey);

    if (!token && !isServiceRole) return json(401, { error: 'não autenticado' });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any;
    try { body = await req.json(); } catch { return json(400, { error: 'JSON inválido' }); }

    // usuário comum: valida JWT e o acesso ao cliente da campanha
    if (!isServiceRole) {
        const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error } = await asUser.auth.getUser();
        if (error || !user) return json(401, { error: 'token inválido' });
        if (body?.tick) return json(403, { error: 'tick é exclusivo do cron' });
        if (!body?.campaign_id) return json(400, { error: 'campaign_id obrigatório' });
        // RLS decide: se o usuário não enxerga a campanha, não pode disparar
        const { data: visivel } = await asUser
            .from('push_campaigns').select('id').eq('id', body.campaign_id).maybeSingle();
        if (!visivel) return json(403, { error: 'sem acesso a essa campanha' });
    }

    try {
        if (body?.tick) {
            const { data: devidas } = await supabase
                .from('push_campaigns').select('id')
                .eq('status', 'agendada').lte('scheduled_at', new Date().toISOString()).limit(20);
            const resultados = [];
            for (const c of devidas ?? []) {
                resultados.push(await processarCampanha(supabase, c.id));
            }
            return json(200, { tick: true, campanhas: resultados.length, resultados });
        }

        if (body?.campaign_id) {
            return json(200, await processarCampanha(supabase, String(body.campaign_id)));
        }

        // push avulso de teste (só service role)
        if (body?.device_id && isServiceRole) {
            const payload = pushPayloadSchema.safeParse(body.payload);
            if (!payload.success) return json(400, { error: 'payload inválido' });
            const { data: d } = await supabase
                .from('app_devices')
                .select('id, client_id, expo_push_token, platform, shopify_customer_id, first_seen_at, last_seen_at')
                .eq('id', body.device_id).maybeSingle();
            if (!d) return json(404, { error: 'device não encontrado' });
            const r = await enviar(supabase, d.client_id, [d as Device], payload.data, 'teste', null, null);
            return json(200, r);
        }

        return json(400, { error: 'informe campaign_id, tick ou device_id' });
    } catch (e: any) {
        console.error('[push-dispatch] erro fatal', e.message);
        return json(500, { error: e.message });
    }
}));

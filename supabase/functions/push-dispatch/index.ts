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
import {
    journeyDefinitionSchema, pushPayloadSchema, segmentDefinitionSchema,
} from '../_shared/app-contracts.ts';
import {
    resolverAlvoPuro, aplicarTetoPuro, podeReivindicarCampanha,
    type DeviceMin, type SegmentoResolvido,
} from '../_shared/dispatch-audience.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

/** stale lease: 'enviando' há mais que isto = a function morreu no meio. */
const CAMPANHA_LEASE_MS = 10 * 60000;

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

/**
 * I/O do alvo — busca devices + resolve o segmento (fail-closed via
 * resolverAlvoPuro, testado). Devolve os Device completos correspondentes.
 */
async function resolverAlvo(
    supabase: any, clientId: string, appId: string, segmentId: string | null,
): Promise<{ alvo: Device[]; motivo: string }> {
    const { data: devices } = await supabase
        .from('app_devices')
        .select('id, expo_push_token, platform, shopify_customer_id, first_seen_at, last_seen_at')
        .eq('app_id', appId)
        .eq('push_enabled', true);
    const todos: Device[] = devices ?? [];

    // resolve o segmento pro formato que resolverAlvoPuro entende (fail-closed)
    let segmento: SegmentoResolvido = null;
    if (segmentId) {
        const { data: seg } = await supabase
            .from('segments').select('definition').eq('id', segmentId).maybeSingle();
        if (!seg) segmento = 'ausente';
        else {
            const parsed = segmentDefinitionSchema.safeParse(seg.definition ?? {});
            segmento = parsed.success ? parsed.data : 'invalido';
        }
    }

    // CRM só quando o filtro precisa (compra/gasto)
    let clientes: any[] = [];
    if (segmento && segmento !== 'ausente' && segmento !== 'invalido'
        && (segmento.comprou !== null || segmento.gasto_minimo !== null)) {
        const { data } = await supabase
            .from('app_customers')
            .select('shopify_customer_id, orders_app_count, total_spent_app')
            .eq('client_id', clientId);
        clientes = data ?? [];
    }

    const { alvo, motivo } = resolverAlvoPuro(
        todos as DeviceMin[], clientes, segmento, Date.now(),
    );
    return { alvo: alvo as Device[], motivo };
}

/** I/O do teto — conta pushes de marketing do dia e delega a decisão pura. */
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
    const r = aplicarTetoPuro(devices as DeviceMin[], contagem, tetoDia);
    return { permitidos: r.permitidos as Device[], bloqueados: r.bloqueados };
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
        .select('id, client_id, app_id, payload, segment_id, status, updated_at')
        .eq('id', campaignId).maybeSingle();
    if (!c) return { erro: 'campanha não encontrada' };

    // #8 máquina de estado: 'enviada' nunca reabre; 'enviando' só se stale (crash)
    const enviandoStale = c.status === 'enviando'
        && Date.now() - new Date(c.updated_at ?? 0).getTime() > CAMPANHA_LEASE_MS;
    if (!podeReivindicarCampanha(c.status, enviandoStale)) {
        return { erro: `campanha não reivindicável (status ${c.status})` };
    }

    const payload = pushPayloadSchema.safeParse(c.payload);
    if (!payload.success) {
        await supabase.from('push_campaigns')
            .update({ status: 'erro', error: 'payload inválido' }).eq('id', c.id);
        return { erro: 'payload inválido' };
    }

    // trava otimista atômica: reivindica SÓ o status esperado (o mesmo lido).
    // Dois ticks: só um casa o status atual → o outro perde a corrida.
    const { data: travou } = await supabase.from('push_campaigns')
        .update({ status: 'enviando', updated_at: new Date().toISOString() })
        .eq('id', c.id).eq('status', c.status).select('id');
    if (!travou || travou.length === 0) return { erro: 'campanha já reivindicada por outro tick' };

    const { data: app } = await supabase
        .from('store_apps').select('push_limits').eq('id', c.app_id).maybeSingle();
    const teto = Number(app?.push_limits?.max_marketing_per_day ?? 3);

    const { alvo, motivo } = await resolverAlvo(supabase, c.client_id, c.app_id, c.segment_id);
    const { permitidos, bloqueados } = await aplicarTeto(supabase, alvo, teto);
    const { enviados, falhas } = await enviar(
        supabase, c.client_id, permitidos, payload.data, 'campanha', c.id, null,
    );

    await supabase.from('push_campaigns').update({
        status: 'enviada',
        sent_count: enviados,
        error: falhas > 0 ? `${falhas} falha(s) de envio`
            : alvo.length === 0 ? `nenhum alvo (${motivo})` : null,
    }).eq('id', c.id);

    return {
        campanha: c.id, alvo: alvo.length, motivo_alvo: motivo,
        bloqueados_por_teto: bloqueados, enviados, falhas,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Motor de jornadas (E4) — boas-vindas, carrinho abandonado e custom são a
// MESMA máquina: gatilho → espera → push → próximo passo, com saída automática.
// Roda no mesmo tick do cron. Tudo idempotente: cada varredura pode repetir
// sem duplicar run nem push.
// ═══════════════════════════════════════════════════════════════════════════

interface JourneyRow {
    id: string;
    client_id: string;
    app_id: string;
    kind: string;
    definition: unknown;
    created_at?: string;
}

async function insertRunIdempotente(supabase: any, values: Record<string, unknown>) {
    const { error } = await supabase.from('journey_runs').insert(values);
    if (error && error.code !== '23505') throw error;
}

/** Gatilho install: cria run pra cada install sem run desta jornada. */
async function abrirRunsDeInstall(supabase: any, j: JourneyRow, def: any) {
    const desde = new Date(Date.now() - 3 * 86400000).toISOString(); // varre 3 dias
    const { data: installs } = await supabase
        .from('app_events')
        .select('device_id, occurred_at')
        .eq('app_id', j.app_id).eq('type', 'install')
        .gte('occurred_at', desde);
    if (!installs?.length) return;

    const { data: existentes } = await supabase
        .from('journey_runs').select('device_id').eq('journey_id', j.id);
    const jaTem = new Set((existentes ?? []).map((r: any) => r.device_id));

    const novos = installs.filter((i: any) => !jaTem.has(i.device_id));
    if (!novos.length) return;

    // #19: dedupe_key + insert idempotente — o índice único protege mesmo se
    // dois ticks concorrerem ou o select de "existentes" truncar em 1000.
    const delay0 = Number(def.steps[0]?.delay_minutes ?? 0);
    for (const i of novos) {
        await insertRunIdempotente(supabase, {
            journey_id: j.id, client_id: j.client_id, device_id: i.device_id,
            current_step: 0, state: 'ativa', context: {},
            dedupe_key: `${j.id}:install:${i.device_id}`,
            next_step_at: new Date(new Date(i.occurred_at).getTime() + delay0 * 60000).toISOString(),
        });
    }
}

/**
 * Gatilho carrinho abandonado: checkout com attributes[app_device] sem pedido
 * pago após N minutos → run. Pedido pago com o mesmo checkout_token → saída.
 */
async function abrirRunsDeCarrinho(supabase: any, j: JourneyRow, def: any) {
    const afterMin = Number(def.trigger?.after_minutes ?? 60);
    const desde = new Date(Date.now() - 2 * 86400000).toISOString();
    const limiteMs = Date.now() - afterMin * 60000;

    // #10: SEM filtro por limite aqui — pega o evento MAIS RECENTE de cada
    // token; se ele for recente (comprador ainda no checkout), NÃO abre run.
    // Antes, o filtro `<= limite` escondia o update novo e pescava um antigo,
    // disparando "carrinho abandonado" com o comprador ainda ativo.
    const { data: eventos } = await supabase
        .from('webhook_events')
        .select('payload, received_at')
        .eq('client_id', j.client_id)
        .in('topic', ['checkouts/create', 'checkouts/update'])
        .gte('received_at', desde)
        .order('received_at', { ascending: false })
        .limit(500);
    if (!eventos?.length) return;

    const porToken = new Map<string, { device: string | null; ultimoMs: number }>();
    for (const ev of eventos) {
        const p = ev.payload ?? {};
        const token = String(p.token ?? p.cart_token ?? '');
        if (!token || porToken.has(token)) continue; // já ordenado desc → 1º = mais recente
        const attrs: Array<{ name: string; value: string }> = p.note_attributes ?? [];
        const attr = (n: string) => attrs.find((a) => a?.name === n)?.value ?? null;
        if (attr('app_source') !== 'beacon_app') continue; // carrinho do site, não é nosso
        porToken.set(token, {
            device: attr('app_device'),
            ultimoMs: new Date(ev.received_at).getTime(),
        });
    }
    if (porToken.size === 0) return;

    // pedidos pagos matam o abandono (orders/paid carrega checkout_token)
    const { data: pagos } = await supabase
        .from('webhook_events')
        .select('payload')
        .eq('client_id', j.client_id).eq('topic', 'orders/paid')
        .gte('received_at', desde);
    const tokensPagos = new Set(
        (pagos ?? []).map((ev: any) => String(ev.payload?.checkout_token ?? '')).filter(Boolean),
    );

    const { data: existentes } = await supabase
        .from('journey_runs').select('context, device_id, state, id').eq('journey_id', j.id);
    const runPorToken = new Map(
        (existentes ?? []).map((r: any) => [String(r.context?.checkout_token ?? ''), r]),
    );

    const delay0 = Number(def.steps[0]?.delay_minutes ?? 0);
    for (const [token, info] of porToken) {
        const run = runPorToken.get(token);
        if (tokensPagos.has(token)) {
            // comprou: run ativa (se houver) sai do fluxo
            if (run && run.state === 'ativa') {
                await supabase.from('journey_runs')
                    .update({ state: 'saida', finished_at: new Date().toISOString() })
                    .eq('id', run.id);
            }
            continue;
        }
        if (run || !info.device) continue; // já tem run, ou checkout sem device do app
        // #10: só abandona se o ÚLTIMO evento do checkout já passou do limite
        // (comprador parado). Se mexeu há pouco, ainda está ativo — espera.
        if (info.ultimoMs > limiteMs) continue;
        await insertRunIdempotente(supabase, {
            journey_id: j.id, client_id: j.client_id, device_id: info.device,
            current_step: 0, state: 'ativa',
            context: { checkout_token: token },
            dedupe_key: `${j.id}:cart:${token}`,
            next_step_at: new Date(Date.now() + delay0 * 60000).toISOString(),
        });
    }
}

/** Uma mudança normalizada no rastreio abre uma execução exatamente uma vez. */
async function abrirRunsDeStatus(supabase: any, j: JourneyRow, def: any) {
    const status = def.trigger.status;
    let query = supabase.from('tracked_orders')
        .select('id, device_id, order_number, status, status_changed_at, last_event_at')
        .eq('client_id', j.client_id).eq('status', status)
        .not('device_id', 'is', null)
        .order('status_changed_at', { ascending: false }).limit(300);
    if (j.created_at) query = query.gte('status_changed_at', j.created_at);
    const { data: orders, error } = await query;
    if (error) throw error;
    const delay0 = Number(def.steps[0]?.delay_minutes ?? 0);

    for (const order of orders ?? []) {
        if (status === 'entregue') {
            await supabase.from('journey_runs').update({
                state: 'saida', finished_at: new Date().toISOString(),
            }).eq('device_id', order.device_id).eq('state', 'ativa')
                .contains('context', { tracked_order_id: order.id });
        }
        const changedAt = order.status_changed_at ?? order.last_event_at ?? new Date().toISOString();
        const dedupe = `${order.id}:status:${order.status}:${changedAt}`;
        await insertRunIdempotente(supabase, {
            journey_id: j.id, client_id: j.client_id, device_id: order.device_id,
            current_step: 0, state: 'ativa',
            dedupe_key: dedupe, // coluna canônica (o índice único novo é sobre ela)
            context: {
                tracked_order_id: order.id,
                order_number: order.order_number,
                status: order.status,
                status_changed_at: changedAt,
                dedupe_key: dedupe,
            },
            next_step_at: new Date(new Date(changedAt).getTime() + delay0 * 60000).toISOString(),
        });
    }
}

/** Abre conforto só quando o MESMO evento continua sem atualização por N dias. */
async function abrirRunsDeSilencio(supabase: any, j: JourneyRow, def: any) {
    const days = Number(def.trigger.days_without_event);
    const limite = new Date(Date.now() - days * 86400000).toISOString();
    const { data: orders, error } = await supabase.from('tracked_orders')
        .select('id, device_id, order_number, status, last_event_at')
        .eq('client_id', j.client_id).is('delivered_at', null)
        .not('device_id', 'is', null).not('last_event_at', 'is', null)
        .lte('last_event_at', limite).limit(300);
    if (error) throw error;
    const delay0 = Number(def.steps[0]?.delay_minutes ?? 0);

    for (const order of orders ?? []) {
        const eventAt = order.last_event_at;
        const dedupe = `${order.id}:silent:${eventAt}`;
        await insertRunIdempotente(supabase, {
            journey_id: j.id, client_id: j.client_id, device_id: order.device_id,
            current_step: 0, state: 'ativa',
            dedupe_key: dedupe, // coluna canônica
            context: {
                tracked_order_id: order.id,
                order_number: order.order_number,
                status: order.status,
                last_event_at: eventAt,
                silent_run: true,
                dedupe_key: dedupe,
            },
            next_step_at: new Date(Date.now() + delay0 * 60000).toISOString(),
        });
    }
}

function renderPushTemplate(push: any, context: Record<string, unknown>) {
    const variables: Record<string, string> = {
        pedido: String(context.order_number ?? ''),
        status: String(context.status ?? ''),
    };
    const render = (value: string) => Object.entries(variables)
        .reduce((text, [key, replacement]) => text.replaceAll(`{{${key}}}`, replacement), value);
    return { ...push, title: render(push.title), body: render(push.body) };
}

/** lease do claim de run: empurra next_step_at pra frente enquanto processa. */
const RUN_LEASE_MS = 5 * 60000;

/**
 * #7 CLAIM ATÔMICO: reivindica UMA run empurrando next_step_at pro futuro
 * (lease), só se ela ainda estiver devida. Dois ticks concorrentes: só um
 * update casa a condição `next_step_at <= agora` → o outro pega 0 linhas e
 * pula. Se a function morrer, o lease expira e outro tick reprocessa (no pior
 * caso 1 push repetido em crash — muito melhor que dup em CADA tick).
 */
async function reivindicarRun(supabase: any, runId: string, nextStepAt: string): Promise<boolean> {
    const lease = new Date(Date.now() + RUN_LEASE_MS).toISOString();
    const { data } = await supabase.from('journey_runs')
        .update({ next_step_at: lease })
        .eq('id', runId).eq('state', 'ativa').lte('next_step_at', nextStepAt)
        .select('id');
    return !!data && data.length > 0;
}

/** Executa passos vencidos de todas as runs ativas. */
async function executarPassosDevidos(supabase: any) {
    const agora = new Date().toISOString();
    const { data: devidas } = await supabase
        .from('journey_runs')
        .select('id, journey_id, client_id, device_id, current_step, context, next_step_at')
        .eq('state', 'ativa')
        .lte('next_step_at', agora)
        .limit(100);
    if (!devidas?.length) return { passos: 0 };

    let passos = 0;
    for (const run of devidas) {
        // reivindica antes de processar — perdeu a corrida, outro tick cuida
        const ganhou = await reivindicarRun(supabase, run.id, run.next_step_at);
        if (!ganhou) continue;
        const { data: j } = await supabase
            .from('journeys').select('id, app_id, active, definition')
            .eq('id', run.journey_id).maybeSingle();
        const def = j ? journeyDefinitionSchema.safeParse(j.definition) : null;
        if (!j?.active || !def?.success) {
            await supabase.from('journey_runs')
                .update({ state: 'erro', finished_at: new Date().toISOString() })
                .eq('id', run.id);
            continue;
        }

        if (run.context?.tracked_order_id) {
            const { data: tracked } = await supabase.from('tracked_orders')
                .select('status, last_event_at, delivered_at')
                .eq('id', run.context.tracked_order_id).maybeSingle();
            const staleSilent = run.context?.silent_run && (
                !tracked || tracked.delivered_at || tracked.last_event_at !== run.context.last_event_at
            );
            if (staleSilent) {
                await supabase.from('journey_runs')
                    .update({ state: 'saida', finished_at: new Date().toISOString() })
                    .eq('id', run.id);
                continue;
            }
        }

        const step = def.data.steps[run.current_step];
        if (!step) {
            await supabase.from('journey_runs')
                .update({ state: 'concluida', finished_at: new Date().toISOString() })
                .eq('id', run.id);
            continue;
        }

        const { data: device } = await supabase
            .from('app_devices')
            .select('id, client_id, expo_push_token, platform, shopify_customer_id, first_seen_at, last_seen_at, push_enabled')
            .eq('id', run.device_id).maybeSingle();

        // #11 exit_on='purchase': quem já comprou pelo app não recebe o resto
        // da jornada (boas-vindas/carrinho). 'delivery' já é tratado pelo
        // rastreio (status 'entregue' + saída do silent).
        if (def.data.exit_on === 'purchase' && device?.shopify_customer_id) {
            const { data: cli } = await supabase
                .from('app_customers').select('orders_app_count')
                .eq('client_id', run.client_id)
                .eq('shopify_customer_id', device.shopify_customer_id).maybeSingle();
            if (Number(cli?.orders_app_count ?? 0) > 0) {
                await supabase.from('journey_runs')
                    .update({ state: 'saida', finished_at: new Date().toISOString() })
                    .eq('id', run.id);
                continue;
            }
        }

        if (device?.push_enabled) {
            const push = renderPushTemplate(step.push, run.context ?? {});
            // rastreio é transacional (não conta cota); jornada de marketing sim (#9/#17)
            const rastreio = !!run.context?.tracked_order_id;
            const kind = rastreio ? 'rastreio' : 'jornada';

            let podeEnviar = true;
            if (!rastreio) {
                const { data: app } = await supabase
                    .from('store_apps').select('push_limits').eq('id', j.app_id).maybeSingle();
                const teto = Number(app?.push_limits?.max_marketing_per_day ?? 3);
                const { permitidos } = await aplicarTeto(supabase, [device as Device], teto);
                podeEnviar = permitidos.length > 0;
            }

            if (podeEnviar) {
                await enviar(supabase, run.client_id, [device as Device], push, kind, null, run.id);
                passos++;
            }
        }

        const proximo = def.data.steps[run.current_step + 1];
        await supabase.from('journey_runs').update(
            proximo
                ? {
                    current_step: run.current_step + 1,
                    next_step_at: new Date(Date.now() + proximo.delay_minutes * 60000).toISOString(),
                }
                : { state: 'concluida', finished_at: new Date().toISOString() },
        ).eq('id', run.id);
    }
    return { passos };
}

async function processarJornadas(supabase: any) {
    const { data: jornadas } = await supabase
        .from('journeys')
        .select('id, client_id, app_id, kind, definition, created_at')
        .eq('active', true)
        .limit(50);

    for (const j of jornadas ?? []) {
        const def = journeyDefinitionSchema.safeParse(j.definition);
        if (!def.success) continue;
        try {
            if (def.data.trigger.kind === 'install') {
                await abrirRunsDeInstall(supabase, j, def.data);
            } else if (def.data.trigger.kind === 'cart_abandoned') {
                await abrirRunsDeCarrinho(supabase, j, def.data);
            } else if (def.data.trigger.kind === 'order_status_changed') {
                await abrirRunsDeStatus(supabase, j, def.data);
            } else if (def.data.trigger.kind === 'order_silent') {
                await abrirRunsDeSilencio(supabase, j, def.data);
            }
        } catch (e: any) {
            console.error('[jornadas] abrir runs falhou', j.id, e.message);
        }
    }
    return executarPassosDevidos(supabase);
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
            const jornadas = await processarJornadas(supabase);
            return json(200, { tick: true, campanhas: resultados.length, resultados, jornadas });
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

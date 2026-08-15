// @ts-ignore
declare const Deno: any;

/**
 * app-shopify-webhooks — receiver dos webhooks do Módulo Apps Mobile.
 *
 * Tópicos registrados pelo app-link: orders/paid, refunds/create,
 * checkouts/create, checkouts/update, fulfillments/update,
 * fulfillment_events/create.
 *
 * Fluxo (rápido — Shopify tem timeout de 5s):
 *   1. HMAC com shopify_client_secret do cliente (resolvido pelo shop domain)
 *   2. dedup por X-Shopify-Webhook-Id em webhook_events
 *   3. persiste o evento bruto em webhook_events (auditoria/reprocesso)
 *   4. handler inline SÓ pro orders/paid (atribuição app_orders/app_customers);
 *      demais tópicos ficam persistidos pros motores das etapas E4/E6/E7
 *
 * Deploy com --no-verify-jwt (Shopify não manda JWT — o receiver legado
 * shopify-webhook-receiver está morto justamente por verify_jwt=true).
 */
import { instrument } from '../_shared/logger.ts';
import { z } from 'npm:zod@3.25.76';
import { normalizeTrackingStatus, trackingEventText } from '../_shared/tracking-status.ts';
import { validarAtribuicao } from '../_shared/attribution.ts';

const idSchema = z.union([z.string(), z.number()]).transform(String);
const fulfillmentSchema = z.object({
    id: idSchema.optional(),
    fulfillment_id: idSchema.optional(),
    order_id: idSchema.optional(),
    status: z.string().nullish(),
    shipment_status: z.string().nullish(),
    message: z.string().nullish(),
    tracking_number: z.string().nullish(),
    tracking_numbers: z.array(z.string()).nullish(),
    tracking_company: z.string().nullish(),
    updated_at: z.string().nullish(),
    created_at: z.string().nullish(),
    happened_at: z.string().nullish(),
}).passthrough();

async function getSupabase() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
}

/** #16 comparação constant-time — `===` de string vaza timing (early exit). */
function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false; // length do HMAC é fixo, não vaza
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function verifyShopifyHmac(body: string, hmacHeader: string, secret: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return constantTimeEqual(computed, hmacHeader);
}

/** orders/paid com token de atribuição ASSINADO vira pedido do app */
async function handleOrderPaid(supabase: any, clientId: string, payload: any) {
    const attrs: Array<{ name: string; value: string }> = payload?.note_attributes ?? [];
    const attr = (n: string) => attrs.find((a) => a?.name === n)?.value ?? null;

    const { data: app } = await supabase
        .from('store_apps').select('id').eq('client_id', clientId).maybeSingle();
    if (!app) return;

    // #13 atribuição ASSINADA: o cart attribute `app_source` é forjável por
    // qualquer visitante da storefront. Só um token HMAC válido (emitido pelo
    // register-device, vinculado a device+app+expiração) prova origem no app.
    const secret = Deno.env.get('ATTRIBUTION_SECRET');
    const token = attr('app_attribution');
    if (!secret || !token) return; // sem prova assinada → não é pedido do app
    const veredito = await validarAtribuicao(token, secret, Date.now());
    if (!veredito.valido || veredito.app_id !== app.id) return; // forjado/expirado/outro app

    // device do token, confirmado no banco (mesmo app + tenant)
    let deviceId: string | null = null;
    if (veredito.device_id) {
        const { data: validDevice } = await supabase.from('app_devices').select('id')
            .eq('id', veredito.device_id).eq('app_id', app.id).eq('client_id', clientId).maybeSingle();
        deviceId = validDevice?.id ?? null;
    }
    const customerId = payload?.customer?.id ? String(payload.customer.id) : null;
    const total = Number(payload?.current_total_price ?? payload?.total_price ?? 0);

    const { data: insertedOrder, error } = await supabase.from('app_orders').upsert({
        client_id: clientId,
        app_id: app.id,
        shopify_order_id: String(payload.id),
        order_number: String(payload?.name ?? payload?.order_number ?? ''),
        total,
        currency: String(payload?.currency ?? 'BRL'),
        financial_status: String(payload?.financial_status ?? ''),
        customer_shopify_id: customerId,
        device_id: deviceId,
        attributed_via: 'signed_token',
        paid_at: payload?.processed_at ?? new Date().toISOString(),
    }, { onConflict: 'client_id,shopify_order_id', ignoreDuplicates: true })
        .select('id')
        .maybeSingle();
    if (error) {
        console.error('[app-webhooks] app_orders upsert falhou', error.message);
        return;
    }

    // Outro receiver/reprocesso já registrou este pedido. Não incrementa o
    // agregado de CRM novamente.
    if (!insertedOrder) return;

    const confirmedAt = payload?.processed_at ?? new Date().toISOString();
    const { error: trackingError } = await supabase.from('tracked_orders').insert({
        client_id: clientId,
        shopify_order_id: String(payload.id),
        order_number: String(payload?.name ?? payload?.order_number ?? '').replace(/^#/, ''),
        status: 'confirmado',
        last_event_text: trackingEventText('confirmado'),
        last_event_at: confirmedAt,
        customer_shopify_id: customerId,
        device_id: deviceId,
    });
    if (trackingError && trackingError.code !== '23505') {
        console.error('[app-webhooks] tracked_orders insert falhou', trackingError.message);
    }

    if (customerId) {
        const display = [payload?.customer?.first_name, payload?.customer?.last_name]
            .filter(Boolean).join(' ');
        const { error: aggregateError } = await supabase.rpc('app_customer_add_order', {
            p_client_id: clientId,
            p_shopify_customer_id: customerId,
            p_display_name: display,
            p_email: payload?.customer?.email ?? '',
            p_total: total,
            p_order_at: payload?.processed_at ?? new Date().toISOString(),
        });
        if (aggregateError) {
            console.error('[app-webhooks] agregado do customer falhou', aggregateError.message);
        }
    }
}

async function findTrackedOrder(
    supabase: any,
    clientId: string,
    fulfillmentId: string | undefined,
    trackingNumber: string | null,
    orderId: string | undefined,
) {
    if (trackingNumber) {
        const { data } = await supabase.from('tracked_orders').select('id, last_event_at')
            .eq('client_id', clientId).eq('tracking_number', trackingNumber).limit(1).maybeSingle();
        if (data) return data;
    }
    if (fulfillmentId && !trackingNumber) {
        const { data } = await supabase.from('tracked_orders').select('id, last_event_at')
            .eq('client_id', clientId).eq('shopify_fulfillment_id', fulfillmentId).limit(1).maybeSingle();
        if (data) return data;
    }
    if (orderId) {
        const { data } = await supabase.from('tracked_orders').select('id, last_event_at')
            .eq('client_id', clientId).eq('shopify_order_id', orderId)
            .is('tracking_number', null).limit(1).maybeSingle();
        if (data) return data;
    }
    return null;
}

/** Atualiza apenas pedidos atribuídos ao app; pedido comum da loja não vaza pro app. */
async function handleFulfillment(supabase: any, clientId: string, rawPayload: unknown) {
    const parsed = fulfillmentSchema.safeParse(rawPayload);
    if (!parsed.success) {
        console.warn('[app-webhooks] fulfillment ignorado: payload inválido');
        return;
    }
    const payload = parsed.data;
    const fulfillmentId = payload.fulfillment_id ?? payload.id;
    const orderId = payload.order_id;
    const numbers = [...new Set([
        ...(payload.tracking_numbers ?? []),
        ...(payload.tracking_number ? [payload.tracking_number] : []),
    ].map((n) => n.trim()).filter(Boolean))];
    const trackingNumbers: Array<string | null> = numbers.length ? numbers : [null];

    let appOrder: any = null;
    if (orderId) {
        const { data } = await supabase.from('app_orders')
            .select('order_number, customer_shopify_id, device_id')
            .eq('client_id', clientId).eq('shopify_order_id', orderId).maybeSingle();
        appOrder = data;
    }

    // fulfillment_events/create pode não trazer order_id. Nesse caso só atualiza
    // um fulfillment já vinculado; jamais cria um pedido sem provar a atribuição.
    if (!appOrder && orderId) return;
    const inferred = normalizeTrackingStatus(payload.shipment_status ?? payload.status);
    // Shopify costuma mandar fulfillment.status="success" sem shipment_status
    // no primeiro post. A presença do código prova que já foi postado.
    const normalized = inferred === 'desconhecido' && numbers.length > 0 ? 'postado' : inferred;
    const eventAt = payload.happened_at ?? payload.updated_at ?? payload.created_at ?? new Date().toISOString();
    const eventText = payload.message?.trim() || trackingEventText(normalized);

    for (const trackingNumber of trackingNumbers) {
        const existing = await findTrackedOrder(supabase, clientId, fulfillmentId, trackingNumber, orderId);
        const values: Record<string, unknown> = {
            status: normalized,
            last_event_text: eventText,
            last_event_at: eventAt,
        };
        if (fulfillmentId) values.shopify_fulfillment_id = fulfillmentId;
        if (trackingNumber) values.tracking_number = trackingNumber;
        if (payload.tracking_company) values.carrier = payload.tracking_company;
        if (normalized === 'entregue') values.delivered_at = eventAt;
        if (existing) {
            if (existing.last_event_at && new Date(eventAt).getTime() <= new Date(existing.last_event_at).getTime()) {
                continue; // webhook atrasado/repetido não pode regredir o rastreio
            }
            const { error } = await supabase.from('tracked_orders').update(values).eq('id', existing.id);
            if (error) console.error('[app-webhooks] tracking update falhou', error.message);
            continue;
        }
        if (!appOrder || !orderId) continue;
        const { error } = await supabase.from('tracked_orders').insert({
            client_id: clientId,
            shopify_order_id: orderId,
            order_number: String(appOrder.order_number ?? '').replace(/^#/, ''),
            customer_shopify_id: appOrder.customer_shopify_id,
            device_id: appOrder.device_id,
            ...values,
        });
        if (error && error.code !== '23505') {
            console.error('[app-webhooks] tracking insert falhou', error.message);
        }
    }
}

Deno.serve(instrument('app-shopify-webhooks', async (req: Request) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const body = await req.text();
    const shopDomain = req.headers.get('x-shopify-shop-domain') ?? '';
    const topic = req.headers.get('x-shopify-topic') ?? '';
    const webhookId = req.headers.get('x-shopify-webhook-id') ?? '';
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') ?? '';
    if (!shopDomain || !topic || !hmacHeader) {
        return new Response('Missing required headers', { status: 400 });
    }

    const supabase = await getSupabase();
    const { data: client } = await supabase
        .from('agency_clients')
        .select('id, shopify_client_secret')
        .eq('shopify_domain', shopDomain)
        .maybeSingle();
    const secret = client?.shopify_client_secret || Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!client || !secret) {
        console.error('[app-webhooks] sem cliente/secret pra', shopDomain);
        return new Response('No secret configured', { status: 401 });
    }

    if (!(await verifyShopifyHmac(body, hmacHeader, secret))) {
        console.warn('[app-webhooks] HMAC inválido de', shopDomain, topic);
        return new Response('Invalid HMAC', { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(body); }
    catch { return new Response('Invalid JSON', { status: 400 }); }

    // #16 dedup ATÔMICO: o insert é o claim. Índice único (client_id, webhook_id)
    // → dois reenvios simultâneos, só o primeiro insere; o segundo pega 23505 e
    // é reconhecido como duplicado (sem reprocessar → sem dobrar atribuição).
    const { error: insertErr } = await supabase.from('webhook_events').insert({
        client_id: client.id,
        shop_domain: shopDomain,
        topic,
        webhook_id: webhookId || null,
        payload,
        processed: false,
    });
    if (insertErr) {
        if (insertErr.code === '23505') {
            return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
        }
        console.error('[app-webhooks] log falhou', insertErr.message);
    }

    try {
        if (topic === 'orders/paid') {
            await handleOrderPaid(supabase, client.id, payload);
        }
        if (topic === 'fulfillments/update' || topic === 'fulfillment_events/create') {
            await handleFulfillment(supabase, client.id, payload);
        }
        // checkouts/* alimentam o gatilho de carrinho abandonado (motor E4)
        // refunds/create alimenta estorno de cashback (motor E7)
        if (webhookId) {
            await supabase.from('webhook_events')
                .update({ processed: true, processed_at: new Date().toISOString() })
                .eq('webhook_id', webhookId);
        }
    } catch (e: any) {
        console.error('[app-webhooks] handler falhou', topic, e.message);
        // 200 mesmo assim: evento está persistido pra reprocesso; Shopify não precisa reenviar
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });
}));

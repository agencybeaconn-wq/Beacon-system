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

async function getSupabase() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
}

async function verifyShopifyHmac(body: string, hmacHeader: string, secret: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return computed === hmacHeader;
}

/** orders/paid com attributes[app_source]=beacon_app vira pedido do app */
async function handleOrderPaid(supabase: any, clientId: string, payload: any) {
    const attrs: Array<{ name: string; value: string }> = payload?.note_attributes ?? [];
    const attr = (n: string) => attrs.find((a) => a?.name === n)?.value ?? null;
    if (attr('app_source') !== 'beacon_app') return; // pedido do site, não é nosso

    const { data: app } = await supabase
        .from('store_apps').select('id').eq('client_id', clientId).maybeSingle();
    if (!app) return;

    const deviceId = attr('app_device');
    const customerId = payload?.customer?.id ? String(payload.customer.id) : null;
    const total = Number(payload?.current_total_price ?? payload?.total_price ?? 0);

    const { error } = await supabase.from('app_orders').upsert({
        client_id: clientId,
        app_id: app.id,
        shopify_order_id: String(payload.id),
        order_number: String(payload?.name ?? payload?.order_number ?? ''),
        total,
        currency: String(payload?.currency ?? 'BRL'),
        financial_status: String(payload?.financial_status ?? ''),
        customer_shopify_id: customerId,
        device_id: deviceId,
        attributed_via: 'cart_attribute',
        paid_at: payload?.processed_at ?? new Date().toISOString(),
    }, { onConflict: 'client_id,shopify_order_id', ignoreDuplicates: true });
    if (error) {
        console.error('[app-webhooks] app_orders upsert falhou', error.message);
        return;
    }

    if (customerId) {
        const display = [payload?.customer?.first_name, payload?.customer?.last_name]
            .filter(Boolean).join(' ');
        const { data: existing } = await supabase
            .from('app_customers').select('id, orders_app_count, total_spent_app')
            .eq('client_id', clientId).eq('shopify_customer_id', customerId).maybeSingle();
        if (existing) {
            await supabase.from('app_customers').update({
                display_name: display || undefined,
                email: payload?.customer?.email ?? undefined,
                orders_app_count: (existing.orders_app_count ?? 0) + 1,
                total_spent_app: Number(existing.total_spent_app ?? 0) + total,
                last_order_at: new Date().toISOString(),
            }).eq('id', existing.id);
        } else {
            await supabase.from('app_customers').insert({
                client_id: clientId,
                shopify_customer_id: customerId,
                display_name: display || null,
                email: payload?.customer?.email ?? null,
                orders_app_count: 1,
                total_spent_app: total,
                last_order_at: new Date().toISOString(),
            });
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

    // dedup — Shopify reenvia; o webhook_id é o idempotency key
    if (webhookId) {
        const { data: dup } = await supabase
            .from('webhook_events').select('id').eq('webhook_id', webhookId).limit(1).maybeSingle();
        if (dup) return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }

    const { error: insertErr } = await supabase.from('webhook_events').insert({
        client_id: client.id,
        shop_domain: shopDomain,
        topic,
        webhook_id: webhookId || null,
        payload,
        processed: false,
    });
    if (insertErr) console.error('[app-webhooks] log falhou', insertErr.message);

    try {
        if (topic === 'orders/paid') {
            await handleOrderPaid(supabase, client.id, payload);
        }
        // checkouts/* alimentam o gatilho de carrinho abandonado (motor E4)
        // fulfillments/* alimentam tracked_orders (motor E6)
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

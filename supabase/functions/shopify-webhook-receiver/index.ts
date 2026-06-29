// @ts-ignore
declare const Deno: any;

/**
 * Shopify Webhook Receiver — eventos reativos pros clientes (products, orders, collections).
 *
 * Diferente do `shopify-webhooks` (que lida com GDPR/compliance mandatory webhooks),
 * este receiver é pros topics OPT-IN do cliente:
 *
 *   - PRODUCTS_CREATE / PRODUCTS_UPDATE / PRODUCTS_DELETE
 *   - COLLECTIONS_UPDATE
 *   - ORDERS_PAID / ORDERS_CREATE
 *   - INVENTORY_LEVELS_UPDATE
 *
 * Fluxo:
 *   1. Valida HMAC com client_secret do cliente (ou env fallback)
 *   2. Insere na tabela webhook_events (dedup via X-Shopify-Webhook-Id)
 *   3. Opcionalmente, dispara ação imediata (ex: marcar cliente como dirty pra quality-gate)
 *   4. Retorna 200 rápido (Shopify tem timeout de 5s)
 *
 * URL de callback: https://<supabase>.functions.supabase.co/shopify-webhook-receiver
 */

async function verifyShopifyHmac(body: string, hmacHeader: string, secret: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return computedHmac === hmacHeader;
}

async function getSupabase() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    return createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
}

/**
 * Resolve client_id e shopify_client_secret pelo domínio do shop.
 * Retorna null se não encontrado.
 */
async function resolveClient(shopDomain: string) {
    const supabase = await getSupabase();
    const { data } = await supabase
        .from('agency_clients')
        .select('id, name, shopify_client_secret')
        .eq('shopify_domain', shopDomain)
        .limit(1)
        .single();
    return data;
}

import { instrument } from "../_shared/logger.ts";
Deno.serve(instrument("shopify-webhook-receiver", async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.text();
    const shopDomain = req.headers.get('x-shopify-shop-domain') || '';
    const topic = req.headers.get('x-shopify-topic') || '';
    const webhookId = req.headers.get('x-shopify-webhook-id') || '';
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';

    if (!shopDomain || !topic || !hmacHeader) {
        return new Response('Missing required headers', { status: 400 });
    }

    // Resolve client + secret
    const client = await resolveClient(shopDomain);
    const secret = client?.shopify_client_secret || Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!secret) {
        console.error('[webhook-receiver] No secret for', shopDomain);
        return new Response('No secret configured', { status: 401 });
    }

    // Verify HMAC
    const valid = await verifyShopifyHmac(body, hmacHeader, secret);
    if (!valid) {
        console.warn('[webhook-receiver] Invalid HMAC from', shopDomain);
        return new Response('Invalid HMAC', { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(body); }
    catch { return new Response('Invalid JSON', { status: 400 }); }

    // Dedup por webhook_id
    const supabase = await getSupabase();
    if (webhookId) {
        const { data: existing } = await supabase
            .from('webhook_events')
            .select('id')
            .eq('webhook_id', webhookId)
            .limit(1)
            .maybeSingle();
        if (existing) {
            return new Response(JSON.stringify({ ok: true, duplicate: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    // Persist
    const { error } = await supabase.from('webhook_events').insert({
        client_id: client?.id || null,
        shop_domain: shopDomain,
        topic,
        webhook_id: webhookId || null,
        payload,
    });

    if (error) {
        console.error('[webhook-receiver] Insert error:', error);
        return new Response('DB error', { status: 500 });
    }

    // Ação opcional: determinados topics disparam reação imediata
    // (por ora só log — a Fase 6g adiciona o quality-gate hook)
    if (topic.startsWith('products/') || topic.startsWith('collections/')) {
        console.log(`[webhook-receiver] Catalog change on ${shopDomain}: ${topic}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}));

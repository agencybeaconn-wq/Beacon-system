// @ts-ignore
declare const Deno: any;

/**
 * Shopify Mandatory Compliance Webhooks
 * 
 * Handles the 3 required GDPR/compliance webhooks:
 * - customers/data_request  → Report what customer data we store
 * - customers/redact        → Delete customer data
 * - shop/redact             → Delete all shop data after uninstall
 * 
 * HMAC verification is applied to all incoming requests.
 * 
 * Usage: Configure these URLs in the Shopify Partner Dashboard:
 *   https://<SUPABASE_URL>/functions/v1/shopify-webhooks?topic=customers/data_request
 *   https://<SUPABASE_URL>/functions/v1/shopify-webhooks?topic=customers/redact
 *   https://<SUPABASE_URL>/functions/v1/shopify-webhooks?topic=shop/redact
 */

// ─── HMAC Verification ───────────────────────────────────────────────────

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

// ─── Handlers ─────────────────────────────────────────────────────────────

function handleCustomersDataRequest(payload: any) {
    // The Lever System does NOT store personal customer data from Shopify stores.
    // We only store product/variant information (titles, prices, SKUs).
    // Therefore, there is no customer data to report.
    console.log('[shopify-webhooks] customers/data_request received for shop:', payload.shop_domain);
    console.log('[shopify-webhooks] No customer data stored — nothing to report.');

    return new Response(JSON.stringify({
        message: 'No customer data is stored by this application. Only product catalog data is used.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function handleCustomersRedact(payload: any) {
    // No customer data to delete — we only work with product catalog data.
    console.log('[shopify-webhooks] customers/redact received for shop:', payload.shop_domain);
    console.log('[shopify-webhooks] Customer:', payload.customer?.email || 'unknown');
    console.log('[shopify-webhooks] No customer data stored — nothing to delete.');

    return new Response(JSON.stringify({
        message: 'No customer data is stored by this application. Request acknowledged.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleShopRedact(payload: any) {
    // When a shop uninstalls the app, we should clean up the stored access token.
    const shopDomain = payload.shop_domain;
    console.log('[shopify-webhooks] shop/redact received for shop:', shopDomain);

    try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Clear Shopify credentials for this shop
        const { error } = await supabase
            .from('agency_clients')
            .update({
                shopify_access_token: null,
                shopify_status: 'disconnected',
            })
            .eq('shopify_domain', shopDomain);

        if (error) {
            console.error('[shopify-webhooks] Error cleaning up shop data:', error);
        } else {
            console.log('[shopify-webhooks] Successfully cleared Shopify data for', shopDomain);
        }
    } catch (err) {
        console.error('[shopify-webhooks] Exception during shop/redact:', err);
    }

    return new Response(JSON.stringify({
        message: 'Shop data has been redacted successfully.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ─── Main Handler ─────────────────────────────────────────────────────────

import { instrument } from "../_shared/logger.ts";
Deno.serve(instrument("shopify-webhooks", async (req: Request) => {
    // Only accept POST
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    // Read body first so we can extract shop_domain
    const body = await req.text();

    // Try to find per-client secret from database based on shop domain
    let secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    try {
        const shopDomain = req.headers.get('x-shopify-shop-domain') || '';
        if (shopDomain) {
            const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            );
            const { data: client } = await supabase
                .from('agency_clients')
                .select('shopify_client_secret')
                .eq('shopify_domain', shopDomain)
                .not('shopify_client_secret', 'is', null)
                .limit(1)
                .single();
            if (client?.shopify_client_secret) {
                secret = client.shopify_client_secret;
            }
        }
    } catch { /* fallback to env var */ }

    if (!secret) {
        console.error('[shopify-webhooks] No Shopify client secret found');
        return new Response('Server configuration error', { status: 500 });
    }

    // Verify HMAC signature
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';
    if (!hmacHeader) {
        console.warn('[shopify-webhooks] Missing HMAC header');
        return new Response('Unauthorized — missing HMAC', { status: 401 });
    }

    const isValid = await verifyShopifyHmac(body, hmacHeader, secret);
    if (!isValid) {
        console.warn('[shopify-webhooks] Invalid HMAC signature');
        return new Response('Unauthorized — invalid HMAC', { status: 401 });
    }

    // Parse payload
    let payload: any;
    try {
        payload = JSON.parse(body);
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    // Determine which topic this is
    // Shopify sends the topic via the X-Shopify-Topic header
    const topic = req.headers.get('x-shopify-topic')
        || new URL(req.url).searchParams.get('topic')
        || '';

    console.log(`[shopify-webhooks] Received topic: "${topic}" from shop: ${payload.shop_domain || 'unknown'}`);

    switch (topic) {
        case 'customers/data_request':
            return handleCustomersDataRequest(payload);

        case 'customers/redact':
            return handleCustomersRedact(payload);

        case 'shop/redact':
            return await handleShopRedact(payload);

        default:
            console.warn('[shopify-webhooks] Unknown topic:', topic);
            return new Response(JSON.stringify({ error: `Unknown topic: ${topic}` }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
    }
}));

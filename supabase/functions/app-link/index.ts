// @ts-ignore
declare const Deno: any;

/**
 * app-link — vínculo 1-clique do app white-label (Módulo Apps Mobile).
 *
 * POST { client_id, bundle_id, app_name }  (JWT obrigatório; só staff)
 *  1. valida caller (team_members agency ativo OU dono do workspace do cliente)
 *  2. upsert store_apps com config default VÁLIDO (appConfigSchema)
 *  3. registra webhooks na Shopify do cliente via Admin GraphQL (idempotente:
 *     pula tópico que já aponta pro nosso receiver) e grava webhook_subscriptions
 *  → { app_id, webhooks: [{topic, status}] }
 *
 * O receiver dos webhooks é a function app-shopify-webhooks (HMAC + dedup).
 */
import { instrument } from '../_shared/logger.ts';
import { corsHeaders } from '../_shared/cors.ts';

const WEBHOOK_TOPICS = [
    'ORDERS_PAID',
    'REFUNDS_CREATE',
    'CHECKOUTS_CREATE',
    'CHECKOUTS_UPDATE',
    'FULFILLMENTS_UPDATE',
    'FULFILLMENT_EVENTS_CREATE',
];

const API_VERSION = '2025-07';

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

async function getClients() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const url = Deno.env.get('SUPABASE_URL')!;
    return {
        service: createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
        url,
    };
}

async function shopifyGraphql(domain: string, token: string, query: string, variables: Record<string, unknown>) {
    const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
    const data = await res.json();
    if (data.errors?.length) throw new Error(`Shopify GraphQL: ${JSON.stringify(data.errors).slice(0, 300)}`);
    return data.data;
}

Deno.serve(instrument('app-link', async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const { service, url } = await getClients();

    // ── autenticação + autorização (staff) ─────────────────────────────────
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userData, error: userErr } = await service.auth.getUser(jwt);
    if (userErr || !userData?.user) return json(401, { error: 'não autenticado' });
    const user = userData.user;

    let body: any;
    try { body = await req.json(); } catch { return json(400, { error: 'JSON inválido' }); }
    const clientId = String(body?.client_id ?? '');
    const bundleId = String(body?.bundle_id ?? '').trim();
    const appName = String(body?.app_name ?? '').trim();
    if (!clientId || !appName || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(bundleId)) {
        return json(400, { error: 'client_id, app_name e bundle_id (formato com.exemplo.app) são obrigatórios' });
    }

    const { data: clientRow } = await service
        .from('agency_clients')
        .select('id, name, workspace_id, shopify_domain, shopify_access_token, shopify_client_secret, shopify_status')
        .eq('id', clientId)
        .maybeSingle();
    if (!clientRow) return json(404, { error: 'cliente não encontrado' });

    const [{ data: staffRows }, { data: ownerRows }] = await Promise.all([
        service.from('team_members').select('id')
            .ilike('email', user.email ?? '')
            .eq('status', 'active').eq('user_type', 'agency').limit(1),
        service.from('workspaces').select('id')
            .eq('id', clientRow.workspace_id).eq('owner_id', user.id).limit(1),
    ]);
    if (!staffRows?.length && !ownerRows?.length) {
        return json(403, { error: 'apenas staff da agência pode vincular apps' });
    }

    if (!clientRow.shopify_domain || !clientRow.shopify_access_token) {
        return json(422, { error: 'cliente sem Shopify conectada — conecte a loja antes de vincular o app' });
    }

    // ── upsert store_apps com config default válido ─────────────────────────
    const defaultConfig = {
        version: 1,
        store_url: `https://${clientRow.shopify_domain}`,
        theme: { accent: '#18181b', background: '#fafafa', foreground: '#18181b', logo_url: null },
        splash: { background: '#fafafa', logo_url: null, duration_ms: 1200 },
        tabs: [
            { key: 'home', label: 'Início', kind: 'webview', path: '/', icon: 'home' },
            { key: 'novidades', label: 'Novidades', kind: 'webview', path: '/collections/all', icon: 'sparkles' },
            { key: 'carrinho', label: 'Carrinho', kind: 'webview', path: '/cart', icon: 'cart' },
            { key: 'rastreio', label: 'Rastreio', kind: 'native', screen: 'rastreio', icon: 'package' },
            { key: 'conta', label: 'Conta', kind: 'webview', path: '/account', icon: 'user' },
        ],
        home_banners: [],
        features: { cashback: false, rastreio: true },
    };

    const { data: existingApp } = await service
        .from('store_apps').select('id, config').eq('client_id', clientId).maybeSingle();

    let appId: string;
    if (existingApp) {
        appId = existingApp.id;
        const keepConfig = existingApp.config && Object.keys(existingApp.config).length > 0;
        const { error } = await service.from('store_apps')
            .update({ bundle_id: bundleId, app_name: appName, ...(keepConfig ? {} : { config: defaultConfig }) })
            .eq('id', appId);
        if (error) return json(500, { error: `falha ao atualizar app: ${error.message}` });
    } else {
        const { data: created, error } = await service.from('store_apps')
            .insert({ client_id: clientId, bundle_id: bundleId, app_name: appName, config: defaultConfig })
            .select('id').single();
        if (error || !created) return json(500, { error: `falha ao criar app: ${error?.message}` });
        appId = created.id;
    }

    // ── webhooks na Shopify (idempotente) ───────────────────────────────────
    const callbackUrl = `${url}/functions/v1/app-shopify-webhooks`;
    const results: Array<{ topic: string; status: string }> = [];

    try {
        const existing = await shopifyGraphql(
            clientRow.shopify_domain, clientRow.shopify_access_token,
            `query { webhookSubscriptions(first: 100) { nodes { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } } }`,
            {},
        );
        const already = new Set(
            (existing.webhookSubscriptions?.nodes ?? [])
                .filter((n: any) => n.endpoint?.callbackUrl === callbackUrl)
                .map((n: any) => n.topic),
        );

        for (const topic of WEBHOOK_TOPICS) {
            if (already.has(topic)) { results.push({ topic, status: 'ja_existia' }); continue; }
            try {
                const created = await shopifyGraphql(
                    clientRow.shopify_domain, clientRow.shopify_access_token,
                    `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
                       webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
                         webhookSubscription { id }
                         userErrors { field message }
                       }
                     }`,
                    { topic, sub: { callbackUrl, format: 'JSON' } },
                );
                const errs = created.webhookSubscriptionCreate?.userErrors ?? [];
                if (errs.length) {
                    results.push({ topic, status: `erro: ${errs[0].message}` });
                    continue;
                }
                const subId = created.webhookSubscriptionCreate?.webhookSubscription?.id ?? '';
                await service.from('webhook_subscriptions').upsert({
                    client_id: clientId, topic,
                    shopify_subscription_id: subId, callback_url: callbackUrl,
                    format: 'JSON', enabled: true,
                }, { onConflict: 'client_id,topic' });
                results.push({ topic, status: 'criado' });
            } catch (e: any) {
                results.push({ topic, status: `erro: ${String(e.message).slice(0, 160)}` });
            }
        }
    } catch (e: any) {
        return json(502, { error: `app criado (${appId}) mas falha ao listar webhooks na Shopify: ${String(e.message).slice(0, 200)}`, app_id: appId });
    }

    return json(200, { app_id: appId, webhooks: results });
}));

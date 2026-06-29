import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'

// @ts-ignore
declare const Deno: any;

// Schema do payload. `resource` e `method` viram parte da URL — sem allowlist permite path traversal
// e methods inesperados. payload/params são genéricos porque o proxy é generalista (validação fina
// vive nas chamadas Shopify do outro lado).
const proxySchema = z.object({
    clientId: z.string().uuid().optional(),
    resource: z.enum([
        'products', 'custom_collections', 'smart_collections', 'pages', 'menus',
        'themes', 'blogs', 'articles', 'redirects', 'orders', 'shop',
        'collects', 'inventory_levels', 'locations', 'variants',
    ]),
    method: z.enum([
        'list', 'get', 'create', 'update', 'delete',
        'list_all', 'list_assets', 'get_asset', 'put_asset', 'delete_asset',
        'list_prices', 'graphql',
    ]).default('list'),
    resourceId: z.union([z.string(), z.number()]).optional().nullable(),
    payload: z.record(z.unknown()).optional().nullable(),
    params: z.record(z.unknown()).optional().nullable(),
})

// Whitelist de origens permitidas. Endpoint expõe JWT do usuário em headers — sem whitelist, qualquer site malicioso pode invocar.
const ALLOWED_ORIGINS = [
    'https://app.leverag.digital',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
];

function buildCorsHeaders(origin: string | null) {
    // Echo o origin se for permitido; caso contrário fallback pra produção (browser nega cross-origin).
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    };
}

const API_VERSION = '2026-01'

async function getCredentials(clientId?: string) {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (clientId) {
        const { data: client } = await supabase
            .from('agency_clients')
            .select('shopify_domain, shopify_access_token')
            .eq('id', clientId)
            .eq('shopify_status', 'connected')
            .not('shopify_access_token', 'is', null)
            .single();

        if (client?.shopify_access_token) {
            return { shop: client.shopify_domain, token: client.shopify_access_token };
        }
    }

    throw new Error('Shopify credentials not found for this client.');
}

Deno.serve(instrument("shopify-admin-proxy", async (req: Request) => {
    const corsHeaders = buildCorsHeaders(req.headers.get('origin'));

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const rawBody = await req.json();
        const parsed = proxySchema.safeParse(rawBody);
        if (!parsed.success) {
            console.error('[shopify-admin-proxy] Payload inválido:', parsed.error.flatten());
            return new Response(JSON.stringify({
                error: 'Payload inválido',
                details: parsed.error.flatten(),
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const { clientId, resource, method, resourceId, payload, params } = parsed.data;

        const { shop, token } = await getCredentials(clientId);
        const baseUrl = `https://${shop}/admin/api/${API_VERSION}`;
        const headers: Record<string, string> = {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
        };

        let url = '';
        let fetchMethod = 'GET';
        let fetchBody: string | undefined;

        switch (method || 'list') {
            case 'list': {
                const queryParams = new URLSearchParams();
                queryParams.set('limit', '250');
                if (params) {
                    for (const [k, v] of Object.entries(params)) {
                        queryParams.set(k, String(v));
                    }
                }
                url = `${baseUrl}/${resource}.json?${queryParams}`;
                break;
            }
            case 'get': {
                if (!resourceId) throw new Error('resourceId required for get');
                url = `${baseUrl}/${resource}/${resourceId}.json`;
                break;
            }
            case 'create': {
                url = `${baseUrl}/${resource}.json`;
                fetchMethod = 'POST';
                fetchBody = JSON.stringify(payload);
                break;
            }
            case 'update': {
                if (!resourceId) throw new Error('resourceId required for update');
                url = `${baseUrl}/${resource}/${resourceId}.json`;
                fetchMethod = 'PUT';
                fetchBody = JSON.stringify(payload);
                break;
            }
            case 'delete': {
                if (!resourceId) throw new Error('resourceId required for delete');
                url = `${baseUrl}/${resource}/${resourceId}.json`;
                fetchMethod = 'DELETE';
                break;
            }
            // Special: list all with pagination
            case 'list_all': {
                const allItems: any[] = [];
                let pageInfo: string | null = null;
                let hasMore = true;

                while (hasMore) {
                    let pageUrl: string;
                    if (pageInfo) {
                        pageUrl = `${baseUrl}/${resource}.json?limit=250&page_info=${pageInfo}`;
                    } else {
                        const qp = new URLSearchParams();
                        qp.set('limit', '250');
                        if (params) {
                            for (const [k, v] of Object.entries(params)) qp.set(k, String(v));
                        }
                        pageUrl = `${baseUrl}/${resource}.json?${qp}`;
                    }

                    const res = await fetch(pageUrl, { headers });
                    if (!res.ok) {
                        let errData;
                        try { errData = await res.json(); } catch { errData = { error: res.statusText }; }
                        throw new Error(`Shopify API error ${res.status}: ${JSON.stringify(errData)}`);
                    }

                    const data = await res.json();
                    const key = Object.keys(data)[0]; // 'products', 'custom_collections', etc.
                    allItems.push(...(data[key] || []));

                    const linkHeader = res.headers.get('Link') || '';
                    const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
                    if (nextMatch) {
                        pageInfo = nextMatch[1];
                    } else {
                        hasMore = false;
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    data: allItems,
                    count: allItems.length,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            // Special: theme assets
            case 'list_assets': {
                if (!resourceId) throw new Error('themeId required');
                url = `${baseUrl}/themes/${resourceId}/assets.json`;
                break;
            }
            case 'get_asset': {
                if (!resourceId || !params?.key) throw new Error('themeId and key required');
                url = `${baseUrl}/themes/${resourceId}/assets.json?asset[key]=${encodeURIComponent(params.key)}`;
                break;
            }
            case 'put_asset': {
                if (!resourceId) throw new Error('themeId required');
                url = `${baseUrl}/themes/${resourceId}/assets.json`;
                fetchMethod = 'PUT';
                fetchBody = JSON.stringify(payload);
                break;
            }
            case 'delete_asset': {
                if (!resourceId || !params?.key) throw new Error('themeId and key required');
                url = `${baseUrl}/themes/${resourceId}/assets.json?asset[key]=${encodeURIComponent(params.key)}`;
                fetchMethod = 'DELETE';
                break;
            }
            // Special: list products with only pricing-relevant fields (compact for Claude context)
            case 'list_prices': {
                const allProducts: any[] = [];
                let pageInfo: string | null = null;
                let hasMore = true;

                while (hasMore) {
                    const pageUrl = pageInfo
                        ? `${baseUrl}/products.json?limit=250&fields=handle,title,variants&page_info=${pageInfo}`
                        : `${baseUrl}/products.json?limit=250&fields=handle,title,variants`;

                    const res = await fetch(pageUrl, { headers });
                    if (!res.ok) {
                        const e = await res.json();
                        throw new Error(`Shopify ${res.status}: ${JSON.stringify(e)}`);
                    }
                    const data = await res.json();
                    allProducts.push(...(data.products || []));

                    const link = res.headers.get('Link') || '';
                    const next = link.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
                    hasMore = !!next;
                    if (next) pageInfo = next[1];
                }

                const compact = allProducts.map((p: any) => ({
                    handle: p.handle,
                    title: p.title,
                    variants: (p.variants || []).map((v: any) => ({
                        option1: v.option1,
                        option2: v.option2,
                        option3: v.option3,
                        price: v.price,
                        compare_at_price: v.compare_at_price,
                        sku: v.sku,
                    })),
                }));

                return new Response(JSON.stringify({ success: true, data: compact, count: compact.length }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            // GraphQL query for resources not available via REST (menus, metaobjects, etc.)
            case 'graphql': {
                const gqlUrl = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
                const gqlRes = await fetch(gqlUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: payload?.query, variables: payload?.variables }),
                });
                const gqlData = await gqlRes.json();
                if (gqlData.errors) {
                    return new Response(JSON.stringify({ error: gqlData.errors }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
                return new Response(JSON.stringify({ success: true, data: gqlData.data }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            default:
                throw new Error(`Unknown method: ${method}`);
        }

        const res = await fetch(url, {
            method: fetchMethod,
            headers,
            body: fetchBody,
        });

        const data = await res.json();

        if (!res.ok) {
            return new Response(JSON.stringify({ error: data, status: res.status }), {
                status: res.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Shopify admin proxy error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}));

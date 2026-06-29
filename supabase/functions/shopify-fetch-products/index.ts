import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_VERSION = '2026-01'

async function getCredentials(clientId?: string) {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // If clientId is provided, look up that specific client
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

    // Fallback: use env var domain to find any connected client
    const shop = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    if (shop) {
        const { data: clients } = await supabase
            .from('agency_clients')
            .select('shopify_domain, shopify_access_token')
            .eq('shopify_domain', shop)
            .eq('shopify_status', 'connected')
            .not('shopify_access_token', 'is', null)
            .limit(1);

        const client = clients?.[0];
        if (client?.shopify_access_token) {
            return { shop: client.shopify_domain, token: client.shopify_access_token };
        }
    }

    throw new Error('Shopify credentials not found.');
}

/** Convert Shopify API products to CSV-like rows (same format as Shopify CSV export) */
function productsToCSVRows(products: any[]) {
    const rows: Record<string, string>[] = [];

    for (const product of products) {
        const options = product.options || [];
        const variants = product.variants || [];
        const images = product.images || [];

        for (let vi = 0; vi < Math.max(variants.length, 1); vi++) {
            const variant = variants[vi] || {};
            const isFirstRow = vi === 0;
            const image = images.find((img: any) => img.id === variant.image_id) || (isFirstRow ? images[0] : null);

            const row: Record<string, string> = {
                'Handle': isFirstRow ? product.handle || '' : '',
                'Title': isFirstRow ? product.title || '' : '',
                'Body (HTML)': isFirstRow ? product.body_html || '' : '',
                'Vendor': isFirstRow ? product.vendor || '' : '',
                'Type': isFirstRow ? product.product_type || '' : '',
                'Tags': isFirstRow ? product.tags || '' : '',
                'Published': isFirstRow ? (product.status === 'active' ? 'TRUE' : 'FALSE') : '',
                'Status': isFirstRow ? product.status || '' : '',
                'Option1 Name': isFirstRow && options[0] ? options[0].name : '',
                'Option1 Value': variant.option1 || '',
                'Option2 Name': isFirstRow && options[1] ? options[1].name : '',
                'Option2 Value': variant.option2 || '',
                'Option3 Name': isFirstRow && options[2] ? options[2].name : '',
                'Option3 Value': variant.option3 || '',
                'Variant SKU': variant.sku || '',
                'Variant Grams': variant.grams?.toString() || '',
                'Variant Inventory Qty': '',
                'Variant Price': variant.price || '',
                'Variant Compare At Price': variant.compare_at_price || '',
                'Variant Weight Unit': variant.weight_unit || '',
                'Variant Barcode': variant.barcode || '',
                'Image Src': image?.src || '',
                'Image Position': image ? String(images.indexOf(image) + 1) : '',
                'Image Alt Text': image?.alt || '',
                'Variant Image': variant.image_id ? (images.find((i: any) => i.id === variant.image_id)?.src || '') : '',
                'SEO Title': isFirstRow ? product.metafields_global_title_tag || '' : '',
                'SEO Description': isFirstRow ? product.metafields_global_description_tag || '' : '',
            };

            rows.push(row);
        }
    }

    return rows;
}

Deno.serve(instrument("shopify-fetch-products", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parse clientId from request body
        let clientId: string | undefined;
        try {
            const body = await req.json();
            clientId = body.clientId;
        } catch { /* no body */ }

        const { shop, token } = await getCredentials(clientId);
        const baseUrl = `https://${shop}/admin/api/${API_VERSION}`;
        const headers = {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
        };

        // Fetch all products with pagination
        const allProducts: any[] = [];
        let pageInfo: string | null = null;
        let hasMore = true;

        while (hasMore) {
            let url: string;
            if (pageInfo) {
                url = `${baseUrl}/products.json?limit=250&page_info=${pageInfo}`;
            } else {
                url = `${baseUrl}/products.json?limit=250`;
            }

            const res = await fetch(url, { headers });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(`Shopify API error ${res.status}: ${JSON.stringify(errData)}`);
            }

            const data = await res.json();
            allProducts.push(...(data.products || []));

            // Check for next page via Link header
            const linkHeader = res.headers.get('Link') || '';
            const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);

            if (nextMatch) {
                pageInfo = nextMatch[1];
            } else {
                hasMore = false;
            }
        }

        // Convert to CSV-like rows
        const rows = productsToCSVRows(allProducts);

        return new Response(JSON.stringify({
            success: true,
            productCount: allProducts.length,
            rows,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Shopify fetch products error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
}))

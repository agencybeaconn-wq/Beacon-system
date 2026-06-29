import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_VERSION = '2026-01'

interface HandleChange {
    handle: string;
    productFields: Record<string, string>;
    variants: Record<string, string>[];
}

interface BulkUpdateRequest {
    clientId?: string;
    changes: HandleChange[];
}

/** Map CSV field names to Shopify API field names */
const PRODUCT_FIELD_MAP: Record<string, string> = {
    'Title': 'title',
    'Body (HTML)': 'body_html',
    'Tags': 'tags',
    'Vendor': 'vendor',
    'Type': 'product_type',
    'SEO Title': 'metafields_global_title_tag',
    'SEO Description': 'metafields_global_description_tag',
    'Status': 'status',
};

const VARIANT_FIELD_MAP: Record<string, string> = {
    'Variant Price': 'price',
    'Variant Compare At Price': 'compare_at_price',
    'Variant SKU': 'sku',
    'Variant Grams': 'grams',
    'Variant Weight Unit': 'weight_unit',
    'Variant Barcode': 'barcode',
    'Option1 Value': 'option1',
    'Option2 Value': 'option2',
    'Option3 Value': 'option3',
};

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
            .single();

        if (client?.shopify_access_token) {
            return { shop: client.shopify_domain, token: client.shopify_access_token };
        }
    }

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

    throw new Error('Shopify credentials not found. Connect a store via OAuth first.');
}

function buildProductPayload(change: HandleChange) {
    const product: any = { handle: change.handle };

    // Map product-level fields
    for (const [csvField, value] of Object.entries(change.productFields)) {
        const apiField = PRODUCT_FIELD_MAP[csvField];
        if (apiField) product[apiField] = value;
    }

    // Build options from Option1/2/3 Name
    const options: { name: string }[] = [];
    for (let i = 1; i <= 3; i++) {
        const optName = change.productFields[`Option${i} Name`];
        if (optName) options.push({ name: optName });
    }
    if (options.length > 0) product.options = options;

    // Build variants
    if (change.variants?.length > 0) {
        product.variants = change.variants.map(v => {
            const variant: any = {};
            for (const [csvField, value] of Object.entries(v)) {
                const apiField = VARIANT_FIELD_MAP[csvField];
                if (apiField) variant[apiField] = value;
            }
            return variant;
        });
    }

    // Handle images from productFields
    const imageSrc = change.productFields['Image Src'];
    if (imageSrc) {
        product.images = [{ src: imageSrc }];
    }

    return product;
}

Deno.serve(instrument("shopify-bulk-update", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { clientId, changes } = await req.json() as BulkUpdateRequest;

        if (!changes?.length) {
            return new Response(JSON.stringify({ error: 'changes array is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { shop, token } = await getCredentials(clientId);
        const baseUrl = `https://${shop}/admin/api/${API_VERSION}`;
        const headers = {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
        };

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];
        let productsCreated = 0;
        let productsUpdated = 0;
        let variantsUpdated = 0;

        for (const change of changes) {
            try {
                // Try to find existing product by handle
                const searchRes = await fetch(
                    `${baseUrl}/products.json?handle=${encodeURIComponent(change.handle)}&fields=id,handle,variants,options`,
                    { headers }
                );

                let existingProduct = null;
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    existingProduct = searchData.products?.[0];
                }

                if (existingProduct) {
                    // ── UPDATE existing product ──
                    const productId = existingProduct.id;
                    const updatePayload: any = { id: productId };

                    // Map product-level fields
                    for (const [csvField, value] of Object.entries(change.productFields)) {
                        const apiField = PRODUCT_FIELD_MAP[csvField];
                        if (apiField) updatePayload[apiField] = value;
                    }

                    // Handle option name updates
                    const optionNameUpdates: Record<number, string> = {};
                    for (let i = 1; i <= 3; i++) {
                        const name = change.productFields[`Option${i} Name`];
                        if (name) optionNameUpdates[i] = name;
                    }
                    if (Object.keys(optionNameUpdates).length > 0 && existingProduct.options) {
                        updatePayload.options = existingProduct.options.map((opt: any, idx: number) => ({
                            ...opt,
                            name: optionNameUpdates[idx + 1] ?? opt.name,
                        }));
                    }

                    const updateRes = await fetch(`${baseUrl}/products/${productId}.json`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({ product: updatePayload }),
                    });

                    if (updateRes.ok) {
                        productsUpdated++;
                        successCount++;
                    } else {
                        const errData = await updateRes.json();
                        errorCount++;
                        errors.push(`Update "${change.handle}": ${JSON.stringify(errData.errors || errData)}`);
                        continue;
                    }

                    // Update variants by matching option combos
                    if (change.variants?.length > 0) {
                        // Refetch product to get updated variant IDs
                        const refetchRes = await fetch(`${baseUrl}/products/${productId}.json?fields=variants`, { headers });
                        const refetchData = await refetchRes.json();
                        const currentVariants = refetchData.product?.variants || [];

                        for (const csvVariant of change.variants) {
                            const opts = [csvVariant['Option1 Value'], csvVariant['Option2 Value'], csvVariant['Option3 Value']].filter(Boolean);
                            const match = currentVariants.find((v: any) => {
                                const vOpts = [v.option1, v.option2, v.option3].filter(Boolean);
                                return opts.every((o, i) => vOpts[i] === o);
                            });

                            if (match) {
                                const mapped: any = { id: match.id };
                                for (const [csvField, value] of Object.entries(csvVariant)) {
                                    const apiField = VARIANT_FIELD_MAP[csvField];
                                    if (apiField && !apiField.startsWith('option')) mapped[apiField] = value;
                                }
                                if (Object.keys(mapped).length > 1) {
                                    const vRes = await fetch(`${baseUrl}/variants/${match.id}.json`, {
                                        method: 'PUT',
                                        headers,
                                        body: JSON.stringify({ variant: mapped }),
                                    });
                                    if (vRes.ok) {
                                        variantsUpdated++;
                                    } else {
                                        const vErr = await vRes.json();
                                        errors.push(`Variant "${change.handle}" [${opts.join('/')}]: ${JSON.stringify(vErr.errors || vErr)}`);
                                    }
                                }
                            }
                        }
                    }

                } else {
                    // ── CREATE new product ──
                    const productPayload = buildProductPayload(change);

                    const createRes = await fetch(`${baseUrl}/products.json`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ product: productPayload }),
                    });

                    if (createRes.ok) {
                        productsCreated++;
                        successCount++;
                    } else {
                        const errData = await createRes.json();
                        errorCount++;
                        errors.push(`Create "${change.handle}": ${JSON.stringify(errData.errors || errData)}`);
                    }
                }

            } catch (e: any) {
                errorCount++;
                errors.push(`"${change.handle}": ${e.message}`);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            summary: {
                totalHandles: changes.length,
                productsCreated,
                productsUpdated,
                variantsUpdated,
                successCount,
                errorCount,
                errors: errors.slice(0, 20),
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Shopify bulk update error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
}))

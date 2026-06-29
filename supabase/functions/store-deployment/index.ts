import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_VERSION = '2026-01'

// Validação base do payload. Função é polimórfica (4 actions diferentes), então só
// engessa o que é comum: action enum + UUIDs. Cada handler valida seu próprio formato.
const baseSchema = z.object({
    action: z.enum(['extract', 'transform', 'deploy_step', 'full_deploy']),
    sourceClientId: z.string().uuid().optional(),
    targetClientId: z.string().uuid().optional(),
    briefingId: z.string().uuid().optional(),
}).passthrough();  // permite outros campos específicos do handler

async function getShopifyCredentials(supabase: any, clientId: string) {
    const { data, error } = await supabase
        .from('agency_clients')
        .select('shopify_domain, shopify_access_token')
        .eq('id', clientId)
        .eq('shopify_status', 'connected')
        .not('shopify_access_token', 'is', null)
        .single();
    if (error || !data?.shopify_access_token) throw new Error(`Shopify not connected for client ${clientId}`);
    return { shop: data.shopify_domain, token: data.shopify_access_token };
}

function shopifyHeaders(token: string) {
    return { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };
}

async function shopifyREST(shop: string, token: string, endpoint: string, method = 'GET', body?: any) {
    const url = `https://${shop}/admin/api/${API_VERSION}/${endpoint}`;
    const res = await fetch(url, {
        method,
        headers: shopifyHeaders(token),
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${JSON.stringify(data)}`);
    return data;
}

async function shopifyGraphQL(shop: string, token: string, query: string, variables?: any) {
    const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
    const res = await fetch(url, {
        method: 'POST',
        headers: shopifyHeaders(token),
        body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors) throw new Error(JSON.stringify(data.errors));
    return data.data;
}

async function fetchAllPaginated(shop: string, token: string, resource: string) {
    const items: any[] = [];
    let pageInfo: string | null = null;
    let hasMore = true;
    while (hasMore) {
        const url = pageInfo
            ? `https://${shop}/admin/api/${API_VERSION}/${resource}.json?limit=250&page_info=${pageInfo}`
            : `https://${shop}/admin/api/${API_VERSION}/${resource}.json?limit=250`;
        const res = await fetch(url, { headers: shopifyHeaders(token) });
        if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e)); }
        const data = await res.json();
        const key = Object.keys(data)[0];
        items.push(...(data[key] || []));
        const link = res.headers.get('Link') || '';
        const next = link.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
        hasMore = !!next;
        if (next) pageInfo = next[1];
    }
    return items;
}

// ─── EXTRACT ─────────────────────────────────────────────────────────────

async function handleExtract(supabase: any, sourceClientId: string) {
    const { shop, token } = await getShopifyCredentials(supabase, sourceClientId);
    console.log(`[store-deployment] Extracting from ${shop}...`);

    // Fetch all resources in parallel where possible
    const [products, customCollections, smartCollections, themes] = await Promise.all([
        fetchAllPaginated(shop, token, 'products'),
        fetchAllPaginated(shop, token, 'custom_collections'),
        fetchAllPaginated(shop, token, 'smart_collections'),
        shopifyREST(shop, token, 'themes.json').then(d => d.themes || []),
    ]);

    // Pages via GraphQL
    const pagesData = await shopifyGraphQL(shop, token, `{
        pages(first: 100) {
            edges { node { id title handle body bodySummary isPublished } }
        }
    }`);
    const pages = (pagesData?.pages?.edges || []).map((e: any) => e.node);

    // Menus via GraphQL
    const menusData = await shopifyGraphQL(shop, token, `{
        menus(first: 50) {
            edges {
                node {
                    id title handle
                    items { id title type url
                        items { id title type url }
                    }
                }
            }
        }
    }`);
    const menus = (menusData?.menus?.edges || []).map((e: any) => ({
        ...e.node,
        items: (e.node.items || []).map((item: any) => ({
            ...item,
            children: item.items || []
        }))
    }));

    // Theme settings from active theme
    const activeTheme = themes.find((t: any) => t.role === 'main');
    let themeSettings = null;
    if (activeTheme) {
        try {
            const asset = await shopifyREST(shop, token, `themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`);
            themeSettings = asset?.asset?.value ? JSON.parse(asset.asset.value) : null;
        } catch { /* theme settings might not exist */ }
    }

    const collections = [
        ...customCollections.map((c: any) => ({ ...c, _type: 'custom' })),
        ...smartCollections.map((c: any) => ({ ...c, _type: 'smart' })),
    ];

    console.log(`[store-deployment] Extracted: ${products.length} products, ${collections.length} collections, ${pages.length} pages, ${menus.length} menus`);

    return { products, collections, pages, menus, themes, themeSettings, activeThemeId: activeTheme?.id };
}

// ─── TRANSFORM ───────────────────────────────────────────────────────────

async function handleTransform(supabase: any, body: any) {
    const { extractedData, targetClientId, briefingId, aiConfig, sourceBrandName } = body;

    // Load client pricing
    const { data: pricingRows } = await supabase
        .from('client_pricing')
        .select('*')
        .eq('client_id', targetClientId);

    const pricing: Record<string, string> = {};
    for (const row of (pricingRows || [])) {
        pricing[`${row.section}:${row.key}`] = row.value;
    }

    // Load briefing
    let briefing: any = {};
    if (briefingId) {
        const { data: b } = await supabase.from('briefings').select('answers').eq('id', briefingId).single();
        if (b) briefing = b.answers || {};
    }

    const targetBrand = briefing.marca_nome || '';
    const srcBrand = sourceBrandName || '';

    // ─── Build placeholder map from briefing ──────────
    const placeholders: Record<string, string> = {
        '{{marca_nome}}': briefing.marca_nome || targetBrand || '',
        '{{contato_email}}': briefing.contato_email || '',
        '{{contato_telefone}}': briefing.contato_telefone || '',
        '{{contato_instagram}}': briefing.instagram || '',
        '{{politica_troca_dias}}': briefing.politica_troca_dias || '7',
        '{{politica_entrega_prazo}}': briefing.politica_entrega_prazo || '',
        '{{politica_entrega_info}}': briefing.politica_entrega_info || '',
        '{{marca_cnpj}}': briefing.marca_cnpj || '',
        '{{marca_endereco}}': briefing.marca_endereco || '',
        '{{marca_site}}': briefing.url_site || '',
        '{{frete_gratis_valor}}': briefing.frete_gratis_valor || '',
        '{{politica_reembolso}}': briefing.politica_reembolso || '',
        '{{politica_primeira_troca}}': briefing.politica_primeira_troca || '',
        '{{nicho}}': briefing.nicho || 'camisas de time e artigos esportivos',
    };

    function replacePlaceholders(text: string): string {
        let result = text;
        for (const [placeholder, value] of Object.entries(placeholders)) {
            result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        return result;
    }

    // ─── Transform Products ─────────────────────────────
    const transformedProducts = (extractedData.products || []).map((product: any) => {
        const p = { ...product };

        // Replace brand name in title and body
        if (srcBrand && targetBrand) {
            if (p.title) p.title = p.title.replace(new RegExp(srcBrand, 'gi'), targetBrand);
            if (p.body_html) p.body_html = p.body_html.replace(new RegExp(srcBrand, 'gi'), targetBrand);
        }
        // Replace placeholders in product description
        if (p.body_html) p.body_html = replacePlaceholders(p.body_html);

        // Apply pricing based on TITLE keywords (not product_type)
        const title = (p.title || '').toLowerCase();

        // Match by title keywords — order matters, more specific first
        const titleRules: [RegExp, string][] = [
            [/retr[oô]/i, 'products:camisa_retro'],
            [/jogador|jogadora|aut[eê]ntic/i, 'products:camisa_jogador'],
            [/infantil|kids/i, 'products:conjunto_infantil'],
            [/agasalho/i, 'products:agasalho_viagem'],
            [/conjunto de treino/i, 'products:conjunto_treino'],
            [/jaqueta|corta.?vento/i, 'products:jaqueta'],
            [/moletom/i, 'products:moletom'],
            [/short/i, 'products:short'],
        ];

        let pricingKey: string | null = null;
        for (const [regex, key] of titleRules) {
            if (regex.test(title)) {
                pricingKey = key;
                break;
            }
        }
        // Fallback: everything that doesn't match is "Camisa Torcedor"
        if (!pricingKey) pricingKey = 'products:camisa_torcedor';

        if (pricingKey && pricing[pricingKey]) {
            const basePrice = pricing[pricingKey];
            if (p.variants) {
                p.variants = p.variants.map((v: any) => {
                    const newVariant = { ...v };
                    // Apply base price
                    newVariant.price = basePrice;

                    // Apply size extras (2GG, 3GG, 4GG)
                    const optionValues = [v.option1, v.option2, v.option3].filter(Boolean).map((o: string) => o.toUpperCase());
                    const sizeExtras: Record<string, string> = {
                        '2GG': pricing['extras:tamanho_2gg'] || '0',
                        '3GG': pricing['extras:tamanho_3gg'] || '0',
                        '4GG': pricing['extras:tamanho_4gg'] || '0',
                    };
                    for (const [size, extra] of Object.entries(sizeExtras)) {
                        if (optionValues.includes(size) && parseFloat(extra) > 0) {
                            newVariant.price = String((parseFloat(basePrice) + parseFloat(extra)).toFixed(2));
                        }
                    }

                    // Apply personalization extra
                    const persWords = ['personalizar', 'personalização', 'nome', 'numero'];
                    if (optionValues.some((o: string) => persWords.some(w => o.toLowerCase().includes(w)))) {
                        const persExtra = pricing['extras:personalizacao'] || '0';
                        if (parseFloat(persExtra) > 0) {
                            newVariant.price = String((parseFloat(newVariant.price) + parseFloat(persExtra)).toFixed(2));
                        }
                    }

                    // Apply manga longa extra
                    if (optionValues.some((o: string) => o.toLowerCase().includes('manga longa'))) {
                        const mlExtra = pricing['extras:manga_longa'] || '0';
                        if (parseFloat(mlExtra) > 0) {
                            newVariant.price = String((parseFloat(newVariant.price) + parseFloat(mlExtra)).toFixed(2));
                        }
                    }

                    return newVariant;
                });
            }
        }

        return p;
    });

    // ─── Transform Collections ──────────────────────────
    const transformedCollections = (extractedData.collections || []).map((col: any) => {
        const c = { ...col };
        if (srcBrand && targetBrand) {
            if (c.title) c.title = c.title.replace(new RegExp(srcBrand, 'gi'), targetBrand);
            if (c.body_html) c.body_html = c.body_html.replace(new RegExp(srcBrand, 'gi'), targetBrand);
        }
        return c;
    });

    // ─── Transform Pages ────────────────────────────────
    let transformedPages = (extractedData.pages || []).map((page: any) => {
        const p = { ...page };
        if (p.body) {
            // Replace brand name
            if (srcBrand && targetBrand) {
                p.body = p.body.replace(new RegExp(srcBrand, 'gi'), targetBrand);
            }
            // Replace placeholders from briefing
            p.body = replacePlaceholders(p.body);
        }
        return p;
    });

    // AI personalization of pages (if enabled)
    if (aiConfig?.personalizePages && targetBrand) {
        const geminiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gemini-ai`;
        const geminiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        for (let i = 0; i < transformedPages.length; i++) {
            const page = transformedPages[i];
            if (!page.body || page.body.length < 50) continue; // Skip empty/tiny pages

            try {
                const prompt = `Reescreva o conteúdo HTML desta página para a marca "${targetBrand}".
Mantenha a mesma estrutura HTML, tags e seções. Adapte APENAS o texto para refletir:
- Nome da marca: ${targetBrand}
- Nicho: ${briefing.nicho || 'e-commerce'}
- Produtos vendidos: ${(briefing.produtos || []).join(', ') || 'diversos'}
Retorne APENAS o HTML adaptado, sem explicações ou markdown.

HTML ORIGINAL:
${page.body}`;

                const aiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
                    body: JSON.stringify({ action: 'analyze', prompt, temperature: 0.3, maxTokens: 8192 }),
                });
                const aiData = await aiRes.json();
                if (aiData.text) {
                    transformedPages[i] = { ...page, body: aiData.text };
                }
            } catch (err) {
                console.error(`[store-deployment] AI failed for page ${page.title}:`, err);
            }
        }
    }

    // ─── Transform Theme Settings ───────────────────────
    let transformedThemeSettings = extractedData.themeSettings;
    if (transformedThemeSettings) {
        // Deep replace placeholders and brand name in theme settings JSON
        let themeStr = JSON.stringify(transformedThemeSettings);
        if (srcBrand && targetBrand) {
            themeStr = themeStr.replace(new RegExp(srcBrand, 'gi'), targetBrand);
        }
        themeStr = replacePlaceholders(themeStr);
        transformedThemeSettings = JSON.parse(themeStr);
    }

    return {
        products: transformedProducts,
        collections: transformedCollections,
        pages: transformedPages,
        menus: extractedData.menus, // Menus typically don't need transformation
        themeSettings: transformedThemeSettings,
        activeThemeId: extractedData.activeThemeId,
        stats: {
            products: transformedProducts.length,
            collections: transformedCollections.length,
            pages: transformedPages.length,
            menus: (extractedData.menus || []).length,
        }
    };
}

// ─── DEPLOY STEP ─────────────────────────────────────────────────────────

async function handleDeployStep(supabase: any, body: any) {
    const { deploymentId, targetClientId, step, data } = body;
    const { shop, token } = await getShopifyCredentials(supabase, targetClientId);

    const results = { created: 0, errors: [] as string[] };
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
        switch (step) {
            case 'theme': {
                const themesData = await shopifyREST(shop, token, 'themes.json');
                // Use specific theme ID if provided, otherwise find by name containing 'lever', fallback to active
                let targetTheme;
                if (data.themeId) {
                    targetTheme = (themesData.themes || []).find((t: any) => t.id === data.themeId);
                }
                if (!targetTheme && data.themeName) {
                    targetTheme = (themesData.themes || []).find((t: any) => t.name.toLowerCase().includes(data.themeName.toLowerCase()));
                }
                if (!targetTheme) {
                    targetTheme = (themesData.themes || []).find((t: any) => t.name.toLowerCase().includes('lever'));
                }
                if (!targetTheme) {
                    targetTheme = (themesData.themes || []).find((t: any) => t.role === 'main');
                }
                if (!targetTheme) { results.errors.push('No theme found'); break; }
                const themeId = targetTheme.id;

                // Helper to get/put theme assets
                async function getAsset(key: string) {
                    const r = await shopifyREST(shop, token, `themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
                    return r.asset?.value || '{}';
                }
                async function putAsset(key: string, value: string) {
                    await shopifyREST(shop, token, `themes/${themeId}/assets.json`, 'PUT', { asset: { key, value } });
                }

                // Generic placeholder replacer
                function replacePlaceholders(str: string): string {
                    const p = data.placeholders || {};
                    let result = str;
                    for (const [key, val] of Object.entries(p)) {
                        result = result.split(`{{${key}}}`).join(val as string);
                    }
                    return result;
                }

                let updated = 0;

                // 1. Update config/settings_data.json
                if (data.themeSettings || data.placeholders) {
                    try {
                        const raw = await getAsset('config/settings_data.json');
                        let settingsJson = JSON.parse(raw);

                        // Merge themeSettings if provided
                        if (data.themeSettings && typeof data.themeSettings === 'object') {
                            settingsJson = data.themeSettings;
                        }

                        // Apply placeholders + specific fields
                        if (settingsJson.current) {
                            const c = settingsJson.current;
                            if (data.licenseKey) c.lever_license_key = data.licenseKey;
                            if (data.milestone1) {
                                c.milestone_1_quantity = data.milestone1.quantity;
                                c.milestone_1_badge = data.milestone1.badge;
                            }
                            if (data.milestone2) {
                                c.milestone_2_quantity = data.milestone2.quantity;
                                c.milestone_2_badge = data.milestone2.badge;
                            }
                            if (data.messages) {
                                for (const [key, val] of Object.entries(data.messages)) {
                                    c[key] = val; // message_0, message_1, etc
                                }
                            }
                            if (data.saleBadgeText) c.sale_badge_text = data.saleBadgeText;
                        }

                        let settingsStr = JSON.stringify(settingsJson);
                        settingsStr = replacePlaceholders(settingsStr);
                        await putAsset('config/settings_data.json', settingsStr);
                        updated++;
                    } catch (err: any) { results.errors.push(`settings_data: ${err.message}`); }
                }

                // 2. Update sections/header-group.json
                if (data.placeholders || data.supportEmail || data.supportPhone) {
                    try {
                        let headerRaw = await getAsset('sections/header-group.json');
                        let headerJson = JSON.parse(headerRaw);

                        // Update support contact in header
                        const headerSection = headerJson.sections?.header;
                        if (headerSection?.settings) {
                            if (data.supportEmail) headerSection.settings.support_email = data.supportEmail;
                            if (data.supportPhone) headerSection.settings.support_phone = data.supportPhone;
                        }

                        // Update announcement bar texts
                        const annBar = headerJson.sections?.['announcement-bar'];
                        if (annBar?.blocks && data.announcements) {
                            const blockKeys = Object.keys(annBar.blocks);
                            data.announcements.forEach((text: string, i: number) => {
                                if (blockKeys[i] && annBar.blocks[blockKeys[i]].settings) {
                                    annBar.blocks[blockKeys[i]].settings.text = text;
                                }
                            });
                        }

                        let headerStr = JSON.stringify(headerJson);
                        headerStr = replacePlaceholders(headerStr);
                        await putAsset('sections/header-group.json', headerStr);
                        updated++;
                    } catch (err: any) { results.errors.push(`header-group: ${err.message}`); }
                }

                // 3. Update sections/footer-group.json
                if (data.placeholders || data.supportEmail || data.supportPhone || data.footerSubtext) {
                    try {
                        let footerRaw = await getAsset('sections/footer-group.json');
                        let footerJson = JSON.parse(footerRaw);

                        // Find footer section and update text blocks
                        const footerSection = footerJson.sections?.footer;
                        if (footerSection?.blocks) {
                            for (const [blockId, block] of Object.entries(footerSection.blocks)) {
                                const b = block as any;
                                // Update contact/schedule text block
                                if (b.settings?.heading && /horário|atendimento|contato/i.test(b.settings.heading)) {
                                    if (data.footerSubtext) {
                                        b.settings.subtext = data.footerSubtext;
                                    } else if (data.supportEmail && data.supportPhone) {
                                        b.settings.subtext = `<p>Seg à Sex: 08h as 18h.</p><p>Email: ${data.supportEmail}</p><p>Whatsapp: ${data.supportPhone}</p>`;
                                    }
                                }
                                // Update logo
                                if (b.type === 'image' && data.logoUrl) {
                                    b.settings.image = data.logoUrl;
                                }
                            }
                        }

                        let footerStr = JSON.stringify(footerJson);
                        footerStr = replacePlaceholders(footerStr);
                        await putAsset('sections/footer-group.json', footerStr);
                        updated++;
                    } catch (err: any) { results.errors.push(`footer-group: ${err.message}`); }
                }

                results.created = updated;

                // Create license in external Supabase project (Lever Site - Licenças)
                // IMPORTANTE: Shopify tem compiled cache do snippet que não invalida por API,
                // então após setar o lever_license_key no tema, validamos via HTML público
                // e se não casar, atualizamos o Supabase pra casar com o HTML (fallback).
                // Veja memory feedback_shopify_compiled_snippet_cache.md
                if (data.createLicense !== false) {
                    try {
                        const licUrl = Deno.env.get('LEVER_SITE_SUPABASE_URL') || 'https://ykctllrqygchllhxnkjh.supabase.co';
                        const licServiceKey = Deno.env.get('LEVER_SITE_SERVICE_ROLE_KEY');
                        if (licServiceKey) {
                            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                            const seg = (n: number) => Array.from({length: n}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                            const licenseKey = `LEVER-${seg(4)}-${seg(4)}`;
                            const clientName = data.clientName || shop.replace('.myshopify.com', '');

                            // 1. Cria registro no Supabase externo (upsert: se shop_url já existe, atualiza)
                            const licRes = await fetch(`${licUrl}/rest/v1/licenses?on_conflict=shop_url`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'apikey': licServiceKey,
                                    'Authorization': `Bearer ${licServiceKey}`,
                                    'Prefer': 'resolution=merge-duplicates,return=representation',
                                },
                                body: JSON.stringify({
                                    license_key: licenseKey,
                                    shop_url: shop,
                                    status: 'active',
                                    client_name: clientName,
                                }),
                            });
                            if (!licRes.ok) {
                                results.errors.push(`License upsert failed: ${licRes.status}`);
                                break;
                            }
                            (results as any).license = licenseKey;

                            // 2. Seta o lever_license_key no settings_data.json do tema
                            // (asset file atualiza, mas compiled cache do snippet pode não)
                            try {
                                const settingsRaw = await getAsset('config/settings_data.json');
                                const settingsJson = JSON.parse(settingsRaw);
                                if (settingsJson.current) {
                                    settingsJson.current.lever_license_key = licenseKey;
                                    await putAsset('config/settings_data.json', JSON.stringify(settingsJson, null, 2));
                                }
                            } catch (themeErr: any) {
                                results.errors.push(`Theme license set failed: ${themeErr.message}`);
                            }

                            // 3. Valida via HTML público e fix downstream se divergir
                            // (fallback pro bug do compiled cache do Shopify)
                            try {
                                const primaryDomain = await fetch(`https://${shop}/admin/api/2026-01/shop.json`, {
                                    headers: { 'X-Shopify-Access-Token': token },
                                }).then(r => r.json()).then(d => d.shop?.domain || shop);

                                // Aguarda 5s pra settings propagar (não garante invalidar compiled cache)
                                await new Promise(r => setTimeout(r, 5000));

                                const html = await fetch(`https://${primaryDomain}/?license-verify=${Date.now()}`, {
                                    headers: { 'User-Agent': 'store-deployment-license-verify' },
                                }).then(r => r.text());
                                const htmlKeyMatch = html.match(/const licenseKey = "([^"]*)"/);
                                const htmlKey = htmlKeyMatch ? htmlKeyMatch[1] : null;

                                if (htmlKey && htmlKey !== licenseKey) {
                                    // Compiled cache servindo valor antigo — ajusta Supabase pra casar
                                    (results as any).licenseCacheWarning = `HTML serve "${htmlKey}" mas Supabase tem "${licenseKey}". Ajustando Supabase pra casar.`;
                                    await fetch(`${licUrl}/rest/v1/licenses?shop_url=eq.${encodeURIComponent(shop)}`, {
                                        method: 'PATCH',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'apikey': licServiceKey,
                                            'Authorization': `Bearer ${licServiceKey}`,
                                        },
                                        body: JSON.stringify({ license_key: htmlKey }),
                                    });
                                    (results as any).license = htmlKey;
                                }
                            } catch (verifyErr: any) {
                                results.errors.push(`License verify failed: ${verifyErr.message}`);
                            }
                        }
                    } catch (licErr: any) {
                        results.errors.push(`License: ${licErr.message}`);
                    }
                }
                break;
            }
            case 'collections': {
                // Fetch existing collections to avoid duplicates
                const existingCustom = await shopifyREST(shop, token, 'custom_collections.json?limit=250&fields=id,title,handle');
                const existingSmart = await shopifyREST(shop, token, 'smart_collections.json?limit=250&fields=id,title,handle');
                const existingTitles = new Set([
                    ...(existingCustom.custom_collections || []).map((c: any) => c.title.toLowerCase().trim()),
                    ...(existingSmart.smart_collections || []).map((c: any) => c.title.toLowerCase().trim()),
                ]);

                for (const col of (data.collections || [])) {
                    try {
                        // Skip if collection already exists
                        if (existingTitles.has(col.title.toLowerCase().trim())) {
                            continue;
                        }
                        existingTitles.add(col.title.toLowerCase().trim());

                        if (col._type === 'custom') {
                            await shopifyREST(shop, token, 'custom_collections.json', 'POST', {
                                custom_collection: {
                                    title: col.title,
                                    body_html: col.body_html || '',
                                    published: col.published_at ? true : false,
                                    image: col.image?.src ? { src: col.image.src } : undefined,
                                    sort_order: col.sort_order || 'best-selling',
                                }
                            });
                        } else {
                            await shopifyREST(shop, token, 'smart_collections.json', 'POST', {
                                smart_collection: {
                                    title: col.title,
                                    body_html: col.body_html || '',
                                    published: col.published_at ? true : false,
                                    rules: col.rules || [],
                                    disjunctive: col.disjunctive || false,
                                    sort_order: col.sort_order || 'best-selling',
                                }
                            });
                        }
                        results.created++;
                    } catch (err: any) {
                        results.errors.push(`Collection "${col.title}": ${err.message}`);
                    }
                    await delay(500); // Rate limit
                }
                break;
            }
            case 'pages': {
                for (const page of (data.pages || [])) {
                    try {
                        await shopifyGraphQL(shop, token, `
                            mutation pageCreate($page: PageCreateInput!) {
                                pageCreate(page: $page) {
                                    page { id }
                                    userErrors { field message }
                                }
                            }
                        `, {
                            page: {
                                title: page.title,
                                body: page.body || '',
                                isPublished: page.isPublished !== false,
                            }
                        });
                        results.created++;
                    } catch (err: any) {
                        results.errors.push(`Page "${page.title}": ${err.message}`);
                    }
                    await delay(300);
                }
                break;
            }
            case 'menus': {
                // Menus need GraphQL menuCreate
                for (const menu of (data.menus || [])) {
                    try {
                        // Determine menu item type from URL
                        function getMenuItemType(url: string): string {
                            if (!url || url === '/') return 'FRONTPAGE';
                            if (url.startsWith('/policies/')) return 'HTTP';
                            return 'HTTP';
                        }

                        // Create the menu with all items
                        const items = (menu.items || []).map((item: any) => ({
                            title: item.title,
                            type: item.type || getMenuItemType(item.url),
                            url: item.url,
                            items: (item.children || []).map((child: any) => ({
                                title: child.title,
                                type: child.type || getMenuItemType(child.url),
                                url: child.url,
                            }))
                        }));

                        await shopifyGraphQL(shop, token, `
                            mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
                                menuCreate(title: $title, handle: $handle, items: $items) {
                                    menu { id }
                                    userErrors { field message }
                                }
                            }
                        `, {
                            title: menu.title,
                            handle: menu.handle,
                            items,
                        });
                        results.created++;
                    } catch (err: any) {
                        results.errors.push(`Menu "${menu.title}": ${err.message}`);
                    }
                    await delay(300);
                }
                break;
            }
            case 'products': {
                for (const product of (data.products || [])) {
                    try {
                        const payload: any = {
                            product: {
                                title: product.title,
                                body_html: product.body_html || '',
                                vendor: product.vendor || '',
                                product_type: product.product_type || '',
                                tags: product.tags || '',
                                status: 'active',
                                options: product.options || [],
                                variants: (product.variants || []).map((v: any) => ({
                                    option1: v.option1,
                                    option2: v.option2,
                                    option3: v.option3,
                                    price: v.price,
                                    compare_at_price: v.compare_at_price,
                                    sku: v.sku || '',
                                    weight: v.weight,
                                    weight_unit: v.weight_unit,
                                    barcode: v.barcode || '',
                                    inventory_management: v.inventory_management,
                                    inventory_policy: v.inventory_policy || 'deny',
                                    requires_shipping: v.requires_shipping !== false,
                                    taxable: v.taxable !== false,
                                })),
                                images: (product.images || []).map((img: any) => ({
                                    src: img.src,
                                    alt: img.alt || '',
                                    position: img.position,
                                })),
                            }
                        };
                        await shopifyREST(shop, token, 'products.json', 'POST', payload);
                        results.created++;
                    } catch (err: any) {
                        results.errors.push(`Product "${product.title}": ${err.message}`);
                    }
                    await delay(500); // Rate limit
                }
                break;
            }
            case 'bulk_products': {
                // Parallel REST API — creates products with full variants/options support
                // Uses controlled concurrency (4 parallel requests) for speed without hitting rate limits
                const products = data.products || [];
                if (products.length === 0) break;

                const CONCURRENCY = 4;
                let created = 0;
                const errors: string[] = [];

                async function createProduct(product: any) {
                    const payload = {
                        product: {
                            title: product.title,
                            body_html: product.body_html || '',
                            vendor: product.vendor || '',
                            product_type: product.product_type || '',
                            tags: product.tags || '',
                            status: 'active',
                            handle: product.handle,
                            options: (product.options || []).map((o: any) => ({ name: o.name, values: o.values })),
                            variants: (product.variants || []).map((v: any) => ({
                                option1: v.option1, option2: v.option2, option3: v.option3,
                                price: v.price, compare_at_price: v.compare_at_price,
                                sku: v.sku || '', weight: v.weight, weight_unit: v.weight_unit,
                                inventory_management: v.inventory_management,
                                inventory_policy: v.inventory_policy || 'deny',
                                requires_shipping: v.requires_shipping !== false,
                                taxable: v.taxable !== false,
                            })),
                            images: (product.images || []).map((img: any) => ({
                                src: img.src, alt: img.alt || '', position: img.position,
                            })),
                        }
                    };
                    try {
                        await shopifyREST(shop, token, 'products.json', 'POST', payload);
                        created++;
                    } catch (err: any) {
                        errors.push(`"${product.title}": ${err.message.substring(0, 80)}`);
                    }
                }

                // Process in parallel batches
                for (let i = 0; i < products.length; i += CONCURRENCY) {
                    const batch = products.slice(i, i + CONCURRENCY);
                    await Promise.all(batch.map(createProduct));
                    // Small delay between batches to stay within Shopify's 4 req/s bucket
                    if (i + CONCURRENCY < products.length) await delay(250);
                }

                results.created = created;
                results.errors = errors;
                break;
            }
            case 'sort_collections': {
                // Sort products within collections by: Year (2026 first) > Type (Torcedor > Jogador > Feminina > Infantil > Retrô)
                function getSortKey(title: string): number {
                    const t = title.toLowerCase();
                    // Ordem: 2026/27 > 2026 (Copa do Mundo) > 2025/26 > 2025 > 2024/25 > retrô
                    let yearScore = 50;
                    if (/2026\/27|26\/27/.test(t)) yearScore = 100;
                    else if (/\b2026\b(?!\s*\/)/.test(t)) yearScore = 95;
                    else if (/2025\/26|25\/26/.test(t)) yearScore = 90;
                    else if (/\b2025\b(?!\s*\/)/.test(t)) yearScore = 85;
                    else if (/2024\/25|24\/25/.test(t)) yearScore = 80;
                    else if (/retr[oô]/i.test(t)) yearScore = 10;

                    let typeScore = 50;
                    if (/jogador|authentic/i.test(t)) typeScore = 95;
                    else if (/femin/i.test(t) && !/infantil/i.test(t)) typeScore = 85;
                    else if (/infantil|conjunto infantil/i.test(t)) typeScore = 80;
                    else if (/manga longa/i.test(t)) typeScore = 75;
                    else if (/regata/i.test(t)) typeScore = 70;
                    else if (/conjunto.*treino|set/i.test(t)) typeScore = 60;
                    else if (/treino/i.test(t)) typeScore = 55;
                    else if (/agasalho/i.test(t)) typeScore = 50;
                    else if (/goleiro/i.test(t)) typeScore = 45;
                    else if (/short/i.test(t)) typeScore = 40;
                    else if (/retr[oô]/i.test(t)) typeScore = 30;
                    else if (/^camisa /i.test(t)) typeScore = 100;

                    let numScore = 0;
                    if (/\bI\b/.test(title) && !/II|III|IV/.test(title)) numScore = 3;
                    else if (/\bII\b/.test(title) && !/III/.test(title)) numScore = 2;
                    else if (/\bIII\b/.test(title)) numScore = 1;

                    return yearScore * 10000 + typeScore * 100 + numScore;
                }

                // Get all smart collections (team collections)
                const smartColsRes = await shopifyREST(shop, token, 'smart_collections.json?limit=250');
                const smartCols = smartColsRes.smart_collections || [];
                let sorted = 0;

                for (const col of smartCols) {
                    try {
                        // Set to manual sort
                        await shopifyREST(shop, token, `smart_collections/${col.id}.json`, 'PUT', {
                            smart_collection: { sort_order: 'manual' }
                        });

                        // Get products in collection
                        const prodsRes = await shopifyREST(shop, token, `products.json?collection_id=${col.id}&limit=250`);
                        const prods = prodsRes.products || [];
                        if (prods.length < 2) continue;

                        // Sort and reorder
                        const sortedProds = [...prods].sort((a, b) => getSortKey(b.title) - getSortKey(a.title));
                        const moves = sortedProds.map((p: any, i: number) => ({
                            id: `gid://shopify/Product/${p.id}`,
                            newPosition: i.toString()
                        }));

                        await shopifyGraphQL(shop, token, `
                            mutation reorder($id: ID!, $moves: [MoveInput!]!) {
                                collectionReorderProducts(id: $id, moves: $moves) {
                                    job { id }
                                    userErrors { message }
                                }
                            }
                        `, {
                            id: `gid://shopify/Collection/${col.id}`,
                            moves
                        });
                        sorted++;
                    } catch (err: any) {
                        results.errors.push(`Sort "${col.title}": ${err.message}`);
                    }
                    await delay(500);
                }
                results.created = sorted;
                break;
            }
        }
    } catch (err: any) {
        results.errors.push(err.message);
    }

    // Update deployment status
    if (deploymentId) {
        try {
            const { data: deployment } = await supabase.from('store_deployments').select('step_status').eq('id', deploymentId).single();
            const stepStatus = deployment?.step_status || {};
            stepStatus[step] = {
                status: results.errors.length > 0 ? 'partial' : 'completed',
                created: results.created,
                errors: results.errors,
            };
            await supabase.from('store_deployments').update({
                step_status: stepStatus,
                updated_at: new Date().toISOString(),
            }).eq('id', deploymentId);
        } catch { /* ignore status update errors */ }
    }

    return results;
}

// ─── FULL DEPLOY ─────────────────────────────────────────────────────────

async function handleFullDeploy(supabase: any, body: any) {
    const { sourceClientId, targetClientId, briefingId, aiConfig, sourceBrandName } = body;

    // 1. Extract
    const extractedData = await handleExtract(supabase, sourceClientId);

    // 2. Transform
    const transformed = await handleTransform(supabase, {
        extractedData,
        targetClientId,
        briefingId,
        aiConfig,
        sourceBrandName,
    });

    // 3. Deploy each step in order
    const steps = ['theme', 'collections', 'pages', 'menus', 'products'] as const;
    const stepResults: Record<string, any> = {};

    for (const step of steps) {
        const stepData: any = {};
        if (step === 'theme') { stepData.themeSettings = transformed.themeSettings; }
        else if (step === 'collections') { stepData.collections = transformed.collections; }
        else if (step === 'pages') { stepData.pages = transformed.pages; }
        else if (step === 'menus') { stepData.menus = transformed.menus; }
        else if (step === 'products') { stepData.products = transformed.products; }

        stepResults[step] = await handleDeployStep(supabase, {
            targetClientId,
            step,
            data: stepData,
        });
    }

    return {
        stats: transformed.stats,
        results: stepResults,
    };
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────

Deno.serve(instrument("store-deployment", async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const rawBody = await req.json();
        const parsed = baseSchema.safeParse(rawBody);
        if (!parsed.success) {
            console.error('[store-deployment] Payload inválido:', parsed.error.flatten());
            return new Response(JSON.stringify({
                error: 'Payload inválido',
                details: parsed.error.flatten(),
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const body = parsed.data;
        const { action } = body;

        let result;

        switch (action) {
            case 'extract':
                result = await handleExtract(supabase, body.sourceClientId);
                break;
            case 'transform':
                result = await handleTransform(supabase, body);
                break;
            case 'deploy_step':
                result = await handleDeployStep(supabase, body);
                break;
            case 'full_deploy':
                result = await handleFullDeploy(supabase, body);
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[store-deployment] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}));

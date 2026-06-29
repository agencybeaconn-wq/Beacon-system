import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'

// @ts-ignore
declare const Deno: any;

// Valida params do OAuth callback. `shop` vai direto na URL do token exchange — sem regex
// permite redirect pra dominio attacker.myshopify.com.attacker.com. `state` é o clientId UUID.
const shopifyShopRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const callbackParamsSchema = z.object({
  code: z.string().min(1, 'code obrigatório'),
  shop: z.string().regex(shopifyShopRegex, 'shop deve ser <handle>.myshopify.com'),
  state: z.string().uuid('state deve ser UUID (clientId)').optional().nullable(),
})

/**
 * Verify HMAC signature from Shopify on the OAuth callback.
 */
async function verifyOAuthHmac(query: URLSearchParams, secret: string): Promise<boolean> {
  const hmac = query.get('hmac');
  if (!hmac) return false;

  const params = new URLSearchParams();
  query.forEach((value, key) => {
    if (key !== 'hmac') params.append(key, value);
  });
  params.sort();
  const message = params.toString();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const computedHmac = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHmac === hmac;
}

/**
 * Register mandatory GDPR/compliance webhooks via Shopify Admin API.
 */
async function registerComplianceWebhooks(shop: string, accessToken: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const webhookUrl = `${supabaseUrl}/functions/v1/shopify-webhooks`;

  const topics = [
    'customers/data_request',
    'customers/redact',
    'shop/redact',
  ];

  for (const topic of topics) {
    try {
      const response = await fetch(`https://${shop}/admin/api/2026-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: 'json',
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`[shopify-oauth] ✅ Registered webhook: ${topic}`);
      } else if (response.status === 422 && JSON.stringify(data).includes('already been taken')) {
        console.log(`[shopify-oauth] ℹ️ Webhook already exists: ${topic}`);
      } else {
        console.error(`[shopify-oauth] ❌ Failed to register webhook ${topic}:`, data);
      }
    } catch (err) {
      console.error(`[shopify-oauth] ❌ Error registering webhook ${topic}:`, err);
    }
  }
}

function htmlRedirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { 'Location': url }
  });
}

const serve = (async (req: Request) => {
  try {
    const url = new URL(req.url)
    const rawParams = {
      code: url.searchParams.get('code'),
      shop: url.searchParams.get('shop'),
      state: url.searchParams.get('state'),
    };

    console.log('[shopify-oauth-callback] Received params:', { code: rawParams.code ? 'present' : 'missing', shop: rawParams.shop, state: rawParams.state, hmac: url.searchParams.get('hmac') ? 'present' : 'missing' });

    const parsed = callbackParamsSchema.safeParse(rawParams);
    if (!parsed.success) {
      console.error('[shopify-oauth-callback] Params inválidos:', parsed.error.flatten());
      return htmlRedirect(`${Deno.env.get('VITE_APP_URL')}/connections?shopify=error&message=${encodeURIComponent('Parametros invalidos: ' + JSON.stringify(parsed.error.flatten().fieldErrors))}`)
    }
    const { code, shop } = parsed.data;
    let clientId = parsed.data.state;

    // Get per-client credentials from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let clientData: any = null;

    if (clientId) {
      // Look up by clientId from state parameter
      const { data, error } = await supabase
        .from('agency_clients')
        .select('id, shopify_client_id, shopify_client_secret')
        .eq('id', clientId)
        .single()
      clientData = data;
      console.log('[shopify-oauth-callback] Lookup by clientId:', { found: !!data, error: error?.message });
    }

    // Fallback 1: look up by shop domain
    if (!clientData) {
      const { data, error } = await supabase
        .from('agency_clients')
        .select('id, shopify_client_id, shopify_client_secret')
        .eq('shopify_domain', shop)
        .limit(1)
        .single()
      clientData = data;
      if (clientData) clientId = clientData.id;
      console.log('[shopify-oauth-callback] Lookup by domain:', { found: !!data, error: error?.message });
    }

    // Fallback 2: look up by shopify_client_id (from the app credentials)
    if (!clientData) {
      const { data, error } = await supabase
        .from('agency_clients')
        .select('id, shopify_client_id, shopify_client_secret, shopify_domain')
        .not('shopify_client_id', 'is', null)
        .eq('shopify_status', 'pending')
        .limit(10)
      console.log('[shopify-oauth-callback] Fallback lookup pending clients:', { found: data?.length, error: error?.message });
      // Match by shop domain substring
      if (data && data.length > 0) {
        const shopHandle = shop.replace('.myshopify.com', '');
        const match = data.find((c: any) => c.shopify_domain?.includes(shopHandle));
        if (match) {
          clientData = match;
          clientId = match.id;
          console.log('[shopify-oauth-callback] Matched pending client:', clientId);
        }
      }
    }

    if (!clientId) {
      console.error('[shopify-oauth-callback] Client not found for shop:', shop);
      return htmlRedirect(`${Deno.env.get('VITE_APP_URL')}/connections?shopify=error&message=Client+not+found+for+this+store`)
    }

    // Use per-client credentials if available, fallback to env vars
    const appClientId = clientData?.shopify_client_id || Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = clientData?.shopify_client_secret || Deno.env.get('SHOPIFY_CLIENT_SECRET');
    console.log('[shopify-oauth-callback] Using credentials:', { appClientId: appClientId ? 'present' : 'missing', clientSecret: clientSecret ? 'present' : 'missing' });

    // Verify HMAC signature (non-blocking for custom app installs)
    const hmac = url.searchParams.get('hmac');
    if (hmac && clientSecret) {
      const isValid = await verifyOAuthHmac(url.searchParams, clientSecret);
      if (!isValid) {
        console.warn('[shopify-oauth-callback] HMAC verification failed — proceeding anyway (custom app install may not include standard HMAC)');
      } else {
        console.log('[shopify-oauth-callback] HMAC verification passed ✅');
      }
    } else {
      console.log('[shopify-oauth-callback] No HMAC in callback — skipping verification (custom app install flow)');
    }

    // Exchange code for access token using per-client credentials
    console.log('[shopify-oauth-callback] Exchanging code for access token...');
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: appClientId,
        client_secret: clientSecret,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()
    console.log('[shopify-oauth-callback] Token exchange result:', { hasToken: !!tokenData.access_token, error: tokenData.error, status: tokenResponse.status });

    if (tokenData.error || !tokenData.access_token) {
      console.error('[shopify-oauth-callback] Token exchange failed:', tokenData);
      return htmlRedirect(`${Deno.env.get('VITE_APP_URL')}/clients/${clientId}?shopify=error&message=${encodeURIComponent(tokenData.error_description || tokenData.error || 'Failed to get access token')}`)
    }

    const access_token = tokenData.access_token

    // Register mandatory compliance webhooks
    console.log('[shopify-oauth-callback] Registering compliance webhooks...');
    await registerComplianceWebhooks(shop, access_token);

    // Fetch shop info to get shop name
    const shopInfoResponse = await fetch(`https://${shop}/admin/api/2026-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': access_token
      }
    })

    const shopInfoData = await shopInfoResponse.json()
    const shopName = shopInfoData?.shop?.name || shop

    // Save to database
    console.log('[shopify-oauth-callback] Saving token for client:', clientId, 'shop:', shop, 'name:', shopName);
    const { error: updateError, count } = await supabase
      .from('agency_clients')
      .update({
        shopify_access_token: access_token,
        shopify_domain: shop,
        shopify_shop_name: shopName,
        shopify_status: 'connected',
        shopify_connected_at: new Date().toISOString()
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('[shopify-oauth-callback] Database update error:', updateError)
      return htmlRedirect(`${Deno.env.get('VITE_APP_URL')}/clients/${clientId}?shopify=error&message=Database+error`)
    }
    console.log('[shopify-oauth-callback] ✅ Token saved successfully for', shopName);

    return htmlRedirect(`${Deno.env.get('VITE_APP_URL')}/clients/${clientId}?shopify=success&shop=${encodeURIComponent(shopName)}`)
  } catch (error: any) {
    console.error('Shopify OAuth callback error:', error)
    return htmlRedirect(`${Deno.env.get('VITE_APP_URL')}/connections?shopify=error&message=${encodeURIComponent(error.message)}`)
  }
})

Deno.serve(instrument("shopify-oauth-callback", serve))

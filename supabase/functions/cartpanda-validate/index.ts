import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'

// @ts-ignore
Deno.serve(instrument("cartpanda-validate", async (req: Request) => {
    // Log absolutely first thing
    console.log('>>> Request received, method:', req.method, 'url:', req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        console.log('Returning OPTIONS response');
        return new Response('ok', { headers: corsHeaders })
    }

    console.log('>>> Processing non-OPTIONS request');

    try {
        console.log('Reading body...');
        const bodyText = await req.text();
        console.log('Body text received, length:', bodyText.length);

        let body;
        try {
            body = JSON.parse(bodyText);
            console.log('Body parsed successfully');
        } catch (e) {
            console.error('Failed to parse body:', e);
            return new Response(
                JSON.stringify({ error: "Invalid JSON body" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { storeSlug, bearerToken, clientId } = body;
        console.log('storeSlug:', storeSlug, 'clientId:', clientId, 'hasToken:', !!bearerToken);

        if (!storeSlug || !bearerToken || !clientId) {
            console.log('Missing required fields');
            return new Response(
                JSON.stringify({ error: "storeSlug, bearerToken e clientId são obrigatórios" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const cleanSlug = storeSlug.trim().toLowerCase().replace(/\s+/g, '-');
        const cartpandaUrl = `https://accounts.cartpanda.com/api/${cleanSlug}/orders?page=1&limit=1`;
        console.log('Calling CartPanda:', cartpandaUrl);

        const cartpandaResponse = await fetch(cartpandaUrl, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${bearerToken}`,
            },
        });

        console.log('CartPanda status:', cartpandaResponse.status);

        if (!cartpandaResponse.ok) {
            const errorText = await cartpandaResponse.text();
            console.log('CartPanda error:', errorText);

            let errorMessage = "Falha na conexão com CartPanda";
            if (cartpandaResponse.status === 401) {
                errorMessage = "Token inválido ou expirado";
            } else if (cartpandaResponse.status === 404) {
                errorMessage = "Loja não encontrada. Verifique o slug.";
            }

            return new Response(
                JSON.stringify({ error: errorMessage }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const cartpandaData = await cartpandaResponse.json();
        console.log('CartPanda orders:', cartpandaData.orders?.length || 0);

        let storeName = cleanSlug;
        if (cartpandaData.orders?.length > 0 && cartpandaData.orders[0].shop?.name) {
            storeName = cartpandaData.orders[0].shop.name;
        }

        // Update database using REST API
        // @ts-ignore
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        // @ts-ignore
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log('Updating DB, supabaseUrl exists:', !!supabaseUrl, 'key exists:', !!supabaseKey);

        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/agency_clients?id=eq.${clientId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey!,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                cartpanda_store_slug: cleanSlug,
                cartpanda_bearer_token: bearerToken,
                cartpanda_status: 'connected',
                cartpanda_connected_at: new Date().toISOString(),
                cartpanda_store_name: storeName
            })
        });

        console.log('DB update status:', updateResponse.status);

        if (!updateResponse.ok) {
            const updateError = await updateResponse.text();
            console.error('DB error:', updateError);
            return new Response(
                JSON.stringify({ error: "Erro ao salvar conexão" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log('SUCCESS!');
        return new Response(
            JSON.stringify({
                success: true,
                storeName,
                storeSlug: cleanSlug,
                message: "CartPanda conectado com sucesso!"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error('CATCH Error:', error);
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
}));

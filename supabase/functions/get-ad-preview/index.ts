// @ts-ignore: Deno types
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: get-ad-preview
 * Gera iframe de preview de anuncio Meta via /adpreviews. Funciona pra todo tipo de ad.
 * Adoptado do app Leverads.AI 2026-05-19.
 */
serve(instrument("get-ad-preview", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { adId, accountId, format = 'MOBILE_FEED_STANDARD' } = await req.json();

        if (!adId) {
            return new Response(
                JSON.stringify({ error: 'adId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // @ts-ignore: Deno global
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        // @ts-ignore: Deno global
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'ads' } });

        let accessToken: string | null = null;

        if (accountId) {
            const cleanAccountId = accountId.replace(/^act_/i, '');
            const { data: account } = await supabase
                .from('ad_accounts')
                .select('access_token')
                .eq('id', `act_${cleanAccountId}`)
                .single();

            if (account?.access_token) {
                accessToken = account.access_token;
            }
        }

        if (!accessToken) {
            const authHeader = req.headers.get('Authorization');
            if (authHeader) {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                    const { data: metaToken } = await supabase
                        .from('meta_tokens')
                        .select('access_token')
                        .eq('user_id', user.id)
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .single();
                    if (metaToken?.access_token) {
                        accessToken = metaToken.access_token;
                    }
                }
            }
        }

        if (!accessToken) {
            return new Response(
                JSON.stringify({ error: 'Access token not found' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const validFormats = [
            'MOBILE_FEED_STANDARD',
            'DESKTOP_FEED_STANDARD',
            'FACEBOOK_STORY_MOBILE',
            'INSTAGRAM_STANDARD',
            'INSTAGRAM_STORY',
            'RIGHT_COLUMN_STANDARD'
        ];

        const safeFormat = validFormats.includes(format) ? format : 'MOBILE_FEED_STANDARD';

        const previewUrl = `https://graph.facebook.com/v24.0/${adId}/previews?ad_format=${safeFormat}&access_token=${accessToken}`;
        const response = await fetch(previewUrl);
        const data = await response.json();

        if (data.error) {
            return new Response(
                JSON.stringify({ error: data.error.message, success: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (data.data && data.data.length > 0) {
            return new Response(
                JSON.stringify({ success: true, body: data.data[0].body, format: safeFormat }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ error: 'No preview available for this ad', success: false }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

    } catch (error: any) {
        console.error('[GET-AD-PREVIEW] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message, success: false }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}));

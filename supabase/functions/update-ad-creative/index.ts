// Edge function: update-ad-creative
// Troca creative (imagem/video) de um Ad Meta existente sem recriar campanha.
// Cria novo AdCreative + aplica no Ad. Adoptado do Leverads.AI 2026-05-19.

import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateAdCreativeRequest {
    adId: string;
    accountId: string;
    creative: { type: 'image' | 'video'; hash?: string; videoId?: string; url?: string; };
    copy?: { primaryText?: string; headline?: string; description?: string; ctaType?: string; };
}

async function getAccessToken(supabase: any, accountId: string | null, authHeader: string | null): Promise<string | null> {
    let cleanAccountId = accountId;
    if (accountId) cleanAccountId = accountId.replace(/^act_/i, '');

    let userId: string | null = null;
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) userId = user.id;
        } catch (e) { /* ignore */ }
    }

    if (userId) {
        try {
            const { data: connection } = await supabase
                .from('connections').select('access_token')
                .eq('user_id', userId).eq('provider', 'facebook').limit(1).single();
            if (connection?.access_token) return connection.access_token;
        } catch (e) { /* ignore */ }
    }

    if (accountId) {
        let { data: account } = await supabase.from('ad_accounts').select('access_token').eq('id', accountId).single();
        if (account?.access_token) return account.access_token;
        if (cleanAccountId !== accountId) {
            const { data: account2 } = await supabase.from('ad_accounts').select('access_token').eq('id', cleanAccountId).single();
            if (account2?.access_token) return account2.access_token;
        }
    }

    return null;
}

serve(instrument("update-ad-creative", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { db: { schema: 'ads' } }
        );

        const body: UpdateAdCreativeRequest = await req.json();
        const { adId, accountId, creative, copy } = body;

        if (!adId) throw new Error("adId is required");
        if (!accountId) throw new Error("accountId is required");
        if (!creative || (!creative.hash && !creative.videoId)) {
            throw new Error("creative.hash (for images) or creative.videoId (for videos) is required");
        }

        const authHeader = req.headers.get('Authorization');
        const accessToken = await getAccessToken(supabase, accountId, authHeader);
        if (!accessToken) throw new Error("Access token not found. Please check if your Meta account is connected.");

        const adUrl = `https://graph.facebook.com/v24.0/${adId}?fields=id,name,creative{id,object_story_spec,effective_object_story_id}&access_token=${accessToken}`;
        const adResponse = await fetch(adUrl);
        const adData = await adResponse.json();
        if (adData.error) throw new Error(`Failed to fetch ad: ${adData.error.message}`);

        const existingCreative = adData.creative;
        const objectStorySpec = existingCreative?.object_story_spec;
        const pageId = objectStorySpec?.page_id;
        if (!pageId) throw new Error("Could not determine page_id from existing ad creative");

        const cleanAccountIdForApi = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
        let newObjectStorySpec: any;

        if (creative.type === 'video') {
            newObjectStorySpec = {
                page_id: pageId,
                video_data: {
                    video_id: creative.videoId,
                    title: copy?.headline || objectStorySpec?.video_data?.title || '',
                    message: copy?.primaryText || objectStorySpec?.video_data?.message || '',
                    link_description: copy?.description || objectStorySpec?.video_data?.link_description || '',
                    call_to_action: {
                        type: copy?.ctaType || objectStorySpec?.video_data?.call_to_action?.type || 'LEARN_MORE',
                        value: { link: objectStorySpec?.video_data?.call_to_action?.value?.link || objectStorySpec?.link_data?.link || 'https://example.com' }
                    }
                }
            };
        } else {
            newObjectStorySpec = {
                page_id: pageId,
                link_data: {
                    image_hash: creative.hash,
                    message: copy?.primaryText || objectStorySpec?.link_data?.message || '',
                    name: copy?.headline || objectStorySpec?.link_data?.name || '',
                    description: copy?.description || objectStorySpec?.link_data?.description || '',
                    link: objectStorySpec?.link_data?.link || 'https://example.com',
                    call_to_action: {
                        type: copy?.ctaType || objectStorySpec?.link_data?.call_to_action?.type || 'LEARN_MORE',
                        value: { link: objectStorySpec?.link_data?.call_to_action?.value?.link || objectStorySpec?.link_data?.link || 'https://example.com' }
                    }
                }
            };
        }

        const createCreativeResponse = await fetch(`https://graph.facebook.com/v24.0/${cleanAccountIdForApi}/adcreatives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                name: `Creative for ${adData.name} - Updated ${new Date().toISOString()}`,
                object_story_spec: JSON.stringify(newObjectStorySpec),
                access_token: accessToken
            } as any)
        });
        const newCreativeData = await createCreativeResponse.json();
        if (newCreativeData.error) throw new Error(`Failed to create new creative: ${newCreativeData.error.message}`);

        const newCreativeId = newCreativeData.id;

        const updateAdResponse = await fetch(`https://graph.facebook.com/v24.0/${adId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                creative: JSON.stringify({ creative_id: newCreativeId }),
                access_token: accessToken
            } as any)
        });
        const updateAdResult = await updateAdResponse.json();
        if (updateAdResult.error) throw new Error(`Failed to update ad with new creative: ${updateAdResult.error.message}`);

        const updateData: Record<string, any> = {
            creative_id: newCreativeId,
            updated_at: new Date().toISOString()
        };
        if (creative.type === 'video') {
            updateData.video_id = creative.videoId;
            updateData.creative_hash = null;
        } else {
            updateData.creative_hash = creative.hash;
            updateData.video_id = null;
        }

        const { error: dbError } = await supabase.from('ads').update(updateData).eq('id', adId);
        if (dbError) console.warn(`[UPDATE-AD-CREATIVE] Warning: Failed to update local DB:`, dbError);

        return new Response(
            JSON.stringify({ success: true, adId, newCreativeId, message: 'Ad creative updated successfully' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("[UPDATE-AD-CREATIVE] Error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
}));

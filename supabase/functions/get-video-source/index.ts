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
 * Edge Function: get-video-source
 * Fetches the streaming source URL for a Meta video
 * Adoptado do app Leverads.AI 2026-05-19.
 */
serve(instrument("get-video-source", async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { videoId, adId, creativeId, accountId } = await req.json();

        if (!videoId && !adId && !creativeId) {
            return new Response(
                JSON.stringify({ error: 'videoId, adId, or creativeId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[GET-VIDEO-SOURCE] Request: videoId=${videoId}, adId=${adId}, accountId=${accountId}`);

        // @ts-ignore: Deno global
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        // @ts-ignore: Deno global
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'ads' } });

        let accessToken: string | null = null;
        let cleanAccountId: string | null = null;

        if (accountId) {
            cleanAccountId = accountId.replace(/^act_/i, '');
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

        let videoSource: string | null = null;
        let videoPicture: string | null = null;

        const getBestThumbnail = (data: any) => {
            if (data.thumbnails?.data?.length > 0) {
                return data.thumbnails.data[data.thumbnails.data.length - 1]?.uri || data.picture;
            }
            return data.picture;
        };

        const strategies: Promise<{ source: string | null, picture: string | null, description: string | null, title: string | null, name: string }>[] = [];

        if (videoId) {
            strategies.push((async () => {
                try {
                    const url = `https://graph.facebook.com/v24.0/${videoId}?fields=source,picture,thumbnails,description,title&access_token=${accessToken}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.source) {
                        return { source: data.source, picture: getBestThumbnail(data), description: data.description || null, title: data.title || null, name: 'direct' };
                    }
                } catch (e) { /* ignore */ }
                return { source: null, picture: null, description: null, title: null, name: 'direct' };
            })());
        }

        if (adId) {
            strategies.push((async () => {
                try {
                    const adUrl = `https://graph.facebook.com/v24.0/${adId}?fields=creative{video_id,body,title,object_story_spec{link_data{description,link_description,caption,name},video_data{video_id,description,title,link_description,caption}}}&access_token=${accessToken}`;
                    const adRes = await fetch(adUrl);
                    const adData = await adRes.json();
                    const oss = adData.creative?.object_story_spec || {};
                    const linkData = oss.link_data || {};
                    const videoData = oss.video_data || {};
                    const foundVideoId = adData.creative?.video_id || videoData.video_id;

                    const foundDescription =
                        linkData.description ||
                        linkData.link_description ||
                        linkData.caption ||
                        videoData.description ||
                        videoData.link_description ||
                        videoData.caption ||
                        adData.creative?.body ||
                        null;
                    const foundTitle = linkData.name || videoData.title || adData.creative?.title || null;

                    if (foundVideoId) {
                        const videoUrl = `https://graph.facebook.com/v24.0/${foundVideoId}?fields=source,picture,thumbnails&access_token=${accessToken}`;
                        const videoRes = await fetch(videoUrl);
                        const vData = await videoRes.json();
                        if (vData.source) {
                            return { source: vData.source, picture: getBestThumbnail(vData), description: foundDescription, title: foundTitle, name: 'via-ad' };
                        }
                    }
                } catch (e) { /* ignore */ }
                return { source: null, picture: null, description: null, title: null, name: 'via-ad' };
            })());
        }

        if (videoId && cleanAccountId) {
            strategies.push((async () => {
                try {
                    const searchUrl = `https://graph.facebook.com/v24.0/act_${cleanAccountId}/advideos?fields=id,source,picture,thumbnails,description,title&limit=50&access_token=${accessToken}`;
                    const res = await fetch(searchUrl);
                    const data = await res.json();
                    const found = data.data?.find((v: any) => v.id === videoId);
                    if (found?.source) {
                        return { source: found.source, picture: getBestThumbnail(found), description: found.description || null, title: found.title || null, name: 'advideos' };
                    }
                } catch (e) { /* ignore */ }
                return { source: null, picture: null, description: null, title: null, name: 'advideos' };
            })());
        }

        let videoDescription: string | null = null;
        let videoTitle: string | null = null;

        if (strategies.length > 0) {
            const results = await Promise.all(strategies);
            for (const result of results) {
                if (result.source) {
                    videoSource = result.source;
                    videoPicture = result.picture;
                    videoDescription = result.description;
                    videoTitle = result.title;
                    break;
                }
            }
        }

        if (videoSource) {
            return new Response(
                JSON.stringify({ source: videoSource, picture: videoPicture, description: videoDescription, title: videoTitle, success: true }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        } else {
            return new Response(
                JSON.stringify({ source: null, picture: videoPicture, success: false, error: 'Video nao disponivel para preview' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

    } catch (error: any) {
        console.error('[GET-VIDEO-SOURCE] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message, success: false }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}));

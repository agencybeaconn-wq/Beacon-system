// @ts-ignore
// Version: 2.0.0 - Fixed to use ad_accounts.access_token directly (2024-12-31)
import { instrument } from "../_shared/logger.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const META_API_VERSION = "v24.0";
serve(instrument("scan-ad-comments", async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    // @ts-ignore
    const encryptionKey = Deno.env.get("FB_TOKEN_ENCRYPTION_KEY") || "default-key-change-me";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: {
        schema: 'ads'
      }
    });
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");
    const body = await req.json();
    const { adAccountId, fbConnectionId, limit = 25 } = body;
    if (!adAccountId) throw new Error("adAccountId is required");
    console.log(`💬 [scan-ad-comments] Scanning ADS for UNANSWERED comments: ${adAccountId}`);
    // Get access token from ad_accounts table (for fetching ads)
    const { data: adAccount, error: adAccountError } = await supabase.from("ad_accounts").select("access_token, user_id").eq("id", adAccountId).single();
    if (adAccountError || !adAccount?.access_token) {
      console.error("❌ [scan-ad-comments] Ad account or token not found:", adAccountError);
      throw new Error("Ad account not found or access token missing");
    }
    const accessToken = adAccount.access_token;
    console.log(`🔑 [scan-ad-comments] Token retrieved from ad_accounts. Length: ${accessToken?.length || 0}`);
    // 🔑 Get the FB connection token (has pages_read_engagement permission)
    // First get the workspace for this user
    const { data: workspace } = await supabase.from("workspaces").select("id").eq("owner_id", adAccount.user_id).single();
    let workspaceId = workspace?.id;
    if (!workspaceId) {
      const { data: membership } = await supabase.from("team_members").select("workspace_id").eq("user_id", adAccount.user_id).eq("status", "active").single();
      workspaceId = membership?.workspace_id;
    }
    let patriarchToken = accessToken; // Fallback
    if (workspaceId) {
      // Use fbConnectionId if provided, otherwise fallback to is_patriarch
      let fbConnection;
      if (fbConnectionId) {
        const { data } = await supabase.from("fb_connections").select("access_token_encrypted").eq("id", fbConnectionId).single();
        fbConnection = data;
      } else {
        const { data } = await supabase.from("fb_connections").select("access_token_encrypted").eq("workspace_id", workspaceId).eq("is_patriarch", true).single();
        fbConnection = data;
      }
      if (fbConnection?.access_token_encrypted) {
        // @ts-ignore
        const encryptionKey = Deno.env.get("FB_TOKEN_ENCRYPTION_KEY") || "default-key-change-me";
        const { data: decryptedToken } = await supabase.rpc("decrypt_fb_token", {
          encrypted_token: fbConnection.access_token_encrypted,
          encryption_key: encryptionKey
        });
        if (decryptedToken) {
          patriarchToken = decryptedToken;
          console.log(`🔐 [scan-ad-comments] FB connection token decrypted. Length: ${patriarchToken.length}`);
        }
      }
    }
    // Get default page ID from account_settings
    const { data: accountSettings } = await supabase.from('account_settings').select('default_page_id').eq('ad_account_id', adAccountId).maybeSingle();
    const defaultPageId = accountSettings?.default_page_id;
    console.log(`📄 [scan-ad-comments] Default Page ID: ${defaultPageId || 'not set'}`);
    // Sentiment analysis function
    const analyzeSentiment = (text)=>{
      const lowerText = text.toLowerCase();
      const positiveWords = [
        'ótimo',
        'excelente',
        'maravilhoso',
        'perfeito',
        'amei',
        'adorei',
        'parabéns',
        'recomendo',
        'top',
        'incrível',
        'bom',
        'boa',
        'legal',
        'love',
        'great',
        'amazing',
        'awesome',
        'obrigado',
        'obrigada',
        'show',
        '❤️',
        '👏',
        '🔥',
        '💪',
        'quero',
        'como faço',
        'interessado',
        'qual o preço',
        'quanto custa'
      ];
      const negativeWords = [
        'ruim',
        'péssimo',
        'horrível',
        'caro',
        'decepcionado',
        'nunca',
        'golpe',
        'fraude',
        'scam',
        'fake',
        'não comprem',
        'não recomendo',
        'bad',
        'terrible',
        'worst',
        'mentira',
        'enganação',
        'demora',
        'atraso',
        'não entregou',
        'não chegou',
        'roubou',
        'furada'
      ];
      const hasPositive = positiveWords.some((word)=>lowerText.includes(word));
      const hasNegative = negativeWords.some((word)=>lowerText.includes(word));
      if (hasNegative) return 'negative';
      if (hasPositive && !hasNegative) return 'positive';
      return 'neutral';
    };
    // Check if comment is a question/needs reply
    const needsReply = (text)=>{
      const lowerText = text.toLowerCase();
      const questionIndicators = [
        '?',
        'como',
        'quanto',
        'qual',
        'onde',
        'quando',
        'quero',
        'gostaria',
        'preciso',
        'procuro',
        'pix',
        'whatsapp',
        'telefone',
        'encomenda',
        'entrega',
        'frete',
        'prazo',
        'tamanho',
        'cor',
        'disponível',
        'tem'
      ];
      return questionIndicators.some((indicator)=>lowerText.includes(indicator));
    };
    // Verify defaultPageId is available (needed to check if page already replied)
    if (!defaultPageId) {
      console.log(`⚠️ [scan-ad-comments] No default page ID set, will use page ID from ad posts.`);
    }
    console.log(`📄 [scan-ad-comments] Using Page ID for replies check: ${defaultPageId || 'will auto-detect from ads'}`);
    // 🔑 Get ALL Page Access Tokens using /me/accounts (official Meta approach)
    // Cache all page tokens so we can match dynamically per ad
    const pageTokenCache = new Map();
    let diagnosticInfo = {
      patriarchTokenLength: patriarchToken?.length || 0,
      defaultPageId: defaultPageId,
      pagesFound: 0,
      pageIds: [],
      cachedPageTokens: 0,
      error: null
    };
    try {
      console.log(`📄 [scan-ad-comments] Getting ALL Page Access Tokens via /me/accounts...`);
      console.log(`📄 [scan-ad-comments] Patriarch token length: ${patriarchToken?.length || 0}`);
      const accountsUrl = `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=id,name,access_token&access_token=${patriarchToken}`;
      const accountsResponse = await fetch(accountsUrl);
      const accountsData = await accountsResponse.json();
      if (accountsData.error) {
        console.log(`⚠️ [scan-ad-comments] Error fetching /me/accounts: ${JSON.stringify(accountsData.error)}`);
        diagnosticInfo.error = accountsData.error?.message || 'Unknown error';
      } else if (accountsData.data) {
        const pages = accountsData.data;
        diagnosticInfo.pagesFound = pages.length;
        diagnosticInfo.pageIds = pages.map((p)=>p.id);
        console.log(`📄 [scan-ad-comments] Found ${pages.length} managed pages: ${pages.map((p)=>`${p.name} (${p.id})`).join(', ')}`);
        // Cache ALL page tokens
        for (const page of pages){
          if (page.id && page.access_token) {
            pageTokenCache.set(page.id, page.access_token);
          }
        }
        diagnosticInfo.cachedPageTokens = pageTokenCache.size;
        console.log(`🔑 [scan-ad-comments] Cached ${pageTokenCache.size} Page Access Tokens`);
      } else {
        diagnosticInfo.error = 'No data in /me/accounts response';
      }
    } catch (err) {
      console.log(`⚠️ [scan-ad-comments] Exception getting Page Access Tokens:`, err);
      diagnosticInfo.error = err?.message || 'Exception';
    }
    // Helper function to get the right token for a given post
    const getTokenForPost = (postId)=>{
      // Extract Page ID from effective_object_story_id (format: PAGE_ID_POST_ID)
      const parts = postId.split('_');
      const pageId = parts.length >= 2 ? parts[0] : null;
      if (pageId && pageTokenCache.has(pageId)) {
        return {
          token: pageTokenCache.get(pageId),
          pageId
        };
      }
      // Fallback: try defaultPageId if set
      if (defaultPageId && pageTokenCache.has(defaultPageId)) {
        return {
          token: pageTokenCache.get(defaultPageId),
          pageId: defaultPageId
        };
      }
      // Last resort: use patriarch token (likely to fail with permission error)
      return {
        token: patriarchToken,
        pageId
      };
    };
    console.log(`🔍 [scan-ad-comments] DIAGNOSTIC INFO: ${JSON.stringify(diagnosticInfo)}`);
    // 2. Fetch ACTIVE ADS directly instead of Page Feed
    // This is critical: We want comments on ADS, not just organic posts
    const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/ads?` + `fields=id,name,campaign{id,name},creative{id,effective_object_story_id}&` + `effective_status=['ACTIVE']&limit=50&access_token=${accessToken}`;
    console.log(`📋 [scan-ad-comments] Fetching active ads...`);
    const adsResponse = await fetch(adsUrl);
    const adsData = await adsResponse.json();
    if (adsData.error) {
      throw new Error(`Error fetching ads: ${adsData.error.message}`);
    }
    const activeAds = adsData.data || [];
    console.log(`📋 [scan-ad-comments] Found ${activeAds.length} active ads.`);
    // 3. Scan comments on each ad's underlying post (effective_object_story_id)
    const allUnansweredComments = [];
    let totalCommentsScanned = 0;
    let permissionErrorCount = 0;
    let permissionErrorMessage = '';
    // Dedup posts (multiple ads might use same post)
    const processedPostIds = new Set();
    for (const ad of activeAds){
      const postId = ad.creative?.effective_object_story_id;
      if (!postId || processedPostIds.has(postId)) continue;
      processedPostIds.add(postId);
      try {
        // Get the correct Page Access Token for this specific post
        const { token: postToken, pageId: postPageId } = getTokenForPost(postId);
        if (postToken === patriarchToken) {
          console.log(`⚠️ [scan-ad-comments] No Page Token found for post ${postId} (Page: ${postPageId}), using fallback patriarch token`);
        } else {
          console.log(`🔑 [scan-ad-comments] Using Page Token for post ${postId} (Page: ${postPageId})`);
        }
        // Fetch comments WITH replies count
        const commentsUrl = `https://graph.facebook.com/${META_API_VERSION}/${postId}/comments?` + `fields=id,message,from,created_time,like_count,comment_count,is_hidden,` + `comments{id,from,message}` + // Get replies to check if answered
        `&limit=50&order=reverse_chronological&filter=stream&access_token=${postToken}`;
        const commentsResponse = await fetch(commentsUrl);
        const commentsData = await commentsResponse.json();
        if (commentsData.error) {
          const errorMsg = commentsData.error.message || 'Unknown error';
          const errorCode = commentsData.error.code || 0;
          console.log(`⚠️ [scan-ad-comments] Error getting comments for post ${postId} (Ad: ${ad.name}): [Code: ${errorCode}] ${errorMsg}`);
          // Track permission errors specifically
          if (errorCode === 10 || errorMsg.includes('pages_read_engagement') || errorMsg.includes('permission')) {
            permissionErrorCount++;
            permissionErrorMessage = errorMsg;
            console.log(`🔐 [scan-ad-comments] PERMISSION ERROR detected for Page ${postPageId}.`);
            console.log(`🔐 [scan-ad-comments] This usually means the user is not an admin of this page, or the page is not in their managed pages list.`);
            console.log(`🔐 [scan-ad-comments] Available pages: ${diagnosticInfo.pageIds.join(', ')}`);
          }
          continue;
        }
        const comments = commentsData.data || [];
        totalCommentsScanned += comments.length;
        // Filter for UNANSWERED comments only
        for (const comment of comments){
          // Skip hidden comments
          if (comment.is_hidden) continue;
          // Skip comments from the Page itself (if any slipped through)
          if (comment.from?.id === defaultPageId) continue;
          // Check if the page already replied
          const replies = comment.comments?.data || [];
          const pageReplied = replies.some((reply)=>reply.from?.id === defaultPageId);
          // If not replied by page
          if (!pageReplied) {
            allUnansweredComments.push({
              id: comment.id,
              message: comment.message,
              from: comment.from,
              created_time: comment.created_time,
              like_count: comment.like_count,
              comment_count: comment.comment_count,
              is_hidden: comment.is_hidden,
              sentiment: analyzeSentiment(comment.message || ''),
              has_reply: false,
              ad_id: ad.id,
              ad_name: ad.name,
              campaign_id: ad.campaign?.id,
              campaign_name: ad.campaign?.name,
              post_id: postId
            });
          }
        }
      } catch (err) {
        console.log(`⚠️ [scan-ad-comments] Error processing ad post ${postId}:`, err);
      }
    }
    // Sort unanswered comments: questions first, then negative, then by date
    allUnansweredComments.sort((a, b)=>{
      const aIsQuestion = needsReply(a.message || '');
      const bIsQuestion = needsReply(b.message || '');
      const aIsNegative = a.sentiment === 'negative';
      const bIsNegative = b.sentiment === 'negative';
      // Questions first
      if (aIsQuestion && !bIsQuestion) return -1;
      if (!aIsQuestion && bIsQuestion) return 1;
      // Then negatives
      if (aIsNegative && !bIsNegative) return -1;
      if (!aIsNegative && bIsNegative) return 1;
      // Then by date (newest first)
      return new Date(b.created_time).getTime() - new Date(a.created_time).getTime();
    });
    console.log(`📊 [scan-ad-comments] Found ${allUnansweredComments.length} unanswered comments out of ${totalCommentsScanned} total.`);
    // 3. Generate insights based on unanswered comments
    const insights = [];
    const negativeUnanswered = allUnansweredComments.filter((c)=>c.sentiment === 'negative');
    const questionUnanswered = allUnansweredComments.filter((c)=>needsReply(c.message || ''));
    // Insight for negative unanswered comments (HIGH PRIORITY)
    if (negativeUnanswered.length > 0) {
      insights.push({
        type: 'COMMENT',
        severity: 'HIGH',
        title: `🚨 ${negativeUnanswered.length} comentário(s) negativo(s) sem resposta`,
        subtitle: 'Requer atenção imediata',
        unanswered_count: negativeUnanswered.length,
        sample_comments: negativeUnanswered.slice(0, 5).map((c)=>({
            id: c.id,
            author: c.from?.name || 'Usuário',
            text: c.message,
            timestamp: c.created_time,
            sentiment: c.sentiment,
            ad_name: c.ad_name,
            ad_id: c.ad_id,
            post_id: c.post_id
          })),
        automation_action: 'Responder Urgente'
      });
    }
    // Insight for question comments (potential leads)
    if (questionUnanswered.length > 0) {
      insights.push({
        type: 'OPPORTUNITY',
        severity: 'MEDIUM',
        title: `💬 ${questionUnanswered.length} pergunta(s) de potenciais clientes sem resposta`,
        subtitle: 'Possíveis leads aguardando',
        unanswered_count: questionUnanswered.length,
        sample_comments: questionUnanswered.slice(0, 5).map((c)=>({
            id: c.id,
            author: c.from?.name || 'Usuário',
            text: c.message,
            timestamp: c.created_time,
            sentiment: c.sentiment,
            ad_name: c.ad_name,
            ad_id: c.ad_id,
            post_id: c.post_id
          })),
        automation_action: 'Responder para Converter'
      });
    }
    // Summary insight if there are any unanswered
    if (allUnansweredComments.length > 0) {
      insights.unshift({
        type: 'COMMENT',
        severity: allUnansweredComments.length >= 10 ? 'HIGH' : 'MEDIUM',
        title: `📬 ${allUnansweredComments.length} comentário(s) aguardando resposta`,
        subtitle: `${negativeUnanswered.length} negativos, ${questionUnanswered.length} perguntas`,
        total_unanswered: allUnansweredComments.length,
        negative_count: negativeUnanswered.length,
        question_count: questionUnanswered.length,
        automation_action: 'Gerenciar Comentários'
      });
    }
    // Add warning insight if there were permission errors
    if (permissionErrorCount > 0) {
      insights.unshift({
        type: 'WARNING',
        severity: 'HIGH',
        title: `🔐 Erro de acesso aos comentários`,
        subtitle: `${permissionErrorCount} anúncio(s) não puderam ser escaneados`,
        description: "Não conseguimos obter o Token de Acesso da Página para ler os comentários. Verifique se você é Administrador da página que publica os anúncios.",
        solution: 'Reconecte seu perfil do Facebook em Configurações > Conexões e garanta que todas as permissões de Página foram aceitas.',
        automation_action: 'Reconectar Perfil'
      });
    }
    return new Response(JSON.stringify({
      success: true,
      scanned_ads: activeAds.length,
      total_comments_scanned: totalCommentsScanned,
      unanswered_count: allUnansweredComments.length,
      negative_unanswered: negativeUnanswered.length,
      question_unanswered: questionUnanswered.length,
      insights,
      unanswered_comments: allUnansweredComments,
      // Permission error details for debugging
      permission_error: permissionErrorCount > 0 ? {
        count: permissionErrorCount,
        message: permissionErrorMessage,
        solution: 'Reconnect your Facebook profile. Ensure you grant "pages_read_engagement" and that you are an Admin of the page linked to the ads.'
      } : null,
      diagnostic: diagnosticInfo
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ [scan-ad-comments] Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
}));

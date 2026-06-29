// @ts-expect-error - Deno import
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// @ts-expect-error - Deno global
import { instrument } from "../_shared/logger.ts";
Deno.serve(instrument("manage-meta-assets", async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Check Content-Type to decide how to parse
    const contentType = req.headers.get('content-type') || '';
    let accountId, action, accessToken, fileData, fileName, limit, type, cursors;
    if (contentType.includes('application/json')) {
      const body = await req.json();
      accountId = body.accountId;
      action = body.action;
      accessToken = body.accessToken;
      fileData = body.fileData // Base64 string for upload
      ;
      fileName = body.fileName;
      limit = body.limit || 100 // Default to 100 if not provided
      ;
      type = body.type;
      cursors = body.cursors;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      accountId = formData.get('accountId');
      action = formData.get('action');
      accessToken = formData.get('accessToken');
      const file = formData.get('file');
      limit = formData.get('limit') || 100;
      type = formData.get('type');
      const cursorsStr = formData.get('cursors');
      if (typeof cursorsStr === 'string') {
        try {
          cursors = JSON.parse(cursorsStr);
        } catch (e) {
          cursors = {};
        }
      }
      if (file instanceof File) {
        fileName = file.name;
        // Convert File to Base64
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for(let i = 0; i < bytes.byteLength; i++){
          binary += String.fromCharCode(bytes[i]);
        }
        fileData = btoa(binary);
      }
    } else {
      throw new Error('Content-Type not supported. Use application/json or multipart/form-data');
    }
    if (!accountId || !action || !accessToken) {
      console.error('❌ [ASSETS] Missing fields:', {
        accountId,
        action,
        accessToken: accessToken ? 'PRESENT' : 'MISSING'
      });
      throw new Error('Missing required fields: accountId, action, accessToken');
    }
    // Ensure 'act_' prefix
    if (!accountId.startsWith('act_')) {
      accountId = `act_${accountId}`;
    }
    console.log(`🔧 [ASSETS] Processing action: ${action} for account: ${accountId} with limit: ${limit}`);
    const baseUrl = `https://graph.facebook.com/v24.0/${accountId}`;
    if (action === 'LIST') {
      const reqType = (type || 'ALL').toUpperCase(); // ALL, IMAGE, VIDEO
      const reqCursors = cursors || {}; // { images: 'after_cursor', videos: 'after_cursor' }
      console.log(`🔍 [ASSETS] Listing assets for ${accountId} - Type: ${reqType} - Limit: ${limit}`);
      let imagesUrl = null;
      let videosUrl = null;
      // Constuct URLs based on Type
      if (reqType === 'ALL' || reqType === 'IMAGE') {
        const afterCursor = reqCursors.images ? `&after=${reqCursors.images}` : '';
        imagesUrl = `${baseUrl}/adimages?fields=hash,name,url,url_128,status,created_time&limit=${limit}${afterCursor}&access_token=${accessToken}`;
      }
      if (reqType === 'ALL' || reqType === 'VIDEO') {
        const afterCursor = reqCursors.videos ? `&after=${reqCursors.videos}` : '';
        videosUrl = `${baseUrl}/advideos?fields=id,title,source,picture,thumbnails,status,length,created_time&limit=${limit}${afterCursor}&access_token=${accessToken}`;
      }
      // Fetch Data Concurrently
      const [imagesRes, videosRes] = await Promise.all([
        imagesUrl ? fetch(imagesUrl) : Promise.resolve(null),
        videosUrl ? fetch(videosUrl) : Promise.resolve(null)
      ]);
      // Process Images
      let imagesData = [];
      let imagesPaging = null;
      if (imagesRes) {
        if (!imagesRes.ok) throw new Error(`Meta API Error (Images): ${await imagesRes.text()}`);
        const json = await imagesRes.json();
        if (json.error) throw new Error(`Meta API Error (Images): ${json.error.message}`);
        imagesData = json.data || [];
        imagesPaging = json.paging;
      }
      // Process Videos
      let videosData = [];
      let videosPaging = null;
      if (videosRes) {
        // 🔍 DEBUG: Log video response status
        console.log(`🎬 [ASSETS] Videos API Response: status=${videosRes.status}, ok=${videosRes.ok}`);
        if (videosRes.ok) {
          const json = await videosRes.json();
          console.log(`🎬 [ASSETS] Videos API returned ${json.data?.length || 0} videos`);
          if (!json.error) {
            videosData = json.data || [];
            videosPaging = json.paging;
          } else {
            console.error(`🎬 [ASSETS] Videos API Error:`, json.error);
          }
        } else {
          // Log the error if videos API fails
          const errorText = await videosRes.text();
          console.error(`🎬 [ASSETS] Videos API Failed: ${errorText}`);
        }
      } else {
        console.log(`🎬 [ASSETS] No videos URL was constructed (type filter may exclude videos)`);
      }
      // Normalize Data
      const normalizedImages = imagesData.map((img)=>({
          id: img.hash,
          type: 'IMAGE',
          name: img.name || img.hash,
          url: img.url,
          thumbnail: img.url_128 || img.url,
          hash: img.hash,
          status: img.status?.status || 'ACTIVE',
          created_time: img.created_time
        }));
      const normalizedVideos = videosData.map((vid)=>{
        let thumbnail = vid.picture;
        if (vid.thumbnails?.data?.length > 0) {
          thumbnail = vid.thumbnails.data[vid.thumbnails.data.length - 1]?.uri || vid.picture;
        }
        return {
          id: vid.id,
          type: 'VIDEO',
          name: vid.title || `Video ${vid.id}`,
          url: vid.source,
          thumbnail: thumbnail,
          hash: null,
          status: vid.status?.video_status || 'READY',
          duration: vid.length,
          created_time: vid.created_time
        };
      });
      // Combine and Sort
      // 🔧 FIX: Deduplicate images that are video thumbnails
      // Get all video thumbnail URLs to filter duplicates
      const videoThumbnailUrls = new Set();
      normalizedVideos.forEach((vid)=>{
        if (vid.thumbnail) videoThumbnailUrls.add(vid.thumbnail);
      });
      // Filter out images that are video thumbnails (duplicate detection)
      const dedupedImages = normalizedImages.filter((img)=>{
        // If the image URL matches a video thumbnail URL, it's a duplicate
        if (videoThumbnailUrls.has(img.url) || videoThumbnailUrls.has(img.thumbnail)) {
          console.log(`🗑️ [ASSETS] Filtering out duplicate image: ${img.name} (matches video thumbnail)`);
          return false;
        }
        return true;
      });
      let allAssets = [
        ...dedupedImages,
        ...normalizedVideos
      ].sort((a, b)=>{
        const dateA = a.created_time ? new Date(a.created_time).getTime() : 0;
        const dateB = b.created_time ? new Date(b.created_time).getTime() : 0;
        return dateB - dateA;
      });
      // Apply limit to the combined results
      // When type is ALL, we fetch 'limit' from both images AND videos, so we need to slice
      const hasMoreAfterSlice = allAssets.length > limit;
      if (reqType === 'ALL' && allAssets.length > limit) {
        allAssets = allAssets.slice(0, limit);
      }
      // Determine if there's a next page
      // Either the API says there's more, or we had to slice the results
      const hasNextPage = !!(imagesPaging?.next || videosPaging?.next || hasMoreAfterSlice);
      return new Response(JSON.stringify({
        data: allAssets,
        paging: {
          cursors: {
            images: imagesPaging?.cursors?.after || null,
            videos: videosPaging?.cursors?.after || null
          },
          next: hasNextPage
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (action === 'UPLOAD') {
      console.log(`⬆️ [ASSETS] Uploading asset to ${accountId}`);
      if (!fileData) {
        throw new Error('Missing file data for upload');
      }
      // Only supporting Images for now as per requirement "Action 'UPLOAD' (Imagens)"
      // For videos, it's a more complex chunked upload process usually.
      const uploadUrl = `${baseUrl}/adimages`;
      const params = new URLSearchParams();
      params.append('access_token', accessToken);
      params.append('bytes', fileData) // Base64 encoded image
      ;
      if (fileName) {
        params.append('name', fileName);
      }
      // Meta Graph API expects 'bytes' parameter for direct upload
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: params
      });
      const json = await res.json();
      if (json.error) {
        console.error('Meta Upload Error:', json.error);
        throw new Error(`Meta API Upload Error: ${json.error.message}`);
      }
      // Success response: { images: { "filename": { hash: "...", url: "..." } } }
      // The key is the filename or "bytes" if not provided.
      const resultKey = Object.keys(json.images || {})[0];
      const imageData = json.images?.[resultKey];
      if (!imageData) {
        throw new Error('Upload successful but no image data returned');
      }
      return new Response(JSON.stringify({
        success: true,
        data: {
          id: imageData.hash,
          hash: imageData.hash,
          url: imageData.url,
          name: fileName || imageData.hash
        }
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (action === 'getAdIdentities') {
      // Fetch Facebook Pages linked to the ad account
      console.log(`📄 [ASSETS] Fetching ad identities (pages) for ${accountId}`);
      // First, get the business ID or user pages
      const pagesUrl = `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,picture&access_token=${accessToken}`;
      console.log(`🔗 [ASSETS] Fetching pages from: ${pagesUrl.replace(accessToken, 'HIDDEN')}`);
      const pagesRes = await fetch(pagesUrl);
      const pagesJson = await pagesRes.json();
      if (pagesJson.error) {
        console.error(`❌ [ASSETS] Meta API Error (Pages):`, pagesJson.error);
        throw new Error(`Meta API Error: ${pagesJson.error.message}`);
      }
      const pages = pagesJson.data || [];
      console.log(`✅ [ASSETS] Found ${pages.length} pages`);
      return new Response(JSON.stringify({
        pages: pages.map((p)=>({
            id: p.id,
            name: p.name,
            picture: p.picture?.data?.url
          }))
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else if (action === 'getAccountPixels') {
      // Fetch pixels for the ad account
      console.log(`🔗 [ASSETS] Fetching pixels for ${accountId}`);
      const pixelsUrl = `${baseUrl}/adspixels?fields=id,name,code,last_fired_time&access_token=${accessToken}`;
      console.log(`🔗 [ASSETS] Fetching pixels from: ${pixelsUrl.replace(accessToken, 'HIDDEN')}`);
      const pixelsRes = await fetch(pixelsUrl);
      const pixelsJson = await pixelsRes.json();
      if (pixelsJson.error) {
        console.error(`❌ [ASSETS] Meta API Error (Pixels):`, pixelsJson.error);
        throw new Error(`Meta API Error: ${pixelsJson.error.message}`);
      }
      const pixels = pixelsJson.data || [];
      console.log(`✅ [ASSETS] Found ${pixels.length} pixels`);
      return new Response(JSON.stringify({
        pixels: pixels.map((p)=>({
            id: p.id,
            name: p.name
          }))
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } else {
      throw new Error(`Invalid action: ${action}`);
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error) {
    console.error('❌ [ASSETS] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}));

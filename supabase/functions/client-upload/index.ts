// Edge function: client-upload
// Endpoint publico (sem JWT) usado pela pagina /upload/<token>.
// Actions:
//   - INFO: retorna metadados do link
//   - UPLOAD: recebe arquivo -> Storage (backup) -> Meta Ads (asset library) -> client_uploads + asset_folder_items
// Adoptado do Leverads.AI 2026-05-19.
// @ts-nocheck
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']);
const ALLOWED_MIMES = new Set([...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES]);

function isVideo(mime) { return ALLOWED_VIDEO_MIMES.has(mime); }

const META_API_VERSION = 'v24.0';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getLink(supabase, token) {
  const { data, error } = await supabase
    .from('client_upload_links')
    .select('id, user_id, account_id, target_folder_id, name, is_active, expires_at, max_file_size_mb, agency_client_id')
    .eq('token', token).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;
  return data;
}

async function uploadImageToMeta(accountId, accessToken, base64, fileName) {
  const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const params = new URLSearchParams();
  params.append('access_token', accessToken);
  params.append('bytes', base64);
  params.append('name', fileName);
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${actId}/adimages`, { method: 'POST', body: params });
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  const key = Object.keys(json.images || {})[0];
  const data = json.images?.[key];
  if (!data) throw new Error('Meta: upload sem retorno');
  return { metaAssetId: data.hash, metaAssetUrl: data.url };
}

async function uploadVideoToMeta(accountId, accessToken, file) {
  const actId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const fd = new FormData();
  fd.append('access_token', accessToken);
  fd.append('source', file, file.name);
  if (file.name) fd.append('name', file.name);
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${actId}/advideos`, { method: 'POST', body: fd });
  const json = await res.json();
  if (json.error) throw new Error(`Meta video: ${json.error.message}`);
  if (!json.id) throw new Error('Meta video: upload sem retorno');
  return { metaAssetId: json.id, metaAssetUrl: null };
}

Deno.serve(instrument("client-upload", async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: 'ads' }, auth: { persistSession: false }
  });

  try {
    const url = new URL(req.url);
    const action = (url.searchParams.get('action') || '').toUpperCase();
    const token = url.searchParams.get('token') || '';
    if (!token) return jsonResponse({ error: 'token required' }, 400);

    const link = await getLink(supabase, token);
    if (!link) return jsonResponse({ error: 'Link invalido, inativo ou expirado.' }, 404);

    if (req.method === 'GET' && action === 'INFO') {
      let clientName = null;
      if (link.agency_client_id) {
        const { data: client } = await supabase.from('agency_clients').select('name').eq('id', link.agency_client_id).maybeSingle();
        clientName = client?.name ?? null;
      }
      return jsonResponse({
        name: link.name, clientName,
        maxFileSizeMb: link.max_file_size_mb,
        allowedMimes: Array.from(ALLOWED_MIMES)
      });
    }

    if (req.method === 'POST' && action === 'UPLOAD') {
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return jsonResponse({ error: 'Use multipart/form-data' }, 400);
      }
      const formData = await req.formData();
      const file = formData.get('file');
      const clientMessage = formData.get('message') || null;
      if (!(file instanceof File)) return jsonResponse({ error: 'file ausente' }, 400);
      if (!ALLOWED_MIMES.has(file.type)) return jsonResponse({ error: `Formato nao suportado: ${file.type}.` }, 400);

      const maxBytes = link.max_file_size_mb * 1024 * 1024;
      if (file.size > maxBytes) return jsonResponse({ error: `Arquivo maior que ${link.max_file_size_mb}MB.` }, 400);

      const { data: account } = await supabase.from('ad_accounts').select('access_token').eq('id', link.account_id).maybeSingle();
      if (!account?.access_token) return jsonResponse({ error: 'Conta Meta sem token valido. Avise sua agencia.' }, 400);

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const safeName = file.name.replace(/[^\w.\-]/g, '_').slice(0, 80);
      const storagePath = `${token}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageErr } = await supabase.storage.from('client-uploads').upload(storagePath, bytes, { contentType: file.type, upsert: false });
      if (storageErr) console.warn('Storage upload falhou (seguindo mesmo assim):', storageErr.message);

      const fileIsVideo = isVideo(file.type);
      const assetType = fileIsVideo ? 'VIDEO' : 'IMAGE';
      let metaAsset;
      try {
        if (fileIsVideo) {
          metaAsset = await uploadVideoToMeta(link.account_id, account.access_token, file);
        } else {
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          metaAsset = await uploadImageToMeta(link.account_id, account.access_token, base64, file.name);
        }
      } catch (e) {
        if (!storageErr) await supabase.storage.from('client-uploads').remove([storagePath]).catch(() => null);
        return jsonResponse({ error: e?.message || 'Falha ao enviar pra Meta' }, 502);
      }

      const { data: inserted, error: insertError } = await supabase.from('client_uploads').insert({
        link_id: link.id, user_id: link.user_id, account_id: link.account_id,
        file_name: file.name, file_size: file.size, mime_type: file.type, asset_type: assetType,
        storage_path: storageErr ? 'direct' : storagePath, client_message: clientMessage,
        folder_id: link.target_folder_id, status: 'accepted',
        meta_asset_id: metaAsset.metaAssetId, meta_asset_url: metaAsset.metaAssetUrl,
        reviewed_at: new Date().toISOString()
      }).select('id, file_name, status, uploaded_at').single();

      if (insertError) return jsonResponse({ error: 'Falha ao registrar upload (Meta upload OK).' }, 500);

      if (link.target_folder_id) {
        const { error: linkErr } = await supabase.from('asset_folder_items').insert({
          folder_id: link.target_folder_id, asset_id: metaAsset.metaAssetId,
          asset_type: assetType, user_id: link.user_id
        });
        if (linkErr) console.warn('Falha ao linkar asset a pasta:', linkErr.message);
      }

      return jsonResponse({ success: true, upload: inserted });
    }

    return jsonResponse({ error: 'Action invalida. Use INFO ou UPLOAD.' }, 400);
  } catch (err) {
    console.error('client-upload error:', err);
    return jsonResponse({ error: err?.message || 'Erro interno' }, 500);
  }
}));

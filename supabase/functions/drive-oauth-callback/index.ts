// Edge function: drive-oauth-callback
// Endpoint público — Google chama com ?code=...&state=... após o usuário autorizar.
// Troca code por tokens, cria pasta raiz "LeverAds" no Drive, salva conexão.
// Redireciona usuário de volta pra app.
// @ts-nocheck
import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const GOOGLE_DRIVE_CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
const GOOGLE_DRIVE_CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
// URL pra onde redirecionamos o usuário depois de salvar (frontend)
const APP_URL = Deno.env.get('APP_URL') || 'https://agencybeacon.site';
function htmlRedirect(url, msg = 'Redirecionando...') {
  // HTML simples com meta refresh — confiável mesmo se JS desabilitado
  return new Response(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${url}"></head><body><p>${msg}</p><script>window.location.href=${JSON.stringify(url)}</script></body></html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
function errorRedirect(error) {
  const url = `${APP_URL}/connections?drive_error=${encodeURIComponent(error)}`;
  return htmlRedirect(url, `Erro: ${error}`);
}
Deno.serve(instrument("drive-oauth-callback", async (req)=>{
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');
    if (errorParam) return errorRedirect(`Google: ${errorParam}`);
    if (!code || !state) return errorRedirect('code ou state ausente');
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      db: {
        schema: 'ads'
      },
      auth: {
        persistSession: false
      }
    });
    // 1. Valida state e pega user_id
    const { data: stateRow, error: stateErr } = await admin.from('drive_oauth_states').select('user_id, expires_at').eq('state', state).maybeSingle();
    if (stateErr || !stateRow) return errorRedirect('state inválido');
    if (new Date(stateRow.expires_at) <= new Date()) return errorRedirect('state expirado');
    // Consume state (single-use)
    await admin.from('drive_oauth_states').delete().eq('state', state);
    const userId = stateRow.user_id;
    // 2. Troca code por tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/drive-oauth-callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        client_secret: GOOGLE_DRIVE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error) {
      console.error('Token exchange failed:', tokenJson);
      return errorRedirect(tokenJson.error_description || tokenJson.error || 'token exchange falhou');
    }
    const { access_token, refresh_token, expires_in } = tokenJson;
    if (!refresh_token) {
      // Sem refresh_token a conexão é inutilizável depois de 1h
      return errorRedirect('refresh_token não recebido — desconecta a app no Google e tenta de novo');
    }
    // 3. Pega email do usuário Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    const userInfo = await userInfoRes.json();
    const driveEmail = userInfo.email || 'unknown';
    // 4. Cria pasta raiz "LeverAds" no Drive (se já existe, reusa)
    let rootFolderId;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name='LeverAds' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    const searchJson = await searchRes.json();
    if (searchJson.files && searchJson.files.length > 0) {
      rootFolderId = searchJson.files[0].id;
      console.log(`[drive-oauth-callback] Pasta LeverAds já existe: ${rootFolderId}`);
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'LeverAds',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.id) {
        console.error('Failed to create root folder:', createJson);
        return errorRedirect('falha ao criar pasta LeverAds');
      }
      rootFolderId = createJson.id;
      console.log(`[drive-oauth-callback] Pasta LeverAds criada: ${rootFolderId}`);
    }
    // 5. Salva conexão (upsert por user_id)
    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();
    const { error: upsertErr } = await admin.from('drive_connections').upsert({
      user_id: userId,
      drive_email: driveEmail,
      refresh_token,
      access_token,
      access_token_expires_at: expiresAt,
      root_folder_id: rootFolderId,
      root_folder_name: 'LeverAds',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });
    if (upsertErr) {
      console.error('Failed to save drive_connection:', upsertErr);
      return errorRedirect('falha ao salvar conexão');
    }
    // 6. Redireciona pro app com sucesso
    return htmlRedirect(`${APP_URL}/connections?drive=connected&email=${encodeURIComponent(driveEmail)}`);
  } catch (err) {
    console.error('drive-oauth-callback error:', err);
    return errorRedirect(err?.message || 'erro interno');
  }
}));

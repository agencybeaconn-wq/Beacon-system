import { instrument } from "../_shared/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.25.76'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// `code` vai direto na URL do token exchange. Sem regex pode corromper a URL.
// State parsing fica tolerante (3 formatos legados), mas os UUIDs extraídos devem ser válidos.
const oauthCodeSchema = z.string().regex(/^[A-Za-z0-9_-]+$/, 'code com caracteres inválidos').min(1).max(2048);
const uuidSchema = z.string().uuid();

Deno.serve(instrument("fb-oauth-callback", async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // Contains JSON with returnUrl, userId, workspaceId
    const errorParam = url.searchParams.get('error')
    const errorReason = url.searchParams.get('error_reason')
    const errorDescription = url.searchParams.get('error_description')

    // Parse state - supports both JSON format and legacy plain URL format
    let appUrl = Deno.env.get('VITE_APP_URL') || 'https://agencybeacon.site'
    let stateUserId: string | null = null
    let stateWorkspaceId: string | null = null

    if (state) {
      try {
        const decodedState = decodeURIComponent(state)

        // Try JSON format first: { returnUrl, userId, workspaceId }
        if (decodedState.startsWith('{')) {
          const parsed = JSON.parse(decodedState)
          if (parsed.returnUrl) {
            const stateUrl = new URL(parsed.returnUrl)
            appUrl = stateUrl.origin
          }
          stateUserId = parsed.userId || null
          stateWorkspaceId = parsed.workspaceId || null
          console.log('Parsed JSON state:', { appUrl, userId: stateUserId, workspaceId: stateWorkspaceId })
        }
        // Legacy format: "userId:workspaceId" (from TeamConnections)
        else if (decodedState.includes(':') && !decodedState.startsWith('http')) {
          const parts = decodedState.split(':')
          if (parts.length === 2) {
            stateUserId = parts[0]
            stateWorkspaceId = parts[1]
            console.log('Parsed legacy state (userId:workspaceId):', { userId: stateUserId, workspaceId: stateWorkspaceId })
          }
        }
        // Plain URL format (old Connections.tsx behavior)
        else if (decodedState.startsWith('http://') || decodedState.startsWith('https://')) {
          const stateUrl = new URL(decodedState)
          appUrl = stateUrl.origin
          console.log('Using return URL from state:', appUrl)
        }

        // Defensive: zera IDs corrompidos pra não vazarem em queries downstream.
        if (stateUserId && !uuidSchema.safeParse(stateUserId).success) {
          console.warn('[fb-oauth] stateUserId inválido, ignorando:', stateUserId)
          stateUserId = null
        }
        if (stateWorkspaceId && !uuidSchema.safeParse(stateWorkspaceId).success) {
          console.warn('[fb-oauth] stateWorkspaceId inválido, ignorando:', stateWorkspaceId)
          stateWorkspaceId = null
        }
      } catch (e) {
        console.log('Could not parse state, using default appUrl:', e)
      }
    }

    // Handle OAuth errors from Facebook
    if (errorParam) {
      console.error('Facebook OAuth Error:', { errorParam, errorReason, errorDescription })
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent(errorDescription || errorParam)}`)
    }

    if (!code) {
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent('Codigo de autorizacao nao recebido')}`)
    }

    // Valida formato do code antes de injetar na URL do token exchange.
    const codeParsed = oauthCodeSchema.safeParse(code)
    if (!codeParsed.success) {
      console.error('[fb-oauth] Code com formato inválido:', codeParsed.error.flatten())
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent('Codigo de autorizacao malformado')}`)
    }

    // Get environment variables
    const appId = Deno.env.get('VITE_FB_APP_ID')
    const appSecret = Deno.env.get('FB_APP_SECRET')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fb-oauth-callback`

    if (!appId || !appSecret) {
      console.error('Missing FB_APP_ID or FB_APP_SECRET')
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent('Configuracao do servidor incompleta')}`)
    }

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${appSecret}` +
      `&code=${code}`

    console.log('Exchanging code for token...')

    const tokenResponse = await fetch(tokenUrl)
    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData.error)
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent(tokenData.error.message || 'Erro ao trocar codigo por token')}`)
    }

    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in // seconds

    if (!accessToken) {
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent('Token de acesso nao recebido')}`)
    }

    // Get user info from Facebook
    const meResponse = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${accessToken}`)
    const meData = await meResponse.json()

    if (meData.error) {
      console.error('Error fetching user info:', meData.error)
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent(meData.error.message || 'Erro ao obter dados do usuario')}`)
    }

    console.log('User authenticated:', meData.name)

    // Exchange for long-lived token (60 days instead of ~2 hours)
    let longLivedToken = accessToken
    let tokenExpiry = new Date(Date.now() + (expiresIn || 3600) * 1000)

    try {
      const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${appId}` +
        `&client_secret=${appSecret}` +
        `&fb_exchange_token=${accessToken}`

      const longLivedResponse = await fetch(longLivedUrl)
      const longLivedData = await longLivedResponse.json()

      if (longLivedData.access_token) {
        longLivedToken = longLivedData.access_token
        tokenExpiry = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000) // ~60 days
        console.log('Long-lived token obtained, expires:', tokenExpiry)
      }
    } catch (e) {
      console.warn('Could not exchange for long-lived token, using short-lived:', e)
    }

    // Save to database using service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // If we don't have user_id from state, try to find it from an existing workspace
    if (!stateUserId && stateWorkspaceId) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', stateWorkspaceId)
        .maybeSingle()
      if (ws) stateUserId = ws.owner_id
    }

    // If we don't have workspace_id from state, try to find it from user_id
    if (stateUserId && !stateWorkspaceId) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', stateUserId)
        .maybeSingle()
      if (ws) stateWorkspaceId = ws.id
    }

    console.log('Saving connection with:', { name: meData.name, userId: stateUserId, workspaceId: stateWorkspaceId })

    const finalName = meData.name || 'Usuário'

    // Build connection data with user_id and workspace_id
    const connectionData: Record<string, any> = {
      name: finalName,
      access_token: longLivedToken,
      status: 'connected',
      expires_at: tokenExpiry.toISOString(),
    }

    if (stateUserId) connectionData.user_id = stateUserId
    if (stateWorkspaceId) connectionData.workspace_id = stateWorkspaceId

    // Try to find existing connection by name + workspace and update, or insert new
    let existingQuery = supabase
      .from('fb_connections')
      .select('id')
      .eq('name', finalName)

    if (stateWorkspaceId) {
      existingQuery = existingQuery.eq('workspace_id', stateWorkspaceId)
    }

    const { data: existingConnection } = await existingQuery.maybeSingle()

    let dbError = null

    if (existingConnection) {
      // Update existing
      const { error } = await supabase
        .from('fb_connections')
        .update({
          access_token: longLivedToken,
          status: 'connected',
          expires_at: tokenExpiry.toISOString()
        })
        .eq('id', existingConnection.id)
      dbError = error
      console.log('Updated existing connection:', existingConnection.id)
    } else {
      // Insert new
      const { error } = await supabase
        .from('fb_connections')
        .insert(connectionData)
      dbError = error
      console.log('Inserted new connection')
    }

    if (dbError) {
      console.error('Database error:', dbError)
      return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent('Erro ao salvar conexao: ' + dbError.message)}`)
    }

    // Redirect back to app with success
    return Response.redirect(`${appUrl}/connections?meta=success&name=${encodeURIComponent(finalName)}`)

  } catch (error: any) {
    console.error('fb-oauth-callback error:', error)
    const appUrl = Deno.env.get('VITE_APP_URL') || 'https://agencybeacon.site'
    return Response.redirect(`${appUrl}/connections?error=${encodeURIComponent(error.message || 'Erro interno')}`)
  }
}))

/**
 * Google OAuth2 Callback — Edge Function
 * 
 * Recebe o callback do Google após autorização do usuário.
 * Troca o authorization code por tokens e salva em google_connections.
 * Segue o padrão de fb-oauth-callback.
 */

import { instrument } from "../_shared/logger.ts";
import { corsHeaders } from '../_shared/cors.ts'
import {
    exchangeCodeForTokens,
    getGoogleUserInfo,
    createSupabaseAdmin,
} from '../_shared/google-auth.ts'

Deno.serve(instrument("google-oauth-callback", async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const errorParam = url.searchParams.get('error')

        // Parse state — expects JSON: { returnUrl, userId, workspaceId }
        let appUrl = Deno.env.get('VITE_APP_URL') || 'https://agencybeacon.site'
        let stateUserId: string | null = null
        let stateWorkspaceId: string | null = null

        if (state) {
            try {
                // Try direct parse first (when URLSearchParams already decoded)
                let stateStr = state
                if (!stateStr.startsWith('{')) {
                    stateStr = decodeURIComponent(stateStr)
                }
                if (stateStr.startsWith('{')) {
                    const parsed = JSON.parse(stateStr)
                    if (parsed.returnUrl) appUrl = parsed.returnUrl
                    if (parsed.userId) stateUserId = parsed.userId
                    if (parsed.workspaceId) stateWorkspaceId = parsed.workspaceId
                    console.log('Parsed state:', { appUrl, stateUserId, stateWorkspaceId })
                }
            } catch (e) {
                console.log('Could not parse state, using default appUrl:', e)
            }
        }

        // Handle OAuth errors from Google
        if (errorParam) {
            console.error('Google OAuth Error:', errorParam)
            return Response.redirect(
                `${appUrl}/connections?error=${encodeURIComponent(errorParam)}`
            )
        }

        if (!code) {
            return Response.redirect(
                `${appUrl}/connections?error=${encodeURIComponent('No authorization code received')}`
            )
        }

        // Exchange code for tokens
        console.log('Exchanging code for tokens...')
        const tokens = await exchangeCodeForTokens(code)
        console.log('Tokens received, fetching user info...')

        // Get user info
        const userInfo = await getGoogleUserInfo(tokens.access_token)
        console.log('Google user authenticated:', userInfo.email)

        // Create Supabase admin client
        const supabase = createSupabaseAdmin()

        // Resolve workspaceId if we only have userId
        if (stateUserId && !stateWorkspaceId) {
            const { data: ws } = await supabase
                .from('workspaces')
                .select('id')
                .eq('owner_id', stateUserId)
                .maybeSingle()
            if (ws) stateWorkspaceId = ws.id
        }

        if (!stateWorkspaceId) {
            console.error('No workspace_id could be resolved')
            return Response.redirect(
                `${appUrl}/connections?error=${encodeURIComponent('Could not resolve workspace')}`
            )
        }

        // Calculate token expiry
        const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

        // Check for existing connection
        const { data: existingConnection } = await supabase
            .from('google_connections')
            .select('id')
            .eq('workspace_id', stateWorkspaceId)
            .eq('google_email', userInfo.email)
            .maybeSingle()

        const connectionData = {
            workspace_id: stateWorkspaceId,
            google_email: userInfo.email,
            google_user_id: userInfo.id,
            google_name: userInfo.name,
            google_picture: userInfo.picture || null,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            token_expiry: tokenExpiry,
            scopes: tokens.scope || '',
            status: 'connected',
            updated_at: new Date().toISOString(),
        }

        let dbError = null

        if (existingConnection) {
            // Update existing connection
            const { error } = await supabase
                .from('google_connections')
                .update(connectionData)
                .eq('id', existingConnection.id)
            dbError = error
        } else {
            // Insert new connection
            const { error } = await supabase
                .from('google_connections')
                .insert({
                    ...connectionData,
                    created_at: new Date().toISOString(),
                })
            dbError = error
        }

        if (dbError) {
            console.error('Database error saving Google connection:', dbError)
            return Response.redirect(
                `${appUrl}/connections?error=${encodeURIComponent('Failed to save connection')}`
            )
        }

        console.log('Google connection saved successfully for:', userInfo.email)

        // Redirect back to app with success
        return Response.redirect(
            `${appUrl}/connections?google=success&name=${encodeURIComponent(userInfo.name)}`
        )
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal error'
        console.error('google-oauth-callback error:', error)
        const appUrl = Deno.env.get('VITE_APP_URL') || 'https://agencybeacon.site'
        return Response.redirect(
            `${appUrl}/connections?error=${encodeURIComponent(message)}`
        )
    }
}))

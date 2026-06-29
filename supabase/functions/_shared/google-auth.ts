/**
 * Google OAuth2 Token Management — Shared Module
 * 
 * Gerencia o ciclo de vida dos tokens Google OAuth2:
 * - Exchange de authorization code por tokens
 * - Refresh automático de tokens expirados
 * - Busca de token válido do banco (google_connections)
 * 
 * Scopes configurados: Drive (files) + Calendar (events/meetings)
 * Extensível para Sheets no futuro (basta adicionar o scope).
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Google OAuth2 Constants ───────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

export const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'openid',
    'email',
    'profile',
].join(' ')

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GoogleTokens {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope: string
    id_token?: string
}

export interface GoogleUserInfo {
    id: string
    email: string
    name: string
    picture?: string
}

export interface GoogleConnection {
    id: string
    workspace_id: string
    google_email: string
    google_user_id: string
    access_token: string
    refresh_token: string
    token_expiry: string
    scopes: string
    status: string
    created_at: string
    updated_at: string
}

// ─── Helper: Get credentials from env ──────────────────────────────────────────

function getCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')

    if (!clientId || !clientSecret) {
        throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const fallbackRedirect = `${supabaseUrl}/functions/v1/google-oauth-callback`

    return {
        clientId,
        clientSecret,
        redirectUri: redirectUri || fallbackRedirect,
    }
}

// ─── Exchange authorization code for tokens ────────────────────────────────────

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const { clientId, clientSecret, redirectUri } = getCredentials()

    const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    })

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })

    const data = await response.json()

    if (data.error) {
        console.error('Google token exchange error:', data)
        throw new Error(`Token exchange failed: ${data.error_description || data.error}`)
    }

    return data as GoogleTokens
}

// ─── Refresh an expired access token ───────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    const { clientId, clientSecret } = getCredentials()

    const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
    })

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    })

    const data = await response.json()

    if (data.error) {
        console.error('Google token refresh error:', data)
        throw new Error(`Token refresh failed: ${data.error_description || data.error}`)
    }

    return data as GoogleTokens
}

// ─── Fetch Google user info ────────────────────────────────────────────────────

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch Google user info: ${response.statusText}`)
    }

    return await response.json() as GoogleUserInfo
}

// ─── Get a valid access token (auto-refresh if expired) ────────────────────────

export async function getValidToken(
    supabase: SupabaseClient,
    workspaceId: string
): Promise<string> {
    const { data: connection, error } = await supabase
        .from('google_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected')
        .maybeSingle()

    if (error) {
        console.error('Error fetching google_connections:', JSON.stringify(error))
        throw new Error(`Failed to fetch Google connection: ${error.message || JSON.stringify(error)}`)
    }

    if (!connection) {
        throw new Error('No active Google connection found for this workspace. Please connect your Google account first.')
    }

    const now = new Date()
    const expiry = new Date(connection.token_expiry)
    const bufferMs = 5 * 60 * 1000 // 5 minutes buffer before actual expiry

    // Token still valid
    if (expiry.getTime() - bufferMs > now.getTime()) {
        return connection.access_token
    }

    // Token expired or about to expire — refresh
    console.log(`Token expired for workspace ${workspaceId}, refreshing...`)

    if (!connection.refresh_token) {
        throw new Error('No refresh token available. User needs to re-authorize Google.')
    }

    const newTokens = await refreshAccessToken(connection.refresh_token)

    const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()

    // Update token in database
    const { error: updateError } = await supabase
        .from('google_connections')
        .update({
            access_token: newTokens.access_token,
            token_expiry: newExpiry,
            // Google may return a new refresh_token (rare but possible)
            ...(newTokens.refresh_token ? { refresh_token: newTokens.refresh_token } : {}),
            updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)

    if (updateError) {
        console.error('Error updating refreshed token:', updateError)
        // Still return the new token even if DB update fails
    }

    return newTokens.access_token
}

// ─── Create Supabase admin client ──────────────────────────────────────────────

export function createSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
    })
}

// ─── Generate Google OAuth2 authorization URL ──────────────────────────────────

export function buildAuthUrl(state: string): string {
    const { clientId, redirectUri } = getCredentials()

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
        access_type: 'offline',     // Required to get refresh_token
        prompt: 'consent',          // Force consent to always get refresh_token
        state,
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Supabase-backed storage for OAuth state — all writes via SECURITY DEFINER RPCs,
 * so the MCP server uses only the public anon key. No service_role exposure.
 *
 * RPCs live in `public.mcp_oauth_*` (see migration mcp_oauth_rpcs).
 */
import { createClient } from "@supabase/supabase-js";
import { oauthConfig } from "./config.js";
import { sha256Hex, randomToken } from "./util.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any {
  if (_client) return _client;
  const { supabaseUrl, supabaseAnonKey } = oauthConfig();
  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

// ─── Clients (DCR) ──────────────────────────────────────────────────────────

export interface OAuthClient {
  client_id: string;
  client_name?: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  response_types: string[];
  scope: string;
  created_at: string;
}

export async function registerClient(input: {
  redirect_uris: string[];
  client_name?: string;
  client_uri?: string;
  software_id?: string;
  software_version?: string;
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
}): Promise<OAuthClient> {
  return rpc<OAuthClient>("mcp_oauth_register_client", { p: input });
}

export async function getClient(client_id: string): Promise<OAuthClient | null> {
  return rpc<OAuthClient | null>("mcp_oauth_get_client", { p_client_id: client_id });
}

export async function touchClient(client_id: string): Promise<void> {
  await rpc("mcp_oauth_touch_client", { p_client_id: client_id });
}

// ─── Allowed users ──────────────────────────────────────────────────────────

export async function isAllowed(email: string): Promise<boolean> {
  return rpc<boolean>("mcp_oauth_is_allowed", { p_email: email.toLowerCase() });
}

// ─── Authorization codes ────────────────────────────────────────────────────

export async function createAuthCode(input: {
  client_id: string;
  user_email: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource?: string;
  ttlSeconds: number;
}): Promise<string> {
  const code = randomToken(32);
  const code_hash = await sha256Hex(code);
  await rpc("mcp_oauth_create_code", {
    p: {
      kind: "auth_code",
      code_hash,
      client_id: input.client_id,
      user_email: input.user_email.toLowerCase(),
      redirect_uri: input.redirect_uri,
      code_challenge: input.code_challenge,
      scope: input.scope,
      resource: input.resource ?? null,
      expires_at: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
    },
  });
  return code;
}

interface AuthCodeRow {
  id: string;
  client_id: string;
  user_email: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string | null;
}

export async function consumeAuthCode(code: string): Promise<AuthCodeRow | null> {
  const code_hash = await sha256Hex(code);
  return rpc<AuthCodeRow | null>("mcp_oauth_consume_code", {
    p_kind: "auth_code",
    p_code_hash: code_hash,
  });
}

// ─── Refresh tokens ─────────────────────────────────────────────────────────

export async function createRefreshToken(input: {
  client_id: string;
  user_email: string;
  scope: string;
  resource?: string;
  ttlSeconds: number;
}): Promise<string> {
  const token = randomToken(32);
  const code_hash = await sha256Hex(token);
  await rpc("mcp_oauth_create_code", {
    p: {
      kind: "refresh_token",
      code_hash,
      client_id: input.client_id,
      user_email: input.user_email.toLowerCase(),
      redirect_uri: null,
      code_challenge: null,
      scope: input.scope,
      resource: input.resource ?? null,
      expires_at: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
    },
  });
  return token;
}

interface RefreshTokenRow {
  id: string;
  client_id: string;
  user_email: string;
  scope: string;
  resource: string | null;
}

export async function rotateRefreshToken(oldToken: string): Promise<RefreshTokenRow | null> {
  const code_hash = await sha256Hex(oldToken);
  return rpc<RefreshTokenRow | null>("mcp_oauth_consume_code", {
    p_kind: "refresh_token",
    p_code_hash: code_hash,
  });
}

// ─── Login challenges (magic link) ──────────────────────────────────────────

export async function createLoginChallenge(input: {
  email: string;
  authorize_state: Record<string, unknown>;
  ttlSeconds: number;
}): Promise<string> {
  const challenge = randomToken(32);
  const challenge_hash = await sha256Hex(challenge);
  await rpc("mcp_oauth_create_login_challenge", {
    p: {
      challenge_hash,
      email: input.email.toLowerCase(),
      authorize_state: input.authorize_state,
      expires_at: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
    },
  });
  return challenge;
}

export async function consumeLoginChallenge(
  challenge: string,
): Promise<{ id: string; email: string; authorize_state: Record<string, unknown> } | null> {
  const challenge_hash = await sha256Hex(challenge);
  return rpc("mcp_oauth_consume_login_challenge", { p_challenge_hash: challenge_hash });
}

// ─── Debug log ──────────────────────────────────────────────────────────────

export async function debugLog(
  endpoint: string,
  status: number,
  message: string,
  ctx: Record<string, unknown> = {},
): Promise<void> {
  try {
    await rpc("mcp_oauth_log", { p_endpoint: endpoint, p_status: status, p_message: message, p_ctx: ctx });
  } catch (e) {
    // never throw from the logger
    process.stderr.write(`[debugLog failed] ${(e as Error).message}\n`);
  }
}

/**
 * OAuth runtime config — read from env vars.
 *
 * Required Vercel env vars (production):
 *   MCP_PUBLIC_URL          → canonical URL of this MCP server, e.g. https://lever-shopify-mcp.vercel.app
 *   MCP_JWT_SECRET          → 64+ hex chars; sign access tokens
 *   LEVER_SUPABASE_URL          → Supabase project URL (Lever System)
 *   LEVER_SUPABASE_ANON_KEY     → anon key; all DB ops go through SECURITY DEFINER RPCs
 *                                  (mcp_oauth_*) so service_role is never needed.
 *   LEVER_MCP_INTERNAL_SECRET   → shared secret for S2S auth with Lever System edge
 *                                  functions (header X-Lever-MCP-Secret). Stored ALSO
 *                                  in Supabase Vault as lever_mcp_internal_secret.
 */
export function oauthConfig() {
  const need = (k: string): string => {
    const v = process.env[k];
    if (!v) throw new Error(`OAuth: env var ${k} missing`);
    return v;
  };
  return {
    publicUrl: need("MCP_PUBLIC_URL").replace(/\/+$/, ""),
    jwtSecret: need("MCP_JWT_SECRET"),
    supabaseUrl: need("LEVER_SUPABASE_URL").replace(/\/+$/, ""),
    supabaseAnonKey: need("LEVER_SUPABASE_ANON_KEY"),
  };
}

/** Optional S2S secret — only required by lever_* tools that call edge functions. */
export function leverInternalSecret(): string {
  const v = process.env.LEVER_MCP_INTERNAL_SECRET;
  if (!v) throw new Error("LEVER_MCP_INTERNAL_SECRET not set; lever_* tools cannot call edge functions");
  return v;
}

/** GitHub config for vault_* tools. Throws if missing — vault tools degrade gracefully. */
export function vaultGitHub() {
  const token = process.env.LEVER_VAULT_GITHUB_TOKEN;
  const repo = process.env.LEVER_VAULT_REPO; // e.g. "leveragency/lever-qi"
  const branch = process.env.LEVER_VAULT_BRANCH ?? "main";
  if (!token || !repo) {
    throw new Error("LEVER_VAULT_GITHUB_TOKEN + LEVER_VAULT_REPO required for vault_* tools");
  }
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`LEVER_VAULT_REPO must be 'owner/name', got '${repo}'`);
  return { token, owner, repo: name, branch };
}

export const ACCESS_TOKEN_TTL_S = 3600;          // 1h
export const REFRESH_TOKEN_TTL_S = 60 * 60 * 24 * 30; // 30d
export const AUTH_CODE_TTL_S = 600;              // 10min
export const LOGIN_CHALLENGE_TTL_S = 900;        // 15min
export const SCOPE = "mcp";

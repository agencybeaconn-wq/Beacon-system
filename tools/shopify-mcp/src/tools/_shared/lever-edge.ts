/**
 * Lever System edge-function client — calls Supabase edge functions with
 * service-to-service auth (shared secret) on behalf of the authenticated MCP user.
 *
 * Edge function side validates:
 *   - X-Lever-MCP-Secret matches lever_mcp_internal_secret (Vault + Vercel env)
 *   - X-Lever-User-Email is in mcp_oauth.allowed_users
 *   - Per-client visibility based on team_members (agency type sees all visible
 *     clients; client type sees only its linked_client_id)
 *
 * This module assumes the caller already verified the MCP JWT (auth.ts).
 * We trust ctx.user as the email — we never let tool input override it.
 */
import { oauthConfig, leverInternalSecret } from "../../oauth/config.js";
import type { ToolContext } from "../types.js";

export class LeverEdgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "not_allowed" | "not_visible" | "bad_request" | "upstream" | "unknown",
  ) {
    super(message);
    this.name = "LeverEdgeError";
  }
}

function classify(status: number, msg: string): LeverEdgeError["code"] {
  if (status === 401) return "not_allowed";
  if (status === 403) return "not_visible";
  if (status === 400) return "bad_request";
  if (/timeout|connection|fetch|upstream|shopify/i.test(msg)) return "upstream";
  return "unknown";
}

/**
 * Invoke an edge function on the Lever System Supabase project.
 *
 * @param functionSlug e.g. "mcp-shopify-proxy"
 * @param body action + params, depends on the edge function
 * @param ctx tool context — `ctx.user` becomes X-Lever-User-Email
 */
export async function callLeverEdge<T = unknown>(
  functionSlug: string,
  body: Record<string, unknown>,
  ctx: ToolContext,
): Promise<T> {
  if (!ctx.user || ctx.user === "local") {
    throw new LeverEdgeError(
      "lever_* tools require an authenticated user (OAuth JWT). stdio/local mode bypasses identity.",
      401,
      "not_allowed",
    );
  }

  const cfg = oauthConfig();
  const url = `${cfg.supabaseUrl}/functions/v1/${functionSlug}`;
  const secret = leverInternalSecret();

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Lever-MCP-Secret": secret,
      "X-Lever-User-Email": ctx.user.toLowerCase(),
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let json: unknown;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!resp.ok) {
    const err = (json as { error?: string }).error ?? `HTTP ${resp.status}`;
    throw new LeverEdgeError(err, resp.status, classify(resp.status, err));
  }

  // Edge functions wrap responses as { success: true, data: ..., actor: email }
  const wrapped = json as { success?: boolean; data?: T; error?: string };
  if (wrapped.success === false) {
    throw new LeverEdgeError(wrapped.error ?? "edge returned success:false", 500, "unknown");
  }
  return (wrapped.data ?? json) as T;
}

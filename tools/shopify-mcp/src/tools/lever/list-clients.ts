/**
 * lever_list_clients — list agency_clients visible to the calling user.
 *
 * Returns id + name + shopify_domain + currency hints, so the model knows
 * what `client_id` to pass to the other lever_* tools.
 */
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { oauthConfig, leverInternalSecret } from "../../oauth/config.js";
import type { Tool, ToolContext } from "../types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sb: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any {
  if (_sb) return _sb;
  const cfg = oauthConfig();
  _sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _sb;
}

// Use the same dual-auth pattern: SECURITY DEFINER RPC that takes the email
// and applies the team_members visibility rule.
//
// The RPC is created in migration mcp_lever_helpers.
async function ensureRpcExists(): Promise<void> {
  // No-op; the migration created public.mcp_lever_list_clients.
}

export const listClientsTool: Tool = {
  name: "lever_list_clients",
  description:
    "List Lever agency clients visible to the authenticated user. Returns id, name, shopify_domain, status. Use this FIRST to discover client_ids before calling other lever_* tools. Agency-type users see all visible (non-internal, non-archived) clients; client-type users see only their linked client.",
  inputSchema: z.object({
    include_archived: z.boolean().optional().default(false).describe("Include archived clients in the result (default false)."),
    search: z.string().optional().describe("Optional name substring filter (case-insensitive)."),
  }),
  async handler({ include_archived, search }, ctx: ToolContext) {
    void ensureRpcExists();
    void leverInternalSecret(); // verify config — throws if missing
    if (!ctx.user || ctx.user === "local") {
      throw new Error("lever_list_clients requires an authenticated user (OAuth JWT)");
    }
    const { data, error } = await sb().rpc("mcp_lever_list_clients", {
      p_email: ctx.user.toLowerCase(),
      p_include_archived: include_archived ?? false,
      p_search: search ?? null,
    });
    if (error) throw new Error(`mcp_lever_list_clients: ${error.message}`);
    return data;
  },
};

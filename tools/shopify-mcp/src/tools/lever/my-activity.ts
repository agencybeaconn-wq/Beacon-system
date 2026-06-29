/**
 * lever_my_activity — recent tool calls made by the authenticated user.
 *
 * Personal audit: "what did I run in the last N hours, how long did it take,
 * did anything error?". Useful for observability + handoff.
 */
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { oauthConfig } from "../../oauth/config.js";
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

export const myActivityTool: Tool = {
  name: "lever_my_activity",
  description:
    "Return YOUR recent MCP tool calls (last N hours, max 50 rows). Shows tool name, timestamp, status, duration, errors, redacted args. Useful for 'what did I just run' and handoffs.",
  inputSchema: z.object({
    hours: z.number().int().min(1).max(168).optional().default(24).describe("Look-back window in hours (default 24, max 168 = 7d)."),
    limit: z.number().int().min(1).max(200).optional().default(50),
  }),
  async handler(input, ctx: ToolContext) {
    if (!ctx.user || ctx.user === "local") {
      throw new Error("lever_my_activity requires an authenticated user");
    }
    const { data, error } = await sb().rpc("mcp_lever_my_recent_activity", {
      p_email: ctx.user.toLowerCase(),
      p_hours: input.hours,
      p_limit: input.limit,
    });
    if (error) throw new Error(`mcp_lever_my_recent_activity: ${error.message}`);
    return data;
  },
};

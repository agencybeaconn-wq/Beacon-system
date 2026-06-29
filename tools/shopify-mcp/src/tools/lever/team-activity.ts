/**
 * lever_team_activity — agency-wide MCP usage snapshot.
 *
 * Per-user call counts, per-tool counts, and the open tool requests queue.
 * João consumes daily to spot patterns ("Wesley called lever_meta_anomalies
 * 32× this week"), identify gaps, and prioritize new tools.
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

export const teamActivityTool: Tool = {
  name: "lever_team_activity",
  description:
    "Agency-wide MCP usage snapshot: per-user call counts + per-tool counts + open tool_requests queue. Default window: last 24h. Use to understand who's leaning on what, spot under-used tools, and surface gaps.",
  inputSchema: z.object({
    hours: z.number().int().min(1).max(720).optional().default(24),
  }),
  async handler(input, ctx: ToolContext) {
    if (!ctx.user || ctx.user === "local") {
      throw new Error("lever_team_activity requires an authenticated user");
    }
    const { data, error } = await sb().rpc("mcp_lever_team_activity", {
      p_email: ctx.user.toLowerCase(),
      p_hours: input.hours,
    });
    if (error) throw new Error(`mcp_lever_team_activity: ${error.message}`);
    return data;
  },
};

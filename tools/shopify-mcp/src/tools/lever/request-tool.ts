/**
 * lever_request_tool — squad members request new MCP tools or capability extensions.
 *
 * Writes to mcp_audit.tool_requests. João/maintainers review the queue and
 * implement what's worth doing. Self-improving system: as the team uses the
 * MCP, missing features surface as concrete requests instead of ad-hoc DM asks.
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

export const requestToolTool: Tool = {
  name: "lever_request_tool",
  description:
    "Request a new MCP tool or expansion. Writes to the maintainer queue (mcp_audit.tool_requests) so João can review and implement. Use this WHENEVER you (or the model on your behalf) feel a useful capability is missing — that's how the MCP grows. Give a concrete title, a clear description of what the tool should do, and the use case (when/why you'd use it).",
  inputSchema: z.object({
    title: z.string().min(5).max(120).describe("Short title for the new tool. e.g. 'Pause underperforming Meta ad sets'"),
    description: z.string().min(20).describe("What the tool should do — inputs, outputs, behavior. Be specific."),
    use_case: z.string().optional().describe("Concrete scenario: when would you call this and why does it save time?"),
    priority: z.enum(["low", "normal", "high", "critical"]).optional().default("normal"),
  }),
  async handler(input, ctx: ToolContext) {
    if (!ctx.user || ctx.user === "local") {
      throw new Error("lever_request_tool requires an authenticated user");
    }
    const { data, error } = await sb().rpc("mcp_lever_request_tool", {
      p_email: ctx.user.toLowerCase(),
      p: {
        title: input.title,
        description: input.description,
        use_case: input.use_case ?? null,
        priority: input.priority,
      },
    });
    if (error) throw new Error(`mcp_lever_request_tool: ${error.message}`);
    return data;
  },
};

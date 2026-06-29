import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { oauthConfig } from "../../oauth/config.js";
import { vaultRecentCommits, vaultRead } from "../_shared/github-vault.js";
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

/**
 * lever_brain_context — single call that returns "what's hot in the agency right now".
 *
 * Used by the lever-context skill (Claude Code auto-load) AND by Claude itself
 * when the user asks anything Lever-flavored. Pre-fills context so the model
 * already knows current state instead of guessing or asking.
 */
export const brainContextTool: Tool = {
  name: "lever_brain_context",
  description:
    "Load a snapshot of the Lever agency brain — recent vault activity (events, decisions, commits), open tool requests, pending agency-wide signals. Call THIS first when starting any Lever work to pre-load context. Default window 48h. Returns a compact summary suitable for prompt-injection.",
  inputSchema: z.object({
    hours: z.number().int().min(1).max(720).optional().default(48).describe("Look-back window in hours (default 48)."),
    include_vault: z.boolean().optional().default(true).describe("Pull recent vault commits (events, decisions). False to skip GitHub call."),
    include_audit: z.boolean().optional().default(true).describe("Pull team_activity snapshot from Supabase."),
  }),
  async handler(input, ctx: ToolContext) {
    if (!ctx.user || ctx.user === "local") {
      throw new Error("lever_brain_context requires an authenticated user");
    }

    const sinceISO = new Date(Date.now() - input.hours * 3600_000).toISOString();
    const out: Record<string, unknown> = {
      window_hours: input.hours,
      generated_at: new Date().toISOString(),
      for_user: ctx.user,
    };

    // 1. Vault recent activity (events + decisions + general commits)
    if (input.include_vault) {
      try {
        const [commits, eventsThisMonth, decisionsThisMonth] = await Promise.all([
          vaultRecentCommits({ since: sinceISO, limit: 30 }),
          vaultRead(`04-data-rituals/mcp-log/events/${new Date().toISOString().slice(0, 7)}.md`),
          vaultRead(`04-data-rituals/mcp-log/decisions/${new Date().toISOString().slice(0, 7)}.md`),
        ]);
        out.vault = {
          recent_commits: commits,
          events_md_tail: tail(eventsThisMonth?.content, 4000),
          decisions_md_tail: tail(decisionsThisMonth?.content, 4000),
        };
      } catch (e) {
        out.vault = { error: (e as Error).message, note: "vault tools may not be configured yet (LEVER_VAULT_GITHUB_TOKEN/REPO)" };
      }
    }

    // 2. Agency audit snapshot (who used what, pending tool requests)
    if (input.include_audit) {
      const { data, error } = await sb().rpc("mcp_lever_team_activity", { p_email: ctx.user.toLowerCase(), p_hours: input.hours });
      if (error) out.audit = { error: error.message };
      else out.audit = data;
    }

    return out;
  },
};

/** Returns the last `n` chars of a string, prefixed with "...truncated..." if cut. */
function tail(s: string | undefined, n: number): string | null {
  if (!s) return null;
  if (s.length <= n) return s;
  return `...truncated (${s.length - n} chars before)...\n` + s.slice(-n);
}

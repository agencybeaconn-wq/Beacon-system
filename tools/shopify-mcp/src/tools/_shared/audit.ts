/**
 * Tool call audit — wraps a tool handler so every invocation lands in
 * `mcp_audit.tool_calls` with user, tool name, duration, status, and error.
 *
 * Stderr-only fallback if Supabase RPC is unreachable (never throws).
 */
import { createClient } from "@supabase/supabase-js";
import { oauthConfig } from "../../oauth/config.js";
import type { Tool, ToolContext } from "../types.js";
import type { z } from "zod";

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

const REDACT_KEYS = new Set(["query", "mutation", "code", "token", "secret", "password"]);
function redact(input: unknown): unknown {
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k)) {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      out[k] = s.length > 80 ? `<redacted len=${s.length}>` : "<redacted>";
    } else if (typeof v === "object" && v !== null) {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function record(
  user_email: string,
  tool_name: string,
  args_redacted: unknown,
  duration_ms: number,
  status: "ok" | "error" | "denied",
  error: string | undefined,
  result_size_bytes: number,
): Promise<void> {
  try {
    await sb().rpc("mcp_audit_record", {
      p: {
        user_email,
        tool_name,
        args_redacted,
        duration_ms,
        status,
        error: error ?? null,
        result_size_bytes,
      },
    });
  } catch (e) {
    process.stderr.write(
      `[audit] persist failed (user=${user_email} tool=${tool_name} status=${status}): ${(e as Error).message}\n`,
    );
  }
}

/**
 * Wrap a Tool so each call is audited. The wrapped Tool has the same shape.
 */
export function withAudit<TInput extends z.ZodTypeAny>(tool: Tool<TInput>): Tool<TInput> {
  return {
    ...tool,
    handler: async (input, ctx: ToolContext) => {
      const start = Date.now();
      const args = redact(input);
      try {
        const result = await tool.handler(input, ctx);
        const size = JSON.stringify(result).length;
        // fire-and-forget — don't slow down the response
        void record(ctx.user, tool.name, args, Date.now() - start, "ok", undefined, size);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = (e as { code?: string }).code;
        const status: "denied" | "error" = code === "not_allowed" || code === "not_visible" ? "denied" : "error";
        void record(ctx.user, tool.name, args, Date.now() - start, status, msg, 0);
        throw e;
      }
    },
  };
}

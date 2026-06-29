import type { z } from "zod";

/**
 * Per-call context propagated from the transport (HTTP/stdio) through the
 * dispatcher to the tool handler.
 *
 * `user` is the authenticated identity:
 *   - HTTP/OAuth mode: email from the JWT `sub` claim (e.g. "leverecomm@gmail.com")
 *   - HTTP/static key mode: lowercased name (e.g. "joao", legacy)
 *   - stdio mode: "local"
 *
 * Tools that hit Lever System edge functions use `ctx.user` to invoke
 * SECURITY DEFINER RPCs (mcp_lever_*) that validate the email and apply RLS.
 */
export type ToolContext = {
  user: string;
};

export type Tool<TInput extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: TInput;
  handler: (input: z.infer<TInput>, ctx: ToolContext) => Promise<unknown>;
};

import { z } from "zod";
import { vaultAppend } from "../_shared/github-vault.js";
import type { Tool, ToolContext } from "../types.js";

/**
 * vault_client_snapshot — record a status snapshot for ONE client.
 *
 * Path: 02-businesses/_clients-portfolio/<slug>/client-performance.md (appended).
 * Use when you've just analyzed a client and want the finding to outlive the session.
 */
export const vaultClientSnapshotTool: Tool = {
  name: "vault_client_snapshot",
  description:
    "Append a status snapshot for ONE Lever client to 02-businesses/_clients-portfolio/<slug>/client-performance.md. Use after analyzing a client to make the finding stick. Include hard numbers (revenue, AOV, ROAS, anomalies), trends, and your read. Future sessions read this for context.",
  inputSchema: z.object({
    client_slug: z.string().min(2).describe("Client slug, e.g. 'mantos', 'coringao' — lowercase, no spaces."),
    headline: z.string().min(5).max(200).describe("One-line summary (the TL;DR)."),
    body: z.string().min(20).describe("Markdown body. Numbers, trends, your read, next action."),
    sources: z.array(z.string()).optional().describe("Optional list of tool names you pulled data from (e.g. ['lever_revenue','lever_meta_anomalies'])."),
  }),
  async handler(input, ctx: ToolContext) {
    const ts = new Date().toISOString();
    const slug = input.client_slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const path = `02-businesses/_clients-portfolio/${slug}/client-performance.md`;

    const sourcesLine = input.sources && input.sources.length > 0
      ? `\n**Sources:** ${input.sources.map((s: string) => `\`${s}\``).join(", ")}`
      : "";

    const block = [
      `## ${ts} — ${input.headline}`,
      `**by:** ${ctx.user}${sourcesLine}`,
      "",
      input.body.trim(),
    ].join("\n");

    const initial = `---
type: portfolio
domain: client-performance
client: ${slug}
auto-appended: true
---

# ${slug} — Performance log

> Auto-appended por \`vault_client_snapshot\`. Snapshots ordenados do mais novo pro mais antigo (append no fim).
`;

    const result = await vaultAppend({
      path,
      appendBlock: block,
      message: `[mcp] snapshot ${slug}: ${input.headline} by ${ctx.user}`,
      initialHeader: initial,
      committerName: ctx.user.split("@")[0] || "mcp",
      committerEmail: ctx.user,
    });
    return { ok: true, path, ts, commit: result.commit_sha, url: result.html_url };
  },
};

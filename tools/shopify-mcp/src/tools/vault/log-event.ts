import { z } from "zod";
import { vaultAppend } from "../_shared/github-vault.js";
import type { Tool, ToolContext } from "../types.js";

/**
 * vault_log_event — append to a dated log file in 04-data-rituals/mcp-log/events/YYYY-MM.md.
 * Squad-wide audit trail of "what happened, when, who saw it first".
 */
export const vaultLogEventTool: Tool = {
  name: "vault_log_event",
  description:
    "Record an event in the Lever vault (sales milestones, incidents, client wins, anomalies detected, deployment notes). Appends to 04-data-rituals/mcp-log/events/YYYY-MM.md with timestamp + your email + tags. Use generously — this is the shared timeline. Categories: sale, incident, win, anomaly, deploy, decision_taken, observation.",
  inputSchema: z.object({
    title: z.string().min(5).max(120).describe("Short title for the event."),
    category: z.enum(["sale", "incident", "win", "anomaly", "deploy", "decision_taken", "observation"]),
    body: z.string().min(10).describe("Markdown body. Include numbers, links, context — this is the historical record."),
    client_slug: z.string().optional().describe("Optional client slug if event ties to one client (e.g. 'mantos')."),
    tags: z.array(z.string()).optional().describe("Optional tags (e.g. ['shopify','revenue']) — kebab-case, no spaces."),
  }),
  async handler(input, ctx: ToolContext) {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7); // YYYY-MM
    const ts = now.toISOString();
    const path = `04-data-rituals/mcp-log/events/${ym}.md`;
    const tagLine = [
      `#${input.category}`,
      ...(input.tags ?? []).map((t: string) => `#${t.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`),
      ...(input.client_slug ? [`#client/${input.client_slug.toLowerCase()}`] : []),
    ].join(" ");

    const block = [
      `## ${ts} — ${input.title}`,
      `**by:** ${ctx.user} · **category:** ${input.category}${input.client_slug ? ` · **client:** ${input.client_slug}` : ""}`,
      "",
      input.body.trim(),
      "",
      tagLine,
    ].join("\n");

    const initial = `---
type: log
domain: mcp-events
month: ${ym}
auto-generated: true
---

# MCP Events — ${ym}

> Auto-appended por tools \`vault_log_event\`. Cada bloco \`## <timestamp> — <título>\` é um evento.
> Squad consome no Obsidian; commits aparecem no histórico git da Lever QI.
`;

    const result = await vaultAppend({
      path,
      appendBlock: block,
      message: `[mcp] event: ${input.title} (${input.category}) by ${ctx.user}`,
      initialHeader: initial,
      committerName: ctx.user.split("@")[0] || "mcp",
      committerEmail: ctx.user,
    });
    return { ok: true, path, ts, commit: result.commit_sha, url: result.html_url };
  },
};

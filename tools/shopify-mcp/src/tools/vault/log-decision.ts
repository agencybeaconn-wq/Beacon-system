import { z } from "zod";
import { vaultAppend } from "../_shared/github-vault.js";
import type { Tool, ToolContext } from "../types.js";

/**
 * vault_log_decision — append to a dated decisions log (lightweight ADR).
 * Path: 04-data-rituals/mcp-log/decisions/YYYY-MM.md.
 *
 * Distinct from log_event in that decisions have alternatives + rationale.
 * Future "why did we do X?" answers itself.
 */
export const vaultLogDecisionTool: Tool = {
  name: "vault_log_decision",
  description:
    "Record an agency decision in the Lever vault (architecture call, client policy change, hiring, pricing). Appends to 04-data-rituals/mcp-log/decisions/YYYY-MM.md with ADR-style structure: context + decision + alternatives + impact. Use for ANY decision that future-you would ask 'why did we do X?'",
  inputSchema: z.object({
    title: z.string().min(5).max(120),
    context: z.string().min(20).describe("What was the situation that forced a decision?"),
    decision: z.string().min(10).describe("What did we decide?"),
    alternatives: z.array(z.string()).optional().describe("What other options were considered + why rejected."),
    impact: z.string().optional().describe("What changes because of this decision? Who is affected?"),
    reverts: z.boolean().optional().default(false).describe("Set true if this reverses a previous decision."),
    tags: z.array(z.string()).optional(),
  }),
  async handler(input, ctx: ToolContext) {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    const ts = now.toISOString();
    const path = `04-data-rituals/mcp-log/decisions/${ym}.md`;

    const tagLine = [
      input.reverts ? "#reverts" : null,
      ...(input.tags ?? []).map((t: string) => `#${t.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`),
    ].filter(Boolean).join(" ");

    const lines = [
      `## ${ts} — ${input.title}`,
      `**by:** ${ctx.user}${input.reverts ? " · **REVERTS previous decision**" : ""}`,
      "",
      "**Context:**",
      input.context.trim(),
      "",
      "**Decision:**",
      input.decision.trim(),
    ];
    if (input.alternatives && input.alternatives.length > 0) {
      lines.push("", "**Alternatives considered:**");
      for (const a of input.alternatives) lines.push(`- ${a}`);
    }
    if (input.impact) {
      lines.push("", "**Impact:**", input.impact.trim());
    }
    if (tagLine) lines.push("", tagLine);

    const initial = `---
type: log
domain: mcp-decisions
month: ${ym}
auto-generated: true
---

# MCP Decisions — ${ym}

> Auto-appended por tool \`vault_log_decision\`. Cada bloco \`## <timestamp> — <título>\` é uma decisão.
> Use pra responder "por que decidimos X?" no futuro.
`;

    const result = await vaultAppend({
      path,
      appendBlock: lines.join("\n"),
      message: `[mcp] decision: ${input.title} by ${ctx.user}`,
      initialHeader: initial,
      committerName: ctx.user.split("@")[0] || "mcp",
      committerEmail: ctx.user,
    });
    return { ok: true, path, ts, commit: result.commit_sha, url: result.html_url };
  },
};

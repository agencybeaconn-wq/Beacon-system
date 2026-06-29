import { z } from "zod";
import { vaultSearch } from "../_shared/github-vault.js";
import type { Tool } from "../types.js";

export const vaultSearchTool: Tool = {
  name: "vault_search",
  description:
    "Full-text search the Lever QI Obsidian vault (Lever's shared knowledge brain). Returns matching file paths + snippets. Use to find decisions, client status, playbooks, events. Limit results with `limit` (default 20). Optionally narrow by `path` prefix (e.g. '02-businesses/_clients-portfolio').",
  inputSchema: z.object({
    query: z.string().min(2).describe("Keywords. GitHub code-search syntax accepted."),
    path: z.string().optional().describe("Optional vault subpath to scope the search."),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  async handler(input) {
    return vaultSearch(input.query, { path: input.path, limit: input.limit });
  },
};

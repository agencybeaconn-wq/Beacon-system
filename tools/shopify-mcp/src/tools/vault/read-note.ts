import { z } from "zod";
import { vaultRead } from "../_shared/github-vault.js";
import type { Tool } from "../types.js";

export const vaultReadNoteTool: Tool = {
  name: "vault_read_note",
  description:
    "Read a single note from the Lever QI vault. Pass the path relative to the vault root (e.g. '00-operating-brain/MOC-operating-brain.md'). Returns frontmatter + body verbatim. Use vault_search first if you don't know the exact path.",
  inputSchema: z.object({
    path: z.string().min(3).describe("Vault path (e.g. '02-businesses/lever/status.md')."),
  }),
  async handler(input) {
    const file = await vaultRead(input.path);
    if (!file) return { found: false, path: input.path };
    return {
      found: true,
      path: file.path,
      size_bytes: file.size,
      content: file.content,
    };
  },
};

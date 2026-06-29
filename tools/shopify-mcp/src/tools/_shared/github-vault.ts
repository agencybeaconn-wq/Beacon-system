/**
 * GitHub Contents API client for the Lever QI vault.
 *
 * The vault (Obsidian) is mirrored in a private GitHub repo via the Obsidian Git
 * plugin (each squad member's machine commits + pushes on save). The MCP reads
 * and writes the same repo via GitHub API — no filesystem dependency, works from
 * the Vercel serverless function.
 *
 * Writes are always commits with `[mcp] <action> by <email>` so the audit trail
 * lives in git history. Squad members `git pull` (or rely on Obsidian Git auto-pull)
 * to see updates in their Obsidian.
 *
 * Repo layout assumed:
 *   <root>/                      → Obsidian vault root
 *   <root>/04-data-rituals/mcp-log/  → where MCP writes events/decisions
 *   <root>/02-businesses/_clients-portfolio/<slug>/  → client snapshots
 *
 * Required env:
 *   LEVER_VAULT_GITHUB_TOKEN  — fine-grained PAT with contents:read+write on the repo
 *   LEVER_VAULT_REPO          — "owner/name", e.g. "leveragency/lever-qi"
 *   LEVER_VAULT_BRANCH        — default "main"
 */
import { vaultGitHub } from "../../oauth/config.js";

const GH = "https://api.github.com";

function headers() {
  const { token } = vaultGitHub();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "lever-shopify-mcp",
  };
}

export interface VaultFile {
  path: string;
  sha: string;
  size: number;
  content: string; // UTF-8 decoded
}

/** Read a file at `path` from the vault. Returns null if 404. */
export async function vaultRead(path: string): Promise<VaultFile | null> {
  const { owner, repo, branch } = vaultGitHub();
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, { headers: headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`vaultRead ${path} → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as { sha: string; size: number; content: string; encoding: string; path: string };
  if (json.encoding !== "base64") throw new Error(`unexpected encoding ${json.encoding}`);
  const content = new TextDecoder().decode(Uint8Array.from(atob(json.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
  return { path: json.path, sha: json.sha, size: json.size, content };
}

/** Create or update a file. Pass `sha` (from vaultRead) to overwrite; omit for create-only. */
export async function vaultWrite(input: {
  path: string;
  content: string;
  message: string;
  sha?: string;
  committerName?: string;
  committerEmail?: string;
}): Promise<{ commit_sha: string; html_url: string; content_sha: string }> {
  const { owner, repo, branch } = vaultGitHub();
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(input.path).replace(/%2F/g, "/")}`;
  const body: Record<string, unknown> = {
    message: input.message,
    content: btoa(unescape(encodeURIComponent(input.content))),
    branch,
  };
  if (input.sha) body.sha = input.sha;
  if (input.committerName && input.committerEmail) {
    body.author = { name: input.committerName, email: input.committerEmail };
    body.committer = { name: input.committerName, email: input.committerEmail };
  }
  const r = await fetch(url, { method: "PUT", headers: { ...headers(), "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`vaultWrite ${input.path} → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as { commit: { sha: string; html_url: string }; content: { sha: string } };
  return { commit_sha: json.commit.sha, html_url: json.commit.html_url, content_sha: json.content.sha };
}

/** Append to an existing file (creates if missing). Idempotent commits. */
export async function vaultAppend(input: {
  path: string;
  appendBlock: string; // already-formatted markdown block (will be separated by \n\n)
  message: string;
  initialHeader?: string; // used when creating the file fresh
  committerName?: string;
  committerEmail?: string;
}): Promise<{ commit_sha: string; html_url: string }> {
  const existing = await vaultRead(input.path);
  const baseContent = existing?.content ?? (input.initialHeader ?? "");
  const sep = baseContent.endsWith("\n") ? "\n" : "\n\n";
  const newContent = baseContent + sep + input.appendBlock + "\n";
  const result = await vaultWrite({
    path: input.path,
    content: newContent,
    message: input.message,
    sha: existing?.sha,
    committerName: input.committerName,
    committerEmail: input.committerEmail,
  });
  return { commit_sha: result.commit_sha, html_url: result.html_url };
}

/** Search vault via GitHub code search. Note: GitHub indexes can lag a few minutes after a write. */
export async function vaultSearch(query: string, opts?: { path?: string; limit?: number }): Promise<Array<{ path: string; html_url: string; snippet?: string }>> {
  const { owner, repo } = vaultGitHub();
  // GitHub search syntax: keyword + repo: + path:
  const parts = [query, `repo:${owner}/${repo}`];
  if (opts?.path) parts.push(`path:${opts.path}`);
  const q = encodeURIComponent(parts.join(" "));
  const url = `${GH}/search/code?q=${q}&per_page=${Math.min(opts?.limit ?? 20, 50)}`;
  const r = await fetch(url, { headers: { ...headers(), Accept: "application/vnd.github.text-match+json" } });
  if (!r.ok) throw new Error(`vaultSearch '${query}' → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as { items: Array<{ path: string; html_url: string; text_matches?: Array<{ fragment: string }> }> };
  return json.items.map((it) => ({
    path: it.path,
    html_url: it.html_url,
    snippet: it.text_matches?.[0]?.fragment,
  }));
}

/** List files under a path (e.g. directory listing). */
export async function vaultList(path: string): Promise<Array<{ path: string; type: "file" | "dir"; size: number }>> {
  const { owner, repo, branch } = vaultGitHub();
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, { headers: headers() });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`vaultList ${path} → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as Array<{ path: string; type: "file" | "dir"; size: number }>;
  return Array.isArray(json) ? json.map((f) => ({ path: f.path, type: f.type, size: f.size })) : [];
}

/** List recent commits (for brain_context "what changed lately"). */
export async function vaultRecentCommits(opts?: { since?: string; limit?: number }): Promise<Array<{ sha: string; message: string; author: string; ts: string; html_url: string }>> {
  const { owner, repo, branch } = vaultGitHub();
  const params = new URLSearchParams({ sha: branch, per_page: String(Math.min(opts?.limit ?? 30, 100)) });
  if (opts?.since) params.set("since", opts.since);
  const url = `${GH}/repos/${owner}/${repo}/commits?${params}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(`vaultRecentCommits → ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as Array<{ sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string }>;
  return json.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0] ?? c.commit.message,
    author: c.commit.author.name,
    ts: c.commit.author.date,
    html_url: c.html_url,
  }));
}

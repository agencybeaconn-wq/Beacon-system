/**
 * Vercel Node Function — MCP HTTP endpoint.
 *
 * Deployed at https://<project>.vercel.app/api/mcp
 * Clients add to ~/.claude.json mcpServers:
 *   {
 *     "lever-shopify": {
 *       "type": "http",
 *       "url": "https://lever-shopify-mcp.vercel.app/api/mcp",
 *       "headers": { "Authorization": "Bearer <api-key>" }
 *     }
 *   }
 *
 * Logic lives in src/http.ts — this file is just the Vercel adapter.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleHttpRequest } from "../src/http.js";

export const config = {
  // Node runtime so @shopify/admin-api-client and other Node-only deps work.
  // Switch to "edge" if cold-start matters more than compat.
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Adapt VercelRequest -> standard Request
  const url = `https://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(","));
    else if (v !== undefined) headers.set(k, v);
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    // VercelRequest already parsed the body when content-type is JSON.
    // Re-serialize so handleHttpRequest can re-parse via .json().
    init.body =
      typeof req.body === "string" || req.body === undefined
        ? req.body
        : JSON.stringify(req.body);
  }

  const standardRequest = new Request(url, init);
  const response = await handleHttpRequest(standardRequest);

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const text = await response.text();
  if (text) res.send(text);
  else res.end();
}

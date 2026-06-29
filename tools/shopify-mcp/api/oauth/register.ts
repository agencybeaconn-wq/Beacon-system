/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591).
 * Claude.ai posts here on first connection to get a client_id.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelAdapt, json } from "../../src/oauth/vercel-adapter.js";
import { registerClient } from "../../src/oauth/storage.js";

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return vercelAdapt(req, res, async (request) => {
    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "invalid_client_metadata", error_description: "Body must be JSON" });
    }

    const redirect_uris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : [];
    if (redirect_uris.length === 0) {
      return json(400, { error: "invalid_redirect_uri", error_description: "redirect_uris required" });
    }

    // Validate: HTTPS or localhost/127.0.0.1 (per OAuth 2.1)
    for (const uri of redirect_uris) {
      try {
        const u = new URL(uri);
        const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
        if (u.protocol !== "https:" && !isLocalhost) {
          return json(400, {
            error: "invalid_redirect_uri",
            error_description: `redirect_uri must be HTTPS or loopback: ${uri}`,
          });
        }
      } catch {
        return json(400, { error: "invalid_redirect_uri", error_description: `malformed URI: ${uri}` });
      }
    }

    const client = await registerClient({
      redirect_uris,
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
      client_uri: typeof body.client_uri === "string" ? body.client_uri : undefined,
      software_id: typeof body.software_id === "string" ? body.software_id : undefined,
      software_version: typeof body.software_version === "string" ? body.software_version : undefined,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp",
    });

    return json(201, {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(new Date(client.created_at).getTime() / 1000),
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      scope: client.scope,
    });
  });
}

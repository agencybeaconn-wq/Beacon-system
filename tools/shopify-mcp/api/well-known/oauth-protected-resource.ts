/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * Tells MCP clients (Claude.ai) where to find the authorization server for this resource.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelAdapt, json } from "../../src/oauth/vercel-adapter.js";
import { oauthConfig, SCOPE } from "../../src/oauth/config.js";

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return vercelAdapt(req, res, async () => {
    const { publicUrl } = oauthConfig();
    return json(200, {
      resource: publicUrl,
      resource_name: "Lever Shopify",
      authorization_servers: [publicUrl],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
      resource_documentation: `${publicUrl}/`,
      logo_uri: `${publicUrl}/lever-logo.png`,
    });
  });
}

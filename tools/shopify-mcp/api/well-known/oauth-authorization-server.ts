/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Tells MCP clients which endpoints to call and what we support.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelAdapt, json } from "../../src/oauth/vercel-adapter.js";
import { oauthConfig, SCOPE } from "../../src/oauth/config.js";

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return vercelAdapt(req, res, async () => {
    const { publicUrl } = oauthConfig();
    return json(200, {
      issuer: publicUrl,
      authorization_endpoint: `${publicUrl}/oauth/authorize`,
      token_endpoint: `${publicUrl}/oauth/token`,
      registration_endpoint: `${publicUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [SCOPE],
      service_documentation: `${publicUrl}/`,
      op_policy_uri: `${publicUrl}/`,
      op_tos_uri: `${publicUrl}/`,
      logo_uri: `${publicUrl}/lever-logo.png`,
    });
  });
}

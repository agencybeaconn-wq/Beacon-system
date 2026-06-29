/**
 * Access token signing/verification — HS256 JWT via jose.
 * Token claims: sub=email, aud=resource (canonical MCP URL), exp, iat, jti, scope.
 */
import { SignJWT, jwtVerify } from "jose";
import { oauthConfig, ACCESS_TOKEN_TTL_S } from "./config.js";
import { randomToken } from "./util.js";

let _key: Uint8Array | null = null;
function key(): Uint8Array {
  if (_key) return _key;
  _key = new TextEncoder().encode(oauthConfig().jwtSecret);
  return _key;
}

export interface AccessTokenClaims {
  sub: string;        // user email
  aud: string;        // resource URL
  scope: string;
  client_id: string;
  jti: string;
  exp: number;
  iat: number;
  iss: string;
}

export async function signAccessToken(input: {
  email: string;
  client_id: string;
  scope: string;
  resource: string;
  ttlSeconds?: number;
}): Promise<{ token: string; expiresIn: number }> {
  const { publicUrl } = oauthConfig();
  const ttl = input.ttlSeconds ?? ACCESS_TOKEN_TTL_S;
  const token = await new SignJWT({
    scope: input.scope,
    client_id: input.client_id,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.email.toLowerCase())
    .setAudience(input.resource)
    .setIssuer(publicUrl)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setJti(randomToken(16))
    .sign(key());
  return { token, expiresIn: ttl };
}

export async function verifyAccessToken(token: string, expectedAudience: string): Promise<AccessTokenClaims | null> {
  const expected = expectedAudience.replace(/\/+$/, "");
  // Accept both trailing-slash and no-trailing-slash variants for robustness.
  const candidates = [expected, `${expected}/`, `${expected}/mcp`, `${expected}/api/mcp`];
  try {
    const { payload } = await jwtVerify(token, key(), {
      audience: candidates,
      issuer: oauthConfig().publicUrl,
    });
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}

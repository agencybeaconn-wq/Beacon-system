/**
 * Bearer auth for the HTTP transport.
 *
 * Two formats accepted:
 *   1. OAuth JWT (preferred) — minted by /oauth/token. user = email from `sub` claim.
 *   2. Static API key (legacy) — env vars `LEVER_MCP_API_KEY_<USER>=<key>`. user = lowercased name.
 *
 * Static keys stay for backward compatibility during migration. To force OAuth-only,
 * set `LEVER_MCP_OAUTH_ONLY=1` in the environment.
 *
 * stdio mode bypasses auth (user = "local").
 */
import { verifyAccessToken } from "./oauth/jwt.js";

const STATIC_PREFIX = "LEVER_MCP_API_KEY_";

let _staticKeys: Map<string, string> | null = null;
function loadStaticKeys(): Map<string, string> {
  if (_staticKeys) return _staticKeys;
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith(STATIC_PREFIX) || !v) continue;
    const user = k.slice(STATIC_PREFIX.length).toLowerCase();
    if (!user) continue;
    if (map.has(v)) {
      process.stderr.write(`[auth] WARNING: duplicate static key for "${map.get(v)}" and "${user}"\n`);
    }
    map.set(v, user);
  }
  _staticKeys = map;
  return map;
}

export type AuthResult =
  | { ok: true; user: string; auth: "jwt" | "static" }
  | { ok: false; status: 401 | 403; message: string; wwwAuthenticate?: string };

function wwwAuth(resourceUrl: string | undefined): string {
  // RFC 9728 §5.1
  if (!resourceUrl) return 'Bearer error="invalid_token"';
  return `Bearer error="invalid_token", resource_metadata="${resourceUrl}/.well-known/oauth-protected-resource"`;
}

export async function authenticate(authHeader: string | null | undefined): Promise<AuthResult> {
  const publicUrl = process.env.MCP_PUBLIC_URL?.replace(/\/+$/, "");
  const oauthOnly = process.env.LEVER_MCP_OAUTH_ONLY === "1";

  if (!authHeader) {
    return {
      ok: false,
      status: 401,
      message: "Missing Authorization header",
      wwwAuthenticate: wwwAuth(publicUrl),
    };
  }
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) {
    return {
      ok: false,
      status: 401,
      message: "Authorization header must be 'Bearer <token>'",
      wwwAuthenticate: wwwAuth(publicUrl),
    };
  }
  const token = match[1]!;

  // Try OAuth JWT first.
  if (publicUrl) {
    const claims = await verifyAccessToken(token, publicUrl);
    if (claims) {
      return { ok: true, user: claims.sub, auth: "jwt" };
    }
  }

  if (oauthOnly) {
    return {
      ok: false,
      status: 401,
      message: "Invalid OAuth token (static keys disabled)",
      wwwAuthenticate: wwwAuth(publicUrl),
    };
  }

  // Fall back to static keys.
  const keys = loadStaticKeys();
  if (keys.size === 0) {
    return {
      ok: false,
      status: 403,
      message:
        "No auth configured: provide a valid OAuth bearer (preferred) or set LEVER_MCP_API_KEY_<USER> env vars.",
    };
  }
  const user = keys.get(token);
  if (!user) {
    return {
      ok: false,
      status: 401,
      message: "Invalid token (not a valid OAuth JWT nor a known static key)",
      wwwAuthenticate: wwwAuth(publicUrl),
    };
  }
  return { ok: true, user, auth: "static" };
}

/** For tests / introspection only. Returns static-key user names, never keys. */
export function listAuthorizedUsers(): string[] {
  return Array.from(new Set(loadStaticKeys().values())).sort();
}

/**
 * OAuth 2.1 Token Endpoint.
 *
 * Grants supported:
 *   - authorization_code (with PKCE)
 *   - refresh_token (with rotation)
 *
 * Every branch logs to mcp_oauth.debug_log so we can debug from SQL.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelAdapt, json } from "../../src/oauth/vercel-adapter.js";
import {
  consumeAuthCode,
  createRefreshToken,
  rotateRefreshToken,
  touchClient,
  debugLog,
} from "../../src/oauth/storage.js";
import { signAccessToken } from "../../src/oauth/jwt.js";
import { verifyPkceS256 } from "../../src/oauth/pkce.js";
import { sha256Base64Url } from "../../src/oauth/util.js";
import { oauthConfig, REFRESH_TOKEN_TTL_S, SCOPE } from "../../src/oauth/config.js";

export const config = { runtime: "nodejs" };

function parseFormOrJson(body: string, contentType: string): URLSearchParams {
  const trimmed = body.trimStart();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  // Trust body shape over Content-Type — Claude.ai sends JSON with
  // Content-Type: application/x-www-form-urlencoded, so we sniff.
  if (looksJson || contentType.includes("application/json")) {
    const obj = JSON.parse(body);
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) sp.set(k, String(v));
    return sp;
  }
  return new URLSearchParams(body);
}

function paramsToObj(p: URLSearchParams): Record<string, string> {
  const o: Record<string, string> = {};
  p.forEach((v, k) => {
    // Redact secrets
    if (k === "code" || k === "refresh_token" || k === "code_verifier") {
      o[k] = v ? `${v.slice(0, 6)}...${v.slice(-4)} (len=${v.length})` : "(empty)";
    } else {
      o[k] = v;
    }
  });
  return o;
}

function normalizeResource(input: string | null): string {
  const fallback = oauthConfig().publicUrl;
  if (!input) return fallback;
  return input.replace(/\/+$/, "");
}

async function err(endpoint: string, status: number, code: string, description: string, ctx: Record<string, unknown> = {}): Promise<Response> {
  await debugLog(endpoint, status, `${code}: ${description}`, ctx);
  return json(status, { error: code, error_description: description });
}

async function ok(endpoint: string, status: number, body: Record<string, unknown>, ctx: Record<string, unknown> = {}): Promise<Response> {
  await debugLog(endpoint, status, "success", ctx);
  return json(status, body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return vercelAdapt(req, res, async (request) => {
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

    const ct = request.headers.get("content-type") || "application/x-www-form-urlencoded";
    const bodyText = await request.text();
    let params: URLSearchParams;
    try {
      params = parseFormOrJson(bodyText, ct);
    } catch (e) {
      return err("/oauth/token", 400, "invalid_request", "Body parse failed", { ct, bodyLen: bodyText.length, parseError: (e as Error).message });
    }

    const requestCtx = { content_type: ct, params: paramsToObj(params), body_len: bodyText.length };
    const grant = params.get("grant_type");
    if (grant === "authorization_code") return handleAuthCode(params, requestCtx);
    if (grant === "refresh_token") return handleRefresh(params, requestCtx);
    return err("/oauth/token", 400, "unsupported_grant_type", `grant_type=${grant}`, requestCtx);
  });
}

async function handleAuthCode(p: URLSearchParams, requestCtx: Record<string, unknown>): Promise<Response> {
  const code = p.get("code");
  const client_id = p.get("client_id");
  const redirect_uri = p.get("redirect_uri");
  const code_verifier = p.get("code_verifier");
  const resource = normalizeResource(p.get("resource"));

  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return err("/oauth/token#authcode", 400, "invalid_request", "Missing required params", {
      ...requestCtx,
      missing: { code: !code, client_id: !client_id, redirect_uri: !redirect_uri, code_verifier: !code_verifier },
    });
  }

  const stored = await consumeAuthCode(code);
  if (!stored) {
    return err("/oauth/token#authcode", 400, "invalid_grant", "code invalid, expired, or already used", { ...requestCtx });
  }

  // Compute the verifier hash so we can compare visually if PKCE fails.
  const computedChallenge = await sha256Base64Url(code_verifier);

  if (stored.client_id !== client_id) {
    return err("/oauth/token#authcode", 400, "invalid_grant", "client_id mismatch", {
      ...requestCtx, expected_client_id: stored.client_id, got_client_id: client_id,
    });
  }
  if (stored.redirect_uri !== redirect_uri) {
    return err("/oauth/token#authcode", 400, "invalid_grant", "redirect_uri mismatch", {
      ...requestCtx, expected_redirect: stored.redirect_uri, got_redirect: redirect_uri,
    });
  }
  const pkceOk = await verifyPkceS256(code_verifier, stored.code_challenge);
  if (!pkceOk) {
    return err("/oauth/token#authcode", 400, "invalid_grant", "PKCE verification failed", {
      ...requestCtx,
      stored_challenge: stored.code_challenge,
      computed_challenge: computedChallenge,
      verifier_len: code_verifier.length,
    });
  }

  const { token: access_token, expiresIn } = await signAccessToken({
    email: stored.user_email,
    client_id,
    scope: stored.scope,
    resource,
  });
  const refresh_token = await createRefreshToken({
    client_id,
    user_email: stored.user_email,
    scope: stored.scope,
    resource: stored.resource ? stored.resource.replace(/\/+$/, "") : resource,
    ttlSeconds: REFRESH_TOKEN_TTL_S,
  });
  await touchClient(client_id);

  return ok("/oauth/token#authcode", 200, {
    access_token,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token,
    scope: stored.scope || SCOPE,
  }, { user_email: stored.user_email, client_id, resource });
}

async function handleRefresh(p: URLSearchParams, requestCtx: Record<string, unknown>): Promise<Response> {
  const refresh_token = p.get("refresh_token");
  const client_id = p.get("client_id");
  if (!refresh_token || !client_id) {
    return err("/oauth/token#refresh", 400, "invalid_request", "refresh_token + client_id required", {
      ...requestCtx, missing: { refresh_token: !refresh_token, client_id: !client_id },
    });
  }

  const old = await rotateRefreshToken(refresh_token);
  if (!old) return err("/oauth/token#refresh", 400, "invalid_grant", "refresh_token invalid or expired", { ...requestCtx });
  if (old.client_id !== client_id) {
    return err("/oauth/token#refresh", 400, "invalid_grant", "client_id mismatch", {
      ...requestCtx, expected_client_id: old.client_id, got_client_id: client_id,
    });
  }

  const resource = old.resource ? old.resource.replace(/\/+$/, "") : oauthConfig().publicUrl;
  const { token: access_token, expiresIn } = await signAccessToken({
    email: old.user_email,
    client_id,
    scope: old.scope,
    resource,
  });
  const newRefresh = await createRefreshToken({
    client_id,
    user_email: old.user_email,
    scope: old.scope,
    resource,
    ttlSeconds: REFRESH_TOKEN_TTL_S,
  });
  await touchClient(client_id);

  return ok("/oauth/token#refresh", 200, {
    access_token,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: newRefresh,
    scope: old.scope || SCOPE,
  }, { user_email: old.user_email, client_id, resource });
}

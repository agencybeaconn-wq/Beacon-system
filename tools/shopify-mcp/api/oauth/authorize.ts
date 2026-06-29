/**
 * OAuth 2.1 Authorization Endpoint.
 *
 * GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...
 *   &code_challenge=...&code_challenge_method=S256&state=...&scope=mcp&resource=...
 *
 *   → Validates params, renders SPA. SPA uses Supabase Auth magic link
 *     for identity. After login, SPA POSTs back to this same endpoint with
 *     the Supabase access token, we validate identity + whitelist, mint an
 *     OAuth auth_code, and return the redirect URL.
 *
 * POST /oauth/authorize  (JSON: { authorize_params, supabase_access_token })
 *   → Returns { redirect_to } that the SPA then navigates to.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelAdapt, json, html } from "../../src/oauth/vercel-adapter.js";
import { getClient, isAllowed, createAuthCode } from "../../src/oauth/storage.js";
import { oauthConfig, AUTH_CODE_TTL_S, SCOPE } from "../../src/oauth/config.js";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
  resource?: string;
}

function parseAuthorizeParams(searchParams: URLSearchParams): AuthorizeParams | { error: string } {
  const get = (k: string) => searchParams.get(k) ?? "";
  const response_type = get("response_type");
  const client_id = get("client_id");
  const redirect_uri = get("redirect_uri");
  const code_challenge = get("code_challenge");
  const code_challenge_method = get("code_challenge_method") || "S256";
  const state = get("state");
  const scope = get("scope") || SCOPE;
  const resource = searchParams.get("resource") || undefined;

  if (response_type !== "code") return { error: "response_type must be 'code'" };
  if (!client_id) return { error: "client_id required" };
  if (!redirect_uri) return { error: "redirect_uri required" };
  if (!code_challenge) return { error: "code_challenge required (PKCE)" };
  if (code_challenge_method !== "S256") return { error: "code_challenge_method must be S256" };

  return { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope, resource };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return vercelAdapt(req, res, async (request) => {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const parsed = parseAuthorizeParams(url.searchParams);
      if ("error" in parsed) return html(400, errorPage(parsed.error));

      const client = await getClient(parsed.client_id);
      if (!client) return html(400, errorPage("Unknown client_id"));
      if (!client.redirect_uris.includes(parsed.redirect_uri)) {
        return html(400, errorPage("redirect_uri not registered for this client"));
      }

      return html(200, consentPage(parsed, client.client_name ?? "MCP Client"));
    }

    if (request.method === "POST") {
      let body: { authorize_params?: AuthorizeParams; supabase_access_token?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json(400, { error: "invalid_request", error_description: "Body must be JSON" });
      }
      const p = body.authorize_params;
      const supaToken = body.supabase_access_token;
      if (!p || !supaToken) {
        return json(400, { error: "invalid_request", error_description: "authorize_params + supabase_access_token required" });
      }

      // Validate Supabase session
      const cfg = oauthConfig();
      const supa = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${supaToken}` } },
      });
      const { data: userData, error: userErr } = await supa.auth.getUser(supaToken);
      if (userErr || !userData.user?.email) {
        return json(401, { error: "invalid_session", error_description: "Supabase session invalid" });
      }
      const email = userData.user.email.toLowerCase();

      // Whitelist check
      const allowed = await isAllowed(email);
      if (!allowed) {
        return json(403, {
          error: "access_denied",
          error_description: `${email} not in MCP allowed users — ask João to add you.`,
        });
      }

      // Validate authorize_params against stored client
      const client = await getClient(p.client_id);
      if (!client) return json(400, { error: "invalid_client" });
      if (!client.redirect_uris.includes(p.redirect_uri)) {
        return json(400, { error: "invalid_redirect_uri" });
      }

      const code = await createAuthCode({
        client_id: p.client_id,
        user_email: email,
        redirect_uri: p.redirect_uri,
        code_challenge: p.code_challenge,
        scope: p.scope || SCOPE,
        resource: p.resource,
        ttlSeconds: AUTH_CODE_TTL_S,
      });

      const redirectUrl = new URL(p.redirect_uri);
      redirectUrl.searchParams.set("code", code);
      if (p.state) redirectUrl.searchParams.set("state", p.state);

      return json(200, { redirect_to: redirectUrl.toString(), user: email });
    }

    return json(405, { error: "method_not_allowed" });
  });
}

function errorPage(msg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>OAuth error</title>
<style>body{font:14px/1.5 system-ui;max-width:520px;margin:80px auto;padding:0 20px;color:#222}
.err{background:#fee;border:1px solid #f99;padding:16px;border-radius:8px}</style></head>
<body><h1>Authorization error</h1><div class="err">${escapeHtml(msg)}</div>
<p>If you got here from Claude.ai, the connector is misconfigured. Tell João.</p></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function consentPage(p: AuthorizeParams, clientName: string): string {
  const cfg = oauthConfig();
  // We need to expose anon key to the browser so it can call Supabase Auth.
  // That's fine — anon key is public by design.
  const initialState = JSON.stringify(p);
  return `<!doctype html><html><head>
<meta charset="utf-8">
<title>Authorize ${escapeHtml(clientName)} — Lever Shopify</title>
<link rel="icon" type="image/png" href="/lever-logo.png">
<link rel="apple-touch-icon" href="/lever-logo.png">
<style>
  :root { --bg:#0a0a0a; --fg:#f5f5f5; --muted:#888; --accent:#22d3ee; --border:#222; --danger:#f87171; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto; background:var(--bg); color:var(--fg);
    min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { background:#111; border:1px solid var(--border); border-radius:12px; padding:32px;
    max-width:440px; width:100%; box-shadow:0 8px 32px rgba(0,0,0,.4); }
  h1 { margin:0 0 4px; font-size:20px; font-weight:600; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:24px; }
  .scope { background:#0f1a1f; border:1px solid #1e3a44; border-radius:8px; padding:12px 14px; margin-bottom:20px;
    font-size:13px; color:#a5e6f5; }
  label { display:block; font-size:13px; color:var(--muted); margin-bottom:6px; }
  input[type=email] { width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--border);
    background:#0a0a0a; color:var(--fg); font:inherit; }
  input[type=email]:focus { outline:none; border-color:var(--accent); }
  button { width:100%; padding:11px; border-radius:8px; border:0; background:var(--accent); color:#000;
    font:600 14px/1 inherit; cursor:pointer; margin-top:14px; }
  button:hover { filter:brightness(1.1); }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .secondary { background:#1f1f1f; color:var(--fg); }
  .msg { margin-top:14px; font-size:13px; color:var(--muted); }
  .err { color:var(--danger); }
  .step { display:none; }
  .step.active { display:block; }
  .footer { margin-top:24px; padding-top:16px; border-top:1px solid var(--border); font-size:12px; color:var(--muted); }
  code { font:12px/1 ui-monospace, "SF Mono", Menlo; background:#1f1f1f; padding:2px 6px; border-radius:4px; }
</style>
</head>
<body>
<div class="card">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
    <img src="/lever-logo.png" alt="Lever" width="36" height="36" style="border-radius:6px;background:#000;padding:4px">
    <span style="font-size:13px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase">Lever Shopify MCP</span>
  </div>
  <h1>Authorize <span style="color:var(--accent)">${escapeHtml(clientName)}</span></h1>
  <div class="sub">to access Lever Shopify (your agency's shops via MCP).</div>

  <div class="scope">
    <strong>This will grant:</strong><br>
    • Read & write across all configured Shopify shops<br>
    • Audit log records you as the actor on every call
  </div>

  <div id="step-email" class="step active">
    <label for="email">Email da Lever</label>
    <input id="email" type="email" placeholder="seu@email.com" autocomplete="email">
    <button id="send-link">Send magic link</button>
    <div id="msg-email" class="msg"></div>
  </div>

  <div id="step-sent" class="step">
    <p>✉️ Check your inbox — the link opens this page back logged in.</p>
    <p class="msg">You can close this tab; the email link will work.</p>
  </div>

  <div id="step-consent" class="step">
    <p>Logged in as <code id="user-email"></code>.</p>
    <button id="authorize">Authorize</button>
    <button id="cancel" class="secondary">Cancel</button>
    <div id="msg-consent" class="msg"></div>
  </div>

  <div class="footer">
    <code>${escapeHtml(clientName)}</code> · redirect_uri <code>${escapeHtml(p.redirect_uri)}</code>
  </div>
</div>

<script type="module">
  import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
  const supa = createClient(${JSON.stringify(cfg.supabaseUrl)}, ${JSON.stringify(cfg.supabaseAnonKey)}, {
    auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
  });
  const AUTHORIZE_PARAMS = ${initialState};

  const $ = (id) => document.getElementById(id);
  const show = (id) => {
    document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
  };
  const setMsg = (id, text, isErr) => {
    const el = $(id); el.textContent = text || ""; el.classList.toggle("err", !!isErr);
  };

  async function checkSession() {
    const { data } = await supa.auth.getSession();
    if (data.session?.access_token && data.session.user?.email) {
      $("user-email").textContent = data.session.user.email;
      show("step-consent");
      // Clean tokens from URL hash so a refresh doesn't try to re-parse them.
      if (window.location.hash.includes("access_token")) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return data.session;
    }
    return null;
  }

  // Magic-link redirect lands here with #access_token=... in the URL hash.
  // detectSessionInUrl sometimes misses it (timing, claude.ai iframe quirks),
  // so we parse the hash ourselves and call setSession explicitly as a fallback.
  async function consumeHashIfPresent() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || !hash.includes("access_token")) return false;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (!access_token || !refresh_token) return false;
    const { error } = await supa.auth.setSession({ access_token, refresh_token });
    if (error) {
      setMsg("msg-email", "setSession failed: " + error.message, true);
      return false;
    }
    return true;
  }

  async function pollForSession() {
    for (let i = 0; i < 30; i++) {
      if (await checkSession()) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  $("send-link").addEventListener("click", async () => {
    const email = $("email").value.trim().toLowerCase();
    if (!email || !email.includes("@")) { setMsg("msg-email", "Enter a valid email", true); return; }
    $("send-link").disabled = true;
    setMsg("msg-email", "Sending...");
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    $("send-link").disabled = false;
    if (error) { setMsg("msg-email", error.message, true); return; }
    show("step-sent");
  });

  $("authorize").addEventListener("click", async () => {
    $("authorize").disabled = true;
    setMsg("msg-consent", "Authorizing...");
    const { data: sess } = await supa.auth.getSession();
    if (!sess.session?.access_token) {
      setMsg("msg-consent", "Session expired — refresh and log in again", true);
      return;
    }
    const resp = await fetch(window.location.pathname, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authorize_params: AUTHORIZE_PARAMS,
        supabase_access_token: sess.session.access_token,
      }),
    });
    const body = await resp.json();
    if (!resp.ok || !body.redirect_to) {
      setMsg("msg-consent", body.error_description || body.error || "Authorize failed", true);
      $("authorize").disabled = false;
      return;
    }
    window.location.href = body.redirect_to;
  });

  $("cancel").addEventListener("click", () => {
    const url = new URL(AUTHORIZE_PARAMS.redirect_uri);
    url.searchParams.set("error", "access_denied");
    if (AUTHORIZE_PARAMS.state) url.searchParams.set("state", AUTHORIZE_PARAMS.state);
    window.location.href = url.toString();
  });

  // On load: if Supabase already restored a session (e.g. after magic-link redirect), jump to consent.
  // URL with #access_token=... means we just came back from the magic link.
  (async () => {
    const cameFromMagicLink = window.location.hash.includes("access_token");
    if (cameFromMagicLink) {
      // Try SDK detection first, fall back to manual hash parse.
      const fromSdk = await pollForSession();
      if (fromSdk) return;
      const consumed = await consumeHashIfPresent();
      if (consumed) {
        if (!(await checkSession())) {
          setMsg("msg-email", "setSession ok but session still empty — odd", true);
        }
      } else {
        setMsg("msg-email", "Magic link parsed but no session — paste in DevTools: location.hash", true);
      }
    } else {
      await checkSession();
    }
    supa.auth.onAuthStateChange(() => checkSession());
  })();
</script>
</body></html>`;
}

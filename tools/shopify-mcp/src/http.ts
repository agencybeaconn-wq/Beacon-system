/**
 * HTTP transport for lever-shopify-mcp.
 * Web-standard Request → Response. Works on Vercel, Cloudflare Workers, Node 20+,
 * Deno — anywhere that speaks fetch.
 *
 * Protocol: MCP over plain JSON-RPC 2.0 (no SSE streaming yet — all our tools are
 * request/response so stateless POST is enough). If we add server-initiated
 * notifications later, add SSE here.
 */
import { dispatch, type JsonRpcRequest } from "./dispatch.js";
import { authenticate } from "./auth.js";

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
} as const;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
} as const;

function json(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS, ...extraHeaders },
  });
}

function logCall(args: {
  user: string;
  method: string;
  toolName?: string;
  shop?: string;
  durationMs: number;
  ok: boolean;
  error?: string;
}) {
  // v0.1: stderr-only. v0.2: write to Supabase mcp_audit_log.
  const parts = [
    `user=${args.user}`,
    `method=${args.method}`,
    args.toolName ? `tool=${args.toolName}` : null,
    args.shop ? `shop=${args.shop}` : null,
    `ok=${args.ok}`,
    `ms=${args.durationMs}`,
    args.error ? `err=${JSON.stringify(args.error)}` : null,
  ].filter(Boolean);
  process.stderr.write(`[audit] ${parts.join(" ")}\n`);
}

function homepageHtml(): string {
  const url = "https://lever-shopify-mcp.vercel.app";
  return `<!doctype html><html><head>
<meta charset="utf-8">
<title>Lever Shopify MCP</title>
<meta name="description" content="Multi-shop Shopify Admin MCP server for Lever Agency.">
<link rel="icon" type="image/png" href="${url}/lever-logo.png">
<link rel="apple-touch-icon" href="${url}/lever-logo.png">
<link rel="manifest" href="${url}/manifest.json">
<meta property="og:title" content="Lever Shopify MCP">
<meta property="og:description" content="Multi-shop Shopify MCP for Lever Agency.">
<meta property="og:image" content="${url}/lever-logo.png">
<meta name="theme-color" content="#dc2626">
<style>body{font:14px/1.5 system-ui;background:#0a0a0a;color:#f5f5f5;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
img{width:96px;height:96px;border-radius:12px;background:#000;padding:8px;margin-bottom:16px}
h1{margin:0;font-size:18px}
p{color:#888;font-size:13px;margin-top:8px}
a{color:#22d3ee;text-decoration:none}</style></head>
<body>
<img src="${url}/lever-logo.png" alt="Lever">
<h1>Lever Shopify MCP</h1>
<p>Multi-shop Shopify Admin proxy for Lever Agency.<br>
Endpoint: <code>${url}/mcp</code> · <a href="${url}/.well-known/oauth-authorization-server">OAuth metadata</a></p>
</body></html>`;
}

export async function handleHttpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method === "GET") {
    // Serve HTML if the client looks like a browser (Accept: text/html), so
    // claude.ai homepage scrapers can pick up favicon/OG. JSON otherwise.
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/html")) {
      return new Response(homepageHtml(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return json(200, {
      name: "lever-shopify-mcp",
      title: "Lever Shopify",
      version: "0.2.0",
      transport: "http",
      status: "ok",
      icon: "https://lever-shopify-mcp.vercel.app/lever-logo.png",
    });
  }
  if (request.method !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  const auth = await authenticate(request.headers.get("authorization"));
  if (!auth.ok) {
    const extra: Record<string, string> = {};
    if (auth.wwwAuthenticate) extra["www-authenticate"] = auth.wwwAuthenticate;
    return json(auth.status, { error: auth.message }, extra);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }

  // Batch requests are valid JSON-RPC but rare for MCP; support them anyway.
  const requests: JsonRpcRequest[] = Array.isArray(body)
    ? (body as JsonRpcRequest[])
    : [body as JsonRpcRequest];

  const start = Date.now();
  const responses = await Promise.all(
    requests.map(async (req) => {
      const reqStart = Date.now();
      const result = await dispatch(req, { user: auth.user });
      const toolName =
        req.method === "tools/call"
          ? ((req.params as { name?: string } | undefined)?.name ?? undefined)
          : undefined;
      const shop =
        req.method === "tools/call"
          ? ((req.params as { arguments?: { shop?: string } } | undefined)?.arguments?.shop ??
            undefined)
          : undefined;
      logCall({
        user: auth.user,
        method: req.method,
        toolName,
        shop,
        durationMs: Date.now() - reqStart,
        ok: !result || !("error" in result),
        error: result && "error" in result ? result.error.message : undefined,
      });
      return result;
    }),
  );

  const filtered = responses.filter((r): r is NonNullable<typeof r> => r !== null);

  process.stderr.write(
    `[http] user=${auth.user} batch=${requests.length} totalMs=${Date.now() - start}\n`,
  );

  // All notifications? Per JSON-RPC, return 204.
  if (filtered.length === 0) {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const payload = Array.isArray(body) ? filtered : filtered[0];
  return json(200, payload);
}

/**
 * Vercel Node Function ↔ web-standard Request/Response bridge.
 * Lets OAuth handlers be written as `(Request) => Promise<Response>`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export async function vercelAdapt(
  req: VercelRequest,
  res: VercelResponse,
  handler: (req: Request) => Promise<Response>,
): Promise<void> {
  const url = `https://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(","));
    else if (v !== undefined) headers.set(k, v);
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body =
      typeof req.body === "string" || req.body === undefined
        ? req.body
        : typeof req.body === "object"
          ? JSON.stringify(req.body)
          : String(req.body);
  }

  const response = await handler(new Request(url, init));

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const text = await response.text();
  if (text) res.send(text);
  else res.end();
}

export function json(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}

export function html(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export function redirect(location: string, status: 302 | 303 | 307 = 302): Response {
  return new Response(null, { status, headers: { location, "cache-control": "no-store" } });
}

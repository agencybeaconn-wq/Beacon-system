#!/usr/bin/env node
/**
 * stdio entry point for local development.
 * Reads JSON-RPC requests line-by-line from stdin, writes responses to stdout.
 *
 * For HTTP production deploy, see api/mcp.ts (Vercel) which uses the same dispatcher.
 */
import { createInterface } from "node:readline";
import { dispatch, type JsonRpcRequest } from "./dispatch.js";

const ctx = { user: "local" as const };

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  void (async () => {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        }) + "\n",
      );
      return;
    }
    const res = await dispatch(req, ctx);
    if (res !== null) {
      process.stdout.write(JSON.stringify(res) + "\n");
    }
  })();
});

rl.on("close", () => process.exit(0));

process.stderr.write("[lever-shopify-mcp] ready (stdio, user=local)\n");

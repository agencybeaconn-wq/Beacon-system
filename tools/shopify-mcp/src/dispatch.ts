/**
 * JSON-RPC 2.0 dispatcher for the MCP protocol — transport-agnostic.
 * Shared by both stdio (src/index.ts) and HTTP (src/http.ts) entry points.
 *
 * Supports: initialize, tools/list, tools/call.
 * Ignored gracefully: notifications/initialized, ping (returns empty result).
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import { tools } from "./tools/index.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "lever-shopify-mcp", version: "0.2.0" } as const;

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string; data?: unknown };
    };

export type DispatchContext = {
  /** Authenticated user (HTTP mode) or "local" (stdio mode). Used for audit logs. */
  user: string;
};

const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

function err(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Dispatch a single JSON-RPC request. Returns `null` for notifications
 * (requests without an `id`), per JSON-RPC 2.0 spec.
 */
export async function dispatch(
  req: JsonRpcRequest,
  ctx: DispatchContext,
): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;
  const isNotification = req.id === undefined || req.id === null;

  if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
    return isNotification ? null : err(id, ERR.INVALID_REQUEST, "Invalid JSON-RPC 2.0 request");
  }

  try {
    switch (req.method) {
      case "initialize":
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: zodToJsonSchema(t.inputSchema),
          })),
        });

      case "tools/call": {
        const params = (req.params ?? {}) as { name?: string; arguments?: unknown };
        const tool = tools.find((t) => t.name === params.name);
        if (!tool) {
          return err(id, ERR.METHOD_NOT_FOUND, `Unknown tool: ${params.name}`);
        }
        const parsed = tool.inputSchema.safeParse(params.arguments ?? {});
        if (!parsed.success) {
          return ok(id, {
            isError: true,
            content: [
              {
                type: "text",
                text: `Invalid input for ${tool.name}:\n${parsed.error.issues
                  .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
                  .join("\n")}`,
              },
            ],
          });
        }
        try {
          const result = await tool.handler(parsed.data, { user: ctx.user });
          return ok(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        } catch (toolErr) {
          const message = toolErr instanceof Error ? toolErr.message : String(toolErr);
          return ok(id, {
            isError: true,
            content: [{ type: "text", text: message }],
          });
        }
      }

      default:
        return isNotification ? null : err(id, ERR.METHOD_NOT_FOUND, `Unknown method: ${req.method}`);
    }
  } catch (fatal) {
    const message = fatal instanceof Error ? fatal.message : String(fatal);
    process.stderr.write(`[dispatch] user=${ctx.user} method=${req.method} fatal=${message}\n`);
    return err(id, ERR.INTERNAL, message);
  }
}

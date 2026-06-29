import { z } from "zod";
import { listShopAliases, resolveShop } from "../../config.js";
import { runGraphQL, type GraphQLResult } from "../../client.js";
import type { Tool } from "../types.js";

const MUTATION_KEYWORDS = /\bmutation\b/i;

type ShopResult = {
  shop: string;
  apiVersion: string;
  ok: boolean;
  durationMs: number;
  data?: unknown;
  errors?: unknown;
  extensions?: GraphQLResult["extensions"];
  error?: string;
};

export const bulkQueryTool: Tool = {
  name: "bulk_query",
  description:
    "Run the SAME read-only GraphQL query in parallel across N shops. Pass shops=['kron','supremo',...] or omit to fan out to ALL configured shops. Returns per-shop result with timing, partial failures isolated. Ideal for cross-store reporting (orders today across 16 clients, top product per shop, etc).",
  inputSchema: z.object({
    query: z.string().describe("Read-only GraphQL query. Mutations are rejected."),
    variables: z.record(z.unknown()).optional(),
    shops: z
      .array(z.string())
      .min(1)
      .optional()
      .describe("Shop aliases to query. Omit to run against ALL configured shops."),
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Max parallel requests. Default 5 to be polite to Shopify rate limits."),
  }),
  async handler({ query, variables, shops, concurrency }) {
    if (MUTATION_KEYWORDS.test(query)) {
      throw new Error("bulk_query is read-only. Mutations are not allowed.");
    }
    const targets = shops ?? listShopAliases();
    if (targets.length === 0) {
      throw new Error("No shops configured.");
    }

    const results: ShopResult[] = [];
    let cursor = 0;

    async function worker() {
      while (cursor < targets.length) {
        const idx = cursor++;
        const alias = targets[idx]!;
        const start = Date.now();
        try {
          const resolved = resolveShop(alias);
          const r = await runGraphQL(resolved, query, variables);
          results.push({
            shop: alias,
            apiVersion: resolved.apiVersion,
            ok: !r.errors,
            durationMs: Date.now() - start,
            data: r.data,
            errors: r.errors,
            extensions: r.extensions,
          });
        } catch (err) {
          results.push({
            shop: alias,
            apiVersion: "?",
            ok: false,
            durationMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, targets.length) }, () => worker());
    await Promise.all(workers);

    results.sort((a, b) => a.shop.localeCompare(b.shop));
    return {
      totalShops: targets.length,
      okCount: results.filter((r) => r.ok).length,
      failedCount: results.filter((r) => !r.ok).length,
      concurrency,
      results,
    };
  },
};

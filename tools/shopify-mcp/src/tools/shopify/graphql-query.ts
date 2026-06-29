import { z } from "zod";
import { resolveShop } from "../../config.js";
import { runGraphQL } from "../../client.js";
import type { Tool } from "../types.js";

const MUTATION_KEYWORDS = /\b(mutation)\b/i;

export const graphqlQueryTool: Tool = {
  name: "graphql_query",
  description:
    "Run a read-only GraphQL query against one shop's Admin API. Rejects mutations — use graphql_mutation for writes. Returns { data, errors, extensions } so the caller sees cost/throttle info.",
  inputSchema: z.object({
    shop: z.string().describe("Shop alias from shops.json."),
    query: z
      .string()
      .describe(
        "GraphQL document. Must be a query (or introspection). Mutations are rejected — use graphql_mutation.",
      ),
    variables: z.record(z.unknown()).optional(),
  }),
  async handler({ shop, query, variables }) {
    if (MUTATION_KEYWORDS.test(query)) {
      throw new Error(
        "graphql_query refuses documents containing 'mutation'. Use graphql_mutation for writes.",
      );
    }
    const resolved = resolveShop(shop);
    const result = await runGraphQL(resolved, query, variables);
    return {
      shop: resolved.alias,
      apiVersion: resolved.apiVersion,
      ...result,
    };
  },
};

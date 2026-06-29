import { z } from "zod";
import { resolveShop } from "../../config.js";
import { runGraphQL } from "../../client.js";
import type { Tool } from "../types.js";

const MUTATION_KEYWORD = /\bmutation\b/i;

export const graphqlMutationTool: Tool = {
  name: "graphql_mutation",
  description:
    "Run a GraphQL mutation against one shop's Admin API. Caller MUST set confirm=true — the agent should pause and verify the change with the human before invoking. Use for product/order/discount/inventory writes.",
  inputSchema: z.object({
    shop: z.string().describe("Shop alias from shops.json."),
    mutation: z.string().describe("GraphQL document containing exactly one `mutation` operation."),
    variables: z.record(z.unknown()).optional(),
    confirm: z
      .literal(true)
      .describe(
        "Must be true. Surfaces intent: caller acknowledges this is a write and has confirmed with the human.",
      ),
  }),
  async handler({ shop, mutation, variables }) {
    if (!MUTATION_KEYWORD.test(mutation)) {
      throw new Error(
        "graphql_mutation requires a document containing 'mutation'. Use graphql_query for reads.",
      );
    }
    const resolved = resolveShop(shop);
    const result = await runGraphQL(resolved, mutation, variables);
    return {
      shop: resolved.alias,
      apiVersion: resolved.apiVersion,
      ...result,
    };
  },
};

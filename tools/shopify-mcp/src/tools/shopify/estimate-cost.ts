import { z } from "zod";
import { resolveShop } from "../../config.js";
import { runGraphQL } from "../../client.js";
import type { Tool } from "../types.js";

/**
 * estimate_cost — G10 fix
 *
 * Shopify GraphQL retorna `extensions.cost.requestedQueryCost` em TODA response.
 * Mas pra mutations grandes com aliases, sem rodar não dá pra saber se vai
 * estourar o throttle bucket (2000 pts, restore 100/s).
 *
 * Esta tool faz um DRY-RUN via introspection: parse o documento e estima cost
 * pelos aliases × custo médio por operation type. Alternativa: usa o cost
 * estimator do Shopify se disponível em uma chamada introspectiva.
 *
 * Filosofia híbrida: usa runtime data primeiro (toCost actual de uma query
 * pequena), senão estima por heurística baseada em operation type counting.
 *
 * Cost médios observados (2026-05-20):
 *   - productUpdate / productCreate: 10 pts
 *   - productSet: 50 pts
 *   - collectionUpdate / collectionCreate: 10 pts
 *   - publishablePublish: 10 pts
 *   - themeFilesUpsert: 10-30 pts dependendo do número de files
 *   - graphql query simples: 1-5 pts
 *
 * Regra prática: split em batches se cost > 500 pts.
 */

// Heuristic table — refinado conforme observação real
const OPERATION_COST: Record<string, number> = {
  productSet: 50,
  productCreate: 12,
  productUpdate: 10,
  productDuplicate: 50,
  productDelete: 10,
  productVariantsBulkCreate: 20,
  productVariantsBulkUpdate: 15,
  productCreateMedia: 15,
  collectionCreate: 10,
  collectionUpdate: 10,
  collectionAddProducts: 12,
  collectionDelete: 10,
  pageCreate: 10,
  pageUpdate: 10,
  pageDelete: 10,
  menuCreate: 12,
  menuUpdate: 12,
  publishablePublish: 10,
  publishableUnpublish: 10,
  themeFilesUpsert: 20,
  themeCreate: 30,
  themePublish: 20,
  themeFilesDelete: 15,
  discountCodeBasicCreate: 15,
  customerCreate: 10,
  customerUpdate: 10,
  orderUpdate: 10,
  inventoryAdjustQuantities: 15,
  metafieldsSet: 10,
  bulkOperationRunQuery: 100,
  bulkOperationRunMutation: 100,
};

const COST_BUDGET = {
  comfortable: 500,
  warning: 800,
  hard_limit: 1000,
};

function countMutationsByName(doc: string): Record<string, number> {
  const counts: Record<string, number> = {};
  // Match `alias: mutationName(...)` or just `mutationName(...)` inside mutation body
  // Conservative regex — pode subestimar mutations dentro de fragments
  const mutationNames = Object.keys(OPERATION_COST);
  for (const name of mutationNames) {
    // word boundary + parenthesis = invocation
    const re = new RegExp(`\\b${name}\\s*\\(`, "g");
    const matches = doc.match(re);
    if (matches) counts[name] = matches.length;
  }
  return counts;
}

export const estimateCostTool: Tool = {
  name: "estimate_cost",
  description:
    "Estimate Shopify Admin API GraphQL cost (throttle points) for a query/mutation document BEFORE running it. Useful for batch operations with aliases (e.g. 35 productUpdate in one mutation) — avoids hitting the 1000-cost-per-mutation hard limit or burning through the 2000-point bucket. Returns estimated cost + recommendation: 'safe' (<500), 'caution' (500-800), 'warning' (>800, consider splitting). Supports both real run (mode='actual', runs a tiny introspection probe + extracts requestedQueryCost) and heuristic (mode='heuristic', counts mutation names × known average cost). Use BEFORE large batch mutations to plan splits.",
  inputSchema: z.object({
    shop: z.string().describe("Shop alias from shops.json (used only for mode='actual')."),
    document: z
      .string()
      .describe(
        "The full GraphQL mutation/query document. Aliased operations counted automatically.",
      ),
    mode: z
      .enum(["heuristic", "actual"])
      .default("heuristic")
      .describe(
        "heuristic: client-side regex count × known operation costs (fast, no API call). actual: runs the document as a probe and extracts extensions.cost.requestedQueryCost (slower but exact — WARNING: actually executes the mutation, only use for read-only queries).",
      ),
  }),
  async handler({ shop, document, mode }) {
    const counts = countMutationsByName(document);
    let heuristicTotal = 0;
    const breakdown: Array<{ operation: string; count: number; cost_per: number; subtotal: number }> = [];
    for (const [op, n] of Object.entries(counts)) {
      const costPer = OPERATION_COST[op] ?? 10;
      const subtotal = n * costPer;
      heuristicTotal += subtotal;
      breakdown.push({ operation: op, count: n, cost_per: costPer, subtotal });
    }
    breakdown.sort((a, b) => b.subtotal - a.subtotal);

    let actualCost: number | null = null;
    let actualError: string | null = null;

    if (mode === "actual") {
      try {
        const resolved = resolveShop(shop);
        const resp = await runGraphQL(resolved, document);
        const cost = (resp.extensions as { cost?: { requestedQueryCost?: number; actualQueryCost?: number } })?.cost;
        actualCost = cost?.requestedQueryCost ?? null;
        if (resp.errors) {
          actualError = JSON.stringify(resp.errors).slice(0, 300);
        }
      } catch (e) {
        actualError = (e as Error).message;
      }
    }

    const referenceCost = actualCost ?? heuristicTotal;
    let recommendation: "safe" | "caution" | "warning" | "split_required";
    if (referenceCost < COST_BUDGET.comfortable) recommendation = "safe";
    else if (referenceCost < COST_BUDGET.warning) recommendation = "caution";
    else if (referenceCost < COST_BUDGET.hard_limit) recommendation = "warning";
    else recommendation = "split_required";

    const splitHint =
      recommendation === "split_required" || recommendation === "warning"
        ? `Consider splitting into ${Math.ceil(referenceCost / COST_BUDGET.comfortable)} batches of ~${COST_BUDGET.comfortable} points each (~${Math.floor(
            Object.values(counts).reduce((a, b) => a + b, 0) /
              Math.ceil(referenceCost / COST_BUDGET.comfortable),
          )} operations per batch).`
        : null;

    return {
      mode,
      heuristic_cost: heuristicTotal,
      actual_cost: actualCost,
      actual_error: actualError,
      recommendation,
      cost_budget: COST_BUDGET,
      breakdown,
      split_hint: splitHint,
      throttle_context: {
        bucket_max: 2000,
        restore_rate: "100 pts/sec",
        per_mutation_hard_limit: 1000,
      },
    };
  },
};

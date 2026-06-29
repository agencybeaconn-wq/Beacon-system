import { z } from "zod";
import { resolveShop } from "../../config.js";
import { runGraphQL } from "../../client.js";
import type { Tool } from "../types.js";

/**
 * publish_to_channels — G9 fix
 *
 * Shopify gotcha histórica: produtos criados via productCreate/productSet
 * ficam `status: ACTIVE` mas NÃO são publicados em sales channels (Online Store,
 * Shop, POS). Storefront não mostra produtos até `publishablePublish` rodar.
 *
 * Esta tool resolve isso em 1 chamada — aceita lista de produto IDs +
 * canais por nome, mapeia nomes→publication GIDs, e publica em batches.
 *
 * Tipico após criar produtos via productSet:
 *   publish_to_channels({ shop: "matignon", product_ids: [...35 GIDs...], channels: ["Online Store"] })
 *
 * Discovery automático: se `channels` não informado, default = ["Online Store"].
 * Se `channels: "*"`, publica em TODOS os sales channels disponíveis no shop.
 */

const COST_BUDGET = 800; // limite seguro por mutation aliased

export const publishToChannelsTool: Tool = {
  name: "publish_to_channels",
  description:
    "Publish products (or any publishable resource) to one or more Shopify sales channels. Solves the gotcha that productCreate/productSet leaves products at status:ACTIVE but NOT published — storefront empty without this. Accepts product GIDs + channel names (e.g. ['Online Store']); resolves channel names → publication IDs automatically. Default channel: 'Online Store'. Pass channels=['*'] to publish to every available channel. Batches publishablePublish mutations cost-aware (max ~50 per batch). Returns per-product success/failure. Use after any productCreate/productSet/bulk-import to make products visible on storefront.",
  inputSchema: z.object({
    shop: z.string().describe("Shop alias from shops.json."),
    product_ids: z
      .array(z.string())
      .min(1)
      .describe(
        "Array of product GIDs (e.g. 'gid://shopify/Product/9357614973116'). Can also be Collection GIDs — Shopify publishablePublish accepts any publishable resource.",
      ),
    channels: z
      .union([z.array(z.string()), z.literal("*")])
      .optional()
      .describe(
        "Array of channel names (e.g. ['Online Store', 'Shop']). Default ['Online Store']. Use '*' to publish to all available channels on the shop. Names matched case-insensitive.",
      ),
    confirm: z
      .literal(true)
      .describe(
        "Must be true. This is a write mutation that makes products visible on storefront — confirm with human.",
      ),
  }),
  async handler({ shop, product_ids, channels }) {
    const resolved = resolveShop(shop);
    const startedAt = Date.now();

    // ─── 1. Discover publications on shop ─────────────────────
    type PubNode = { id: string; name: string };
    type PubResp = { publications: { edges: { node: PubNode }[] } };
    const pubsResp = await runGraphQL<PubResp>(
      resolved,
      `{ publications(first: 25) { edges { node { id name } } } }`,
    );
    if (pubsResp.errors) {
      throw new Error(
        `Failed to list publications: ${JSON.stringify(pubsResp.errors)}`,
      );
    }
    const allPubs = pubsResp.data?.publications.edges.map((e) => e.node) ?? [];
    if (allPubs.length === 0) {
      throw new Error(
        `Shop ${resolved.alias} has no publications. App may lack 'write_publications' scope.`,
      );
    }

    // ─── 2. Resolve target channels → publication GIDs ─────────────────────
    const requestedChannels = channels === "*"
      ? "*"
      : (channels ?? ["Online Store"]);

    let targetPubs: PubNode[];
    if (requestedChannels === "*") {
      targetPubs = allPubs;
    } else {
      const requestedLower = requestedChannels.map((c: string) => c.toLowerCase());
      targetPubs = allPubs.filter((p: PubNode) =>
        requestedLower.includes(p.name.toLowerCase()),
      );
      const found = targetPubs.map((p: PubNode) => p.name.toLowerCase());
      const missing = requestedLower.filter((r: string) => !found.includes(r));
      if (missing.length > 0) {
        throw new Error(
          `Channels not found on shop: ${missing.join(", ")}. Available: ${allPubs.map((p) => p.name).join(", ")}`,
        );
      }
    }
    if (targetPubs.length === 0) {
      throw new Error("No target channels resolved.");
    }

    const pubInput = targetPubs.map((p) => ({ publicationId: p.id }));

    // ─── 3. Batch publishablePublish ─────────────────────
    // Cost: ~10 per alias × N publications. Conservative batch = 40 product IDs.
    const BATCH_SIZE = Math.max(
      1,
      Math.floor(COST_BUDGET / Math.max(10, targetPubs.length * 10)),
    );

    const successes: string[] = [];
    const failures: { id: string; errors: unknown }[] = [];

    for (let i = 0; i < product_ids.length; i += BATCH_SIZE) {
      const slice = product_ids.slice(i, i + BATCH_SIZE);

      // Build aliased mutation
      const aliasLines: string[] = [];
      const varDecls: string[] = ["$pub: [PublicationInput!]!"];
      const vars: Record<string, unknown> = { pub: pubInput };
      for (let j = 0; j < slice.length; j++) {
        const idx = i + j;
        varDecls.push(`$id${idx}: ID!`);
        vars[`id${idx}`] = slice[j];
        aliasLines.push(
          `p${idx}: publishablePublish(id: $id${idx}, input: $pub) { userErrors { field message } }`,
        );
      }
      const mutation = `mutation publish(${varDecls.join(", ")}) {\n  ${aliasLines.join("\n  ")}\n}`;

      const resp = await runGraphQL<Record<string, { userErrors: Array<{ field: string[]; message: string }> }>>(
        resolved,
        mutation,
        vars,
      );
      if (resp.errors) {
        for (const id of slice) failures.push({ id, errors: resp.errors });
        continue;
      }
      const data = resp.data ?? {};
      for (let j = 0; j < slice.length; j++) {
        const idx = i + j;
        const aliasResult = data[`p${idx}`];
        if (!aliasResult || aliasResult.userErrors.length === 0) {
          successes.push(slice[j]);
        } else {
          failures.push({ id: slice[j], errors: aliasResult.userErrors });
        }
      }
      // small delay between batches
      await new Promise((r) => setTimeout(r, 150));
    }

    return {
      shop: resolved.alias,
      channels_published_to: targetPubs.map((p) => ({ name: p.name, id: p.id })),
      total_resources: product_ids.length,
      succeeded: successes.length,
      failed: failures.length,
      successes,
      failures,
      duration_ms: Date.now() - startedAt,
    };
  },
};

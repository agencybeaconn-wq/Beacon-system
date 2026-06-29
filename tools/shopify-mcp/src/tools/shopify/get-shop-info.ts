import { z } from "zod";
import { resolveShop } from "../../config.js";
import { runGraphQL } from "../../client.js";
import type { Tool } from "../types.js";

const QUERY = /* GraphQL */ `
  query LeverShopifyMcpShopInfo {
    shop {
      id
      name
      myshopifyDomain
      primaryDomain {
        url
        host
      }
      email
      contactEmail
      ianaTimezone
      currencyCode
      billingAddress {
        country
        countryCodeV2
      }
      plan {
        displayName
        partnerDevelopment
        shopifyPlus
      }
      checkoutApiSupported
    }
  }
`;

type ShopInfoResponse = {
  shop: {
    id: string;
    name: string;
    myshopifyDomain: string;
    primaryDomain: { url: string; host: string };
    email: string;
    contactEmail?: string | null;
    ianaTimezone: string;
    currencyCode: string;
    billingAddress?: { country?: string | null; countryCodeV2?: string | null } | null;
    plan: { displayName: string; partnerDevelopment: boolean; shopifyPlus: boolean };
    checkoutApiSupported: boolean;
  };
};

export const getShopInfoTool: Tool = {
  name: "get_shop_info",
  description:
    "Fetch core metadata for one configured shop (name, primary domain, currency, timezone, plan). Useful as a smoke test after configuring a new shop, and as quick context before queries.",
  inputSchema: z.object({
    shop: z.string().describe("Shop alias as defined in shops.json (e.g. 'kron', 'supremo')."),
  }),
  async handler({ shop }) {
    const resolved = resolveShop(shop);
    const result = await runGraphQL<ShopInfoResponse>(resolved, QUERY);
    if (result.errors) {
      return { shop: resolved.alias, errors: result.errors };
    }
    return {
      shop: resolved.alias,
      label: resolved.label,
      apiVersion: resolved.apiVersion,
      data: result.data?.shop,
    };
  },
};

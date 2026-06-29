import { createAdminApiClient } from "@shopify/admin-api-client";
import type { ResolvedShop } from "./config.js";

type AdminClient = ReturnType<typeof createAdminApiClient>;

const clients = new Map<string, AdminClient>();

export function getClient(shop: ResolvedShop): AdminClient {
  const key = `${shop.alias}:${shop.apiVersion}`;
  let client = clients.get(key);
  if (!client) {
    client = createAdminApiClient({
      storeDomain: shop.domain,
      apiVersion: shop.apiVersion,
      accessToken: shop.accessToken,
    });
    clients.set(key, client);
  }
  return client;
}

export type GraphQLResult<T = unknown> = {
  data?: T;
  errors?: unknown;
  extensions?: { cost?: unknown };
};

export async function runGraphQL<T = unknown>(
  shop: ResolvedShop,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResult<T>> {
  const client = getClient(shop);
  const response = await client.request(query, { variables });
  return {
    data: response.data as T,
    errors: response.errors,
    extensions: response.extensions,
  };
}

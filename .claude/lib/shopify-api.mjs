// Helpers compartilhados pra chamar Shopify Admin API (REST + GraphQL).
// Usado pelas skills via import. NÃO duplicar este código dentro de skills.
//
// Uso:
//   import { shReq, shopifyGraphQL, nextPageUrl, getCreds, delay, API_VERSION } from '../../lib/shopify-api.mjs';

import https from 'https';
import { supaRest } from './supabase-rest.mjs';

export const API_VERSION = '2026-04';

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Chama Shopify REST Admin API.
 *
 * **Retry automático em 429** (rate limit): tenta até 5 vezes com backoff exponencial
 * 1s, 2s, 4s, 8s, 16s. Respeita o header `Retry-After` se presente.
 *
 * @param {string} shop - domain (ex: "qpur7u-jp.myshopify.com")
 * @param {string} token - shopify_access_token
 * @param {"GET"|"POST"|"PUT"|"DELETE"} method
 * @param {string} path - ex: "/admin/api/2026-01/products.json?limit=250"
 * @param {object} [body] - payload JSON (não precisa stringify)
 * @param {object} [opts] - { maxRetries?: number, noRetry?: boolean }
 * @returns {Promise<{status: number, body: any, link: string}>}
 */
export async function shReq(shop, token, method, path, body, opts = {}) {
  const maxRetries = opts.noRetry ? 0 : (opts.maxRetries ?? 5);
  let lastResponse = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await _shReqOnce(shop, token, method, path, body);
    lastResponse = result;
    // Se não é 429, retorna
    if (result.status !== 429) return result;
    // É 429 — backoff antes do retry
    if (attempt < maxRetries) {
      // Se tem Retry-After, usa ele; senão backoff exponencial (1s, 2s, 4s, 8s, 16s)
      const retryAfterHeader = result.headers?.['retry-after'];
      const waitMs = retryAfterHeader
        ? parseFloat(retryAfterHeader) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 16000);
      if (process.env.SHOPIFY_VERBOSE) {
        console.warn(`  ⏳ 429 em ${method} ${path.slice(0, 60)} — backoff ${waitMs}ms (tentativa ${attempt + 1}/${maxRetries})`);
      }
      await delay(waitMs);
    }
  }
  return lastResponse;
}

function _shReqOnce(shop, token, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: shop,
      path,
      method,
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        const link = res.headers.link || '';
        try { resolve({ status: res.statusCode, body: JSON.parse(b), link, headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: b, link, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Chama Shopify GraphQL Admin API.
 *
 * **Retry automático em throttle** (GraphQL `THROTTLED` error ou HTTP 429):
 * backoff exponencial 1s, 2s, 4s, 8s, 16s, até 5 tentativas.
 *
 * @param {string} shop - domain
 * @param {string} token - shopify_access_token
 * @param {string} query - GraphQL mutation ou query
 * @param {object} [variables]
 * @param {object} [opts] - { maxRetries?: number, noRetry?: boolean }
 * @returns {Promise<any>} { data, errors? }
 */
export async function shopifyGraphQL(shop, token, query, variables, opts = {}) {
  const maxRetries = opts.noRetry ? 0 : (opts.maxRetries ?? 5);
  let lastResult = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await _gqlOnce(shop, token, query, variables);
    lastResult = result;
    // Detecta throttle via HTTP status ou GraphQL error code
    const isThrottled = result._httpStatus === 429
      || (result.errors || []).some(e => e.extensions?.code === 'THROTTLED'
        || (e.message || '').includes('Throttled')
        || (e.message || '').includes('Exceeded'));
    if (!isThrottled) return result;
    if (attempt < maxRetries) {
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 16000);
      if (process.env.SHOPIFY_VERBOSE) {
        console.warn(`  ⏳ GraphQL throttled — backoff ${waitMs}ms (tentativa ${attempt + 1}/${maxRetries})`);
      }
      await delay(waitMs);
    }
  }
  return lastResult;
}

function _gqlOnce(shop, token, query, variables) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query, variables: variables || {} });
    const req = https.request({
      hostname: shop,
      path: `/admin/api/${API_VERSION}/graphql.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          parsed._httpStatus = res.statusCode;
          resolve(parsed);
        }
        catch (e) { reject(new Error(`GraphQL parse error: ${b.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Extrai URL da próxima página do header Link do Shopify REST.
 * @param {string} linkHeader - valor do header "link"
 * @returns {string|null} - path+query relativo ou null se não há próxima
 */
export function nextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const m = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  if (!m) return null;
  const u = new URL(m[1]);
  return u.pathname + u.search;
}

/**
 * Pagina automaticamente um endpoint REST que retorna array.
 * @param {string} shop
 * @param {string} token
 * @param {string} initialPath - ex: "/admin/api/2026-01/products.json?limit=250&fields=id,title"
 * @param {string} arrayKey - nome da key no body (ex: "products", "smart_collections")
 * @param {number} [delayMs=400] - delay entre páginas
 * @returns {Promise<any[]>}
 */
export async function paginate(shop, token, initialPath, arrayKey, delayMs = 400) {
  const all = [];
  let path = initialPath;
  while (path) {
    const r = await shReq(shop, token, 'GET', path);
    if (r.status !== 200) {
      throw new Error(`Shopify REST ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    }
    all.push(...(r.body[arrayKey] || []));
    path = nextPageUrl(r.link);
    if (path) await delay(delayMs);
  }
  return all;
}

/**
 * Busca credenciais Shopify de um cliente no Supabase.
 * @param {string} clientId - UUID do agency_clients
 * @returns {Promise<{id: string, name: string, shop: string, token: string}>}
 */
export async function getCreds(clientId) {
  const rows = await supaRest(
    'GET',
    `/agency_clients?select=id,name,shopify_domain,shopify_access_token&id=eq.${clientId}`,
    null,
    { serviceRole: true }
  );
  if (!rows?.[0]) throw new Error(`Cliente não encontrado: ${clientId}`);
  const row = rows[0];
  if (!row.shopify_access_token || !row.shopify_domain) {
    throw new Error(`Cliente "${row.name}" sem Shopify conectada`);
  }
  return {
    id: row.id,
    name: row.name,
    shop: row.shopify_domain,
    token: row.shopify_access_token,
  };
}

/**
 * Valida a resposta do Shopify GraphQL buscando userErrors.
 * Retorna array de erros (vazio se OK) ou lança se a estrutura da response é inesperada.
 * @param {object} response - response do shopifyGraphQL
 * @param {string} mutationPath - ex: "productVariantsBulkUpdate"
 */
export function getGraphQLErrors(response, mutationPath) {
  if (response.errors) return response.errors;
  const result = response.data?.[mutationPath];
  if (!result) return [{ message: `Response sem ${mutationPath}` }];
  return result.userErrors || [];
}

/**
 * Wrapper de productSet — mutation universal moderna (2025+) pra criar/atualizar produto
 * num único call (inclui variants, options, metafields, media, SEO).
 * Substitui combos REST+GraphQL antigos.
 *
 * Modo async (default): dispara e retorna productOperation.id — poll via productOperation node.
 * Modo sync: aguarda (melhor pra poucos produtos).
 *
 * @param {string} shop
 * @param {string} token
 * @param {object} input - ProductSetInput (id opcional pra update; title obrigatório pra create)
 * @param {{ synchronous?: boolean, fields?: string }} [opts]
 * @returns {Promise<{ product?: object, productSetOperation?: object, userErrors: array }>}
 */
export async function productSet(shop, token, input, opts = {}) {
  const synchronous = opts.synchronous ?? false;
  const fields = opts.fields || `
    product { id title handle status }
    productSetOperation { id status }
    userErrors { field message code }
  `;
  const query = `mutation productSet($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      ${fields}
    }
  }`;
  const r = await shopifyGraphQL(shop, token, query, { input, synchronous });
  if (r.errors) {
    return { userErrors: r.errors.map(e => ({ message: e.message })) };
  }
  return r.data?.productSet || { userErrors: [{ message: 'productSet sem response' }] };
}

/**
 * Query de status de uma productOperation (pra pollar productSet async).
 * @param {string} shop
 * @param {string} token
 * @param {string} operationId - gid://shopify/ProductSetOperation/NNN
 */
export async function getProductOperation(shop, token, operationId) {
  const query = `query($id: ID!) {
    productOperation(id: $id) {
      ... on ProductSetOperation {
        id
        status
        product { id title }
        userErrors { field message code }
      }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, query, { id: operationId });
  return r.data?.productOperation || null;
}

/**
 * Polla productOperation até terminar (COMPLETE / FAILED).
 * @param {string} shop
 * @param {string} token
 * @param {string} operationId
 * @param {{interval?: number, timeout?: number}} [opts]
 */
export async function pollProductOperation(shop, token, operationId, opts = {}) {
  const interval = opts.interval ?? 1500;
  const timeout = opts.timeout ?? 2 * 60 * 1000;
  const started = Date.now();
  while (true) {
    const op = await getProductOperation(shop, token, operationId);
    if (!op) throw new Error(`productOperation ${operationId} não encontrada`);
    if (op.status === 'COMPLETE' || op.status === 'FAILED') return op;
    if (Date.now() - started > timeout) {
      throw new Error(`productOperation ${operationId} timeout — last status: ${op.status}`);
    }
    await delay(interval);
  }
}

/**
 * Cria webhook subscription via GraphQL (Admin API 2026-04).
 * Substitui o REST /webhooks.json antigo.
 *
 * @param {string} shop
 * @param {string} token
 * @param {string} topic - ex: "PRODUCTS_UPDATE", "ORDERS_PAID", "COLLECTIONS_UPDATE"
 * @param {string} callbackUrl - URL HTTPS pública
 * @param {{ format?: 'JSON'|'XML', includeFields?: string[] }} [opts]
 */
export async function webhookSubscriptionCreate(shop, token, topic, callbackUrl, opts = {}) {
  const query = `mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id topic callbackUrl format }
      userErrors { field message }
    }
  }`;
  const variables = {
    topic,
    webhookSubscription: {
      callbackUrl,
      format: opts.format || 'JSON',
      ...(opts.includeFields ? { includeFields: opts.includeFields } : {}),
    },
  };
  const r = await shopifyGraphQL(shop, token, query, variables);
  return r.data?.webhookSubscriptionCreate || { userErrors: [{ message: 'sem response' }] };
}

/**
 * Deleta webhook subscription.
 * @param {string} shop
 * @param {string} token
 * @param {string} id - gid://shopify/WebhookSubscription/NNN
 */
export async function webhookSubscriptionDelete(shop, token, id) {
  const query = `mutation webhookSubscriptionDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors { field message }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, query, { id });
  return r.data?.webhookSubscriptionDelete || { userErrors: [{ message: 'sem response' }] };
}

/**
 * Lista webhook subscriptions ativas.
 * @param {string} shop
 * @param {string} token
 */
export async function webhookSubscriptionsList(shop, token) {
  const query = `query {
    webhookSubscriptions(first: 100) {
      edges {
        node { id topic callbackUrl format createdAt updatedAt }
      }
    }
  }`;
  const r = await shopifyGraphQL(shop, token, query);
  return (r.data?.webhookSubscriptions?.edges || []).map(e => e.node);
}

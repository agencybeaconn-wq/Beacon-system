// Clientes pros MCP servers oficiais da Shopify (AI Toolkit).
//
// 3 servers:
//   1. Storefront MCP    — por loja, sem auth   (POST https://{shop}/api/mcp)
//      Tools: search_shop_catalog, search_shop_policies_and_faqs,
//             get_cart, update_cart (non-discovery, ver docs)
//
//   2. Catalog MCP       — global, JWT (client_credentials via api.shopify.com/auth/access_token)
//      Tools: search_global_products, get_global_product_details
//      Endpoint: https://discover.shopifyapps.com/global/mcp
//
//   3. Checkout MCP      — por loja, JWT (UCP/ECP)
//      Tools: create_checkout, update_checkout, complete_checkout
//      Endpoint: https://{shop}/api/ucp/mcp
//
// Todos seguem o protocolo JSON-RPC 2.0.
//
// Uso:
//   import { storefrontMCP, catalogMCP, getCatalogJWT } from './shopify-mcp.mjs';
//
//   const r = await storefrontMCP('55138c-1b.myshopify.com', 'search_shop_catalog', {
//     query: 'camisa flamengo', context: 'customer wants size M'
//   });

import https from 'https';

let _rpcId = 0;
function nextId() { return ++_rpcId; }

/**
 * POST JSON genérico (promessa wrapper).
 */
function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(b); }
        catch { parsed = { _raw: b }; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Chama uma tool via Storefront MCP (sem auth).
 * @param {string} shopDomain - ex: "55138c-1b.myshopify.com" (sem https://)
 * @param {string} toolName   - ex: "search_shop_catalog", "search_shop_policies_and_faqs"
 * @param {object} args       - argumentos da tool
 * @returns {Promise<object>} - corpo do result do JSON-RPC
 */
export async function storefrontMCP(shopDomain, toolName, args) {
  const clean = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${clean}/api/mcp`;
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: nextId(),
    params: { name: toolName, arguments: args || {} },
  };
  const r = await postJson(url, body);
  if (r.status >= 400) {
    throw new Error(`Storefront MCP ${toolName} HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  if (r.body.error) {
    throw new Error(`Storefront MCP ${toolName} error: ${JSON.stringify(r.body.error)}`);
  }
  return r.body.result;
}

/**
 * Obtém um JWT token pro Catalog MCP via client_credentials.
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<{access_token: string, scope: string, expires_in: number}>}
 */
export async function getCatalogJWT(clientId, clientSecret) {
  const r = await postJson('https://api.shopify.com/auth/access_token', {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  if (r.status >= 400) {
    throw new Error(`getCatalogJWT HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  return r.body;
}

/**
 * Chama uma tool via Catalog MCP (global, requer JWT).
 * @param {string} jwt - access_token obtido via getCatalogJWT
 * @param {string} toolName - "search_global_products", "get_global_product_details"
 * @param {object} args
 */
export async function catalogMCP(jwt, toolName, args) {
  const url = 'https://discover.shopifyapps.com/global/mcp';
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: nextId(),
    params: { name: toolName, arguments: args || {} },
  };
  const r = await postJson(url, body, { Authorization: `Bearer ${jwt}` });
  if (r.status >= 400) {
    throw new Error(`Catalog MCP ${toolName} HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  if (r.body.error) {
    throw new Error(`Catalog MCP ${toolName} error: ${JSON.stringify(r.body.error)}`);
  }
  return r.body.result;
}

/**
 * Chama uma tool via Checkout MCP (UCP/ECP, por-loja, requer JWT).
 * @param {string} shopDomain
 * @param {string} jwt
 * @param {string} toolName - "create_checkout", "update_checkout", "complete_checkout"
 * @param {object} args
 */
export async function checkoutMCP(shopDomain, jwt, toolName, args) {
  const clean = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${clean}/api/ucp/mcp`;
  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: nextId(),
    params: { name: toolName, arguments: args || {} },
  };
  const r = await postJson(url, body, { Authorization: `Bearer ${jwt}` });
  if (r.status >= 400) {
    throw new Error(`Checkout MCP ${toolName} HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  if (r.body.error) {
    throw new Error(`Checkout MCP ${toolName} error: ${JSON.stringify(r.body.error)}`);
  }
  return r.body.result;
}

/**
 * Busca produtos numa loja via Storefront MCP usando o shape UCP atual
 * (tool `search_catalog` com payload `catalog: { query, context, filters }`).
 *
 * Retorna já parseado: { products: [...], pagination: {...} }
 * (extrai do content[0].text quando presente).
 *
 * @param {string} shopDomain
 * @param {string} query
 * @param {{ country?: string, language?: string, currency?: string, intent?: string, filters?: object }} [opts]
 */
export async function storefrontSearch(shopDomain, query, opts = {}) {
  const payload = {
    catalog: {
      query,
      context: {
        language: opts.language || 'en',
        currency: opts.currency || 'USD',
        ...(opts.country ? { address_country: opts.country } : {}),
        ...(opts.intent ? { intent: opts.intent } : {}),
      },
      ...(opts.filters ? { filters: opts.filters } : {}),
    },
  };
  // Tenta primeiro search_catalog (UCP atual), depois search_shop_catalog (legacy nos docs)
  let r;
  try {
    r = await storefrontMCP(shopDomain, 'search_catalog', payload);
  } catch (e) {
    if (/Tool not found/.test(e.message)) {
      r = await storefrontMCP(shopDomain, 'search_shop_catalog', { query, context: opts.intent || '' });
    } else {
      throw e;
    }
  }
  return parseMCPTextContent(r);
}

/**
 * Extrai o objeto JSON do content[0].text de uma resposta MCP (quando é formato texto).
 * Se a content já for um objeto, devolve direto.
 */
export function parseMCPTextContent(result) {
  if (!result) return null;
  if (Array.isArray(result.content)) {
    const textBlock = result.content.find(c => c.type === 'text');
    if (textBlock?.text) {
      try { return JSON.parse(textBlock.text); }
      catch { return { _raw: textBlock.text }; }
    }
  }
  return result;
}

/**
 * Lista as tools disponíveis de um MCP server via tools/list.
 * @param {string} url - endpoint MCP
 * @param {object} [headers] - auth headers se necessário
 */
export async function listMCPTools(url, headers = {}) {
  const body = {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: nextId(),
    params: {},
  };
  const r = await postJson(url, body, headers);
  if (r.status >= 400) {
    throw new Error(`listMCPTools HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  return r.body.result;
}

// CLI mode — teste rápido:
// node shopify-mcp.mjs storefront search "camisa flamengo" 55138c-1b.myshopify.com
import { fileURLToPath } from 'url';
import fs from 'fs';
const isMain = process.argv[1] && (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();

if (isMain) {
  const [, , type, action, query, shop] = process.argv;
  if (!type || !action) {
    console.log('Uso: node shopify-mcp.mjs storefront (search|list) "<query>" <shop>');
    console.log('     node shopify-mcp.mjs storefront list-tools <shop>');
    process.exit(0);
  }
  if (type === 'storefront') {
    if (action === 'list-tools') {
      const clean = (query || shop || '').replace(/^https?:\/\//, '');
      listMCPTools(`https://${clean}/api/mcp`)
        .then(r => console.log(JSON.stringify(r, null, 2)))
        .catch(e => { console.error(e.message); process.exit(1); });
    } else if (action === 'search') {
      storefrontMCP(shop, 'search_shop_catalog', { query, context: 'CLI test' })
        .then(r => console.log(JSON.stringify(r, null, 2)))
        .catch(e => { console.error(e.message); process.exit(1); });
    } else if (action === 'policies') {
      storefrontMCP(shop, 'search_shop_policies_and_faqs', { query, context: 'CLI test' })
        .then(r => console.log(JSON.stringify(r, null, 2)))
        .catch(e => { console.error(e.message); process.exit(1); });
    }
  }
}

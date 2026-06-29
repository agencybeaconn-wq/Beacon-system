// Asserts de pré-flight do PROTOCOL.md (etapa VALIDATE).
// Usado pelas skills antes de qualquer operação write.
//
// Uso:
//   import { assertClientExists, assertShopifyConnected, assertCollectionExists } from '../../lib/validate.mjs';

import { fetchClient } from './supabase-rest.mjs';
import { shReq } from './shopify-api.mjs';

/**
 * Garante que o cliente existe. Aceita UUID ou nome (fuzzy).
 * @param {string} idOrName
 * @returns {Promise<object>} cliente (throw se não existe)
 */
export async function assertClientExists(idOrName) {
  const client = await fetchClient(idOrName);
  if (!client) {
    throw new Error(`Cliente não encontrado: "${idOrName}". Verifique agency_clients.`);
  }
  return client;
}

/**
 * Garante que o cliente tem Shopify conectada (token + domain).
 * @param {object} client - retornado por fetchClient/assertClientExists
 */
export async function assertShopifyConnected(client) {
  if (!client.shopify_domain) {
    throw new Error(`Cliente "${client.name}" sem shopify_domain. Conecte via OAuth primeiro.`);
  }
  if (!client.shopify_access_token) {
    throw new Error(`Cliente "${client.name}" sem shopify_access_token. Reconecte a loja.`);
  }
  if (client.shopify_status && client.shopify_status !== 'connected') {
    throw new Error(`Cliente "${client.name}" com shopify_status="${client.shopify_status}". Reconecte.`);
  }
}

/**
 * Garante que uma coleção existe na Shopify da loja. Busca por handle.
 * @param {string} shop
 * @param {string} token
 * @param {string} handle
 * @returns {Promise<{type: 'smart'|'custom', id: number, title: string, handle: string}>}
 */
export async function assertCollectionExists(shop, token, handle) {
  // Tenta smart primeiro
  const smart = await shReq(shop, token, 'GET',
    `/admin/api/2026-01/smart_collections.json?handle=${encodeURIComponent(handle)}&limit=1`);
  if (smart.body?.smart_collections?.[0]) {
    const c = smart.body.smart_collections[0];
    return { type: 'smart', id: c.id, title: c.title, handle: c.handle };
  }
  // Tenta custom
  const custom = await shReq(shop, token, 'GET',
    `/admin/api/2026-01/custom_collections.json?handle=${encodeURIComponent(handle)}&limit=1`);
  if (custom.body?.custom_collections?.[0]) {
    const c = custom.body.custom_collections[0];
    return { type: 'custom', id: c.id, title: c.title, handle: c.handle };
  }
  throw new Error(`Coleção "${handle}" não existe em ${shop}`);
}

/**
 * Garante que um produto existe. Busca por handle.
 * @param {string} shop
 * @param {string} token
 * @param {string} handle
 * @returns {Promise<object>} product
 */
export async function assertProductExists(shop, token, handle) {
  const r = await shReq(shop, token, 'GET',
    `/admin/api/2026-01/products.json?handle=${encodeURIComponent(handle)}&limit=1&fields=id,handle,title,variants`);
  const p = r.body?.products?.[0];
  if (!p) throw new Error(`Produto "${handle}" não existe em ${shop}`);
  return p;
}

/**
 * Garante que o token tem um escopo específico.
 * @param {string} shop
 * @param {string} token
 * @param {string} scope - ex: "write_discounts"
 */
export async function assertScope(shop, token, scope) {
  const r = await shReq(shop, token, 'GET', '/admin/oauth/access_scopes.json');
  const scopes = (r.body?.access_scopes || []).map(s => s.handle);
  if (!scopes.includes(scope)) {
    throw new Error(
      `Escopo "${scope}" ausente na loja ${shop}. Escopos atuais: ${scopes.join(', ')}. ` +
      `Fix: atualizar SHOPIFY_SCOPES no Supabase + reconectar via OAuth.`
    );
  }
}

/**
 * Garante que o cliente tem pricing configurado (client_pricing).
 * @param {object} pricing - retornado por fetchPricing()
 * @param {string[]} [requiredKeys] - chaves obrigatórias em products (ex: ['torcedor', 'jogador'])
 */
export function assertPricingConfigured(pricing, requiredKeys = []) {
  if (!pricing?.products || Object.keys(pricing.products).length === 0) {
    throw new Error('Pricing não configurado. Rode /update-prices primeiro.');
  }
  const missing = requiredKeys.filter(k => !pricing.products[k]);
  if (missing.length) {
    throw new Error(`Pricing faltando as chaves: ${missing.join(', ')}. Rode /update-prices.`);
  }
}

/**
 * Garante que variáveis de ambiente necessárias estão presentes.
 * Lê do `.env` via supabase-rest.mjs#loadEnv (mesmo loader que as outras libs).
 *
 * @param {string[]} keys - ex: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
 * @throws Error com lista das keys faltando
 */
export async function assertEnv(keys) {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, '../../.env');

  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    });
  }
  // Também checa process.env (fallback pra CI ou env injetado)
  const missing = keys.filter(k => !env[k] && !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Variáveis de ambiente faltando: ${missing.join(', ')}.\n` +
      `Configure em .env na raiz do projeto.`
    );
  }
  // Retorna objeto mesclado pra conveniência
  const out = {};
  for (const k of keys) out[k] = env[k] || process.env[k];
  return out;
}

/**
 * Append em .claude/logs/execution.jsonl — etapa LOG do PROTOCOL.
 * @param {object} entry - objeto a ser serializado (ts adicionado automaticamente)
 */
export async function appendExecutionLog(entry) {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const logDir = path.resolve(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'execution.jsonl');
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  fs.appendFileSync(logFile, line, 'utf8');
}

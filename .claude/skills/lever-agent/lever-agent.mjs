#!/usr/bin/env node
// lever-agent — wrapper CLI pros MCP servers da Shopify.
//
// Uso:
//   node lever-agent.mjs search "<cliente>" "<query>"
//   node lever-agent.mjs policy "<cliente>" "<pergunta>"
//   node lever-agent.mjs tools  "<cliente>"

import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import { storefrontMCP, storefrontSearch, listMCPTools, parseMCPTextContent } from '../../lib/shopify-mcp.mjs';

function fmtMoney(amount, currency) {
  // O MCP retorna amounts em centavos (ex: 23900 = R$ 239,00)
  const value = amount / 100;
  return `${currency} ${value.toFixed(2)}`;
}

function printSearchResult(result, query) {
  const products = result?.products || [];
  if (!products.length) {
    console.log(`\nNenhum produto encontrado pra "${query}".`);
    return;
  }
  console.log(`\n${products.length} produtos encontrados pra "${query}":\n`);
  for (const p of products.slice(0, 10)) {
    const priceMin = p.price_range?.min;
    const priceMax = p.price_range?.max;
    const priceStr = priceMin && priceMax && priceMin.amount !== priceMax.amount
      ? `${fmtMoney(priceMin.amount, priceMin.currency)} – ${fmtMoney(priceMax.amount, priceMax.currency)}`
      : priceMin ? fmtMoney(priceMin.amount, priceMin.currency) : '?';
    console.log(`  • ${p.title}`);
    console.log(`    ${priceStr}  —  ${p.variants?.length || 0} variantes`);
    if (p.url) console.log(`    ${p.url}`);
    console.log('');
  }
  if (products.length > 10) console.log(`  ...+${products.length - 10} mais`);
}

async function main() {
  const [, , action, clientArg, ...rest] = process.argv;
  if (!action) {
    console.error('Uso: node lever-agent.mjs <search|policy|tools> "<cliente>" ["<query>"]');
    process.exit(1);
  }

  if (!clientArg) {
    console.error('Cliente não especificado');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const query = rest.join(' ');

  if (action === 'tools') {
    const url = `https://${client.shopify_domain}/api/mcp`;
    console.log(`\nListando tools do Storefront MCP: ${url}\n`);
    const r = await listMCPTools(url);
    for (const t of r.tools || []) {
      console.log(`  • ${t.name}`);
      if (t.description) {
        const firstLine = t.description.split('\n')[0];
        console.log(`    ${firstLine.slice(0, 140)}`);
      }
    }
    return;
  }

  if (action === 'search') {
    if (!query) { console.error('Query vazia'); process.exit(1); }
    // Deduz país/currency pelo domínio
    const isBR = client.shopify_domain?.endsWith('.com.br') ||
                 /\.myshopify\.com$/.test(client.shopify_domain); // default BR por ora
    const result = await storefrontSearch(client.shopify_domain, query, {
      language: isBR ? 'pt-BR' : 'en',
      currency: isBR ? 'BRL' : 'USD',
      country: isBR ? 'BR' : 'US',
      intent: query,
    });
    printSearchResult(result, query);
    return;
  }

  if (action === 'policy') {
    if (!query) { console.error('Pergunta vazia'); process.exit(1); }
    try {
      const r = await storefrontMCP(client.shopify_domain, 'search_shop_policies_and_faqs', {
        query, context: '',
      });
      const parsed = parseMCPTextContent(r);
      console.log(`\nResposta MCP:\n`);
      console.log(JSON.stringify(parsed, null, 2).slice(0, 3000));
    } catch (e) {
      if (/Tool not found/.test(e.message)) {
        console.error('\nEssa loja não tem a tool search_shop_policies_and_faqs ativada no Storefront MCP.');
        console.error('Rode "node lever-agent.mjs tools <cliente>" pra ver as tools disponíveis.');
      } else {
        throw e;
      }
    }
    return;
  }

  console.error(`Ação desconhecida: ${action}. Use: search | policy | tools`);
  process.exit(1);
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1); });

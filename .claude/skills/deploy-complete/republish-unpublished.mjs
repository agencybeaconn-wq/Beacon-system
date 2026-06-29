#!/usr/bin/env node
// Publica produtos com status=ACTIVE mas sem publishedAt no Online Store sales channel.
// Resolve o bug feedback_active_vs_published: edge function deixa produtos ACTIVE
// mas storefront mostra placeholder pq não estão publicados no canal Online Store.
//
// Uso:
//   node republish-unpublished.mjs "<cliente>"           # dry-run: lista
//   node republish-unpublished.mjs "<cliente>" --apply   # publica

import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';
import { shReq } from '../../lib/shopify-api.mjs';

const API_VERSION = '2026-01';

function parseArgs() {
  const args = { _: [], apply: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else args._.push(a);
  }
  return args;
}

async function getOnlineStorePubId(domain, token) {
  const q = `query { publications(first: 20) { edges { node { id name } } } }`;
  const r = await shReq(domain, token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, { query: q });
  const onlineStore = r.body.data.publications.edges.find(e => e.node.name === 'Online Store');
  if (!onlineStore) throw new Error('Online Store publication não encontrada');
  return onlineStore.node.id;
}

async function fetchUnpublishedActive(domain, token) {
  // GraphQL: products com status:ACTIVE mas sem publishedAt
  const items = [];
  let cursor = null;
  do {
    const q = `query($cursor: String) {
      products(first: 100, after: $cursor, query: "status:active") {
        pageInfo { hasNextPage endCursor }
        edges { node { id title handle publishedAt } }
      }
    }`;
    const r = await shReq(domain, token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
      query: q, variables: { cursor }
    });
    const edges = r.body.data.products.edges;
    for (const e of edges) {
      if (!e.node.publishedAt) items.push(e.node);
    }
    cursor = r.body.data.products.pageInfo.hasNextPage ? r.body.data.products.pageInfo.endCursor : null;
  } while (cursor);
  return items;
}

async function publishProduct(domain, token, productId, publicationId) {
  const m = `mutation($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) { userErrors { field message } }
  }`;
  const r = await shReq(domain, token, 'POST', `/admin/api/${API_VERSION}/graphql.json`, {
    query: m, variables: { id: productId, input: [{ publicationId }] }
  });
  const errs = r.body.data?.publishablePublish?.userErrors || [];
  if (errs.length) throw new Error(errs.map(e => e.message).join('; '));
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const args = parseArgs();
  if (!args._[0]) {
    console.error('Uso: node republish-unpublished.mjs "<cliente>" [--apply]');
    process.exit(1);
  }
  const client = await assertClientExists(args._[0]);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  console.log('\n[1/3] Fetching ACTIVE products without publishedAt...');
  const unpublished = await fetchUnpublishedActive(client.shopify_domain, client.shopify_access_token);
  console.log(`  Encontrados: ${unpublished.length} produtos`);

  if (unpublished.length === 0) {
    console.log('✓ Tudo publicado. Nada a fazer.');
    process.exit(0);
  }

  // Sample 5
  console.log('\n  Amostra:');
  for (const p of unpublished.slice(0, 5)) console.log(`    - ${p.title}`);
  if (unpublished.length > 5) console.log(`    ... +${unpublished.length - 5}`);

  if (!args.apply) {
    console.log('\n(dry-run — adicione --apply pra publicar)');
    process.exit(0);
  }

  console.log('\n[2/3] Resolvendo Online Store publication ID...');
  const pubId = await getOnlineStorePubId(client.shopify_domain, client.shopify_access_token);

  console.log(`\n[3/3] Publicando ${unpublished.length} produtos...`);
  let ok = 0, fail = 0;
  for (const [i, p] of unpublished.entries()) {
    try {
      await publishProduct(client.shopify_domain, client.shopify_access_token, p.id, pubId);
      ok++;
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${unpublished.length} (ok=${ok} fail=${fail})`);
      await delay(200); // rate-limit safety
    } catch (e) {
      fail++;
      console.error(`  ✗ ${p.title}: ${e.message}`);
    }
  }

  console.log(`\n✓ ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

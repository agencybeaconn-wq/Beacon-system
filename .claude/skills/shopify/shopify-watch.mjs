#!/usr/bin/env node
// shopify-watch — gerencia webhook subscriptions pra um cliente Shopify.
//
// Uso:
//   node shopify-watch.mjs watch <cliente>             # subscreve aos topics default
//   node shopify-watch.mjs watch <cliente> --topics=PRODUCTS_UPDATE,ORDERS_PAID
//   node shopify-watch.mjs unwatch <cliente>           # desfaz todas as subscriptions
//   node shopify-watch.mjs list <cliente>              # lista subscriptions ativas
//
// Integra com a edge function `shopify-webhook-receiver` pra receber eventos.

import {
  webhookSubscriptionCreate,
  webhookSubscriptionDelete,
  webhookSubscriptionsList,
} from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected } from '../../lib/validate.mjs';

// Nota: a source of truth das subscriptions é a própria Shopify (GraphQL webhookSubscriptions).
// A tabela webhook_subscriptions no Supabase só é escrita pela edge function (service_role).
// Este CLI usa anon key e não tenta persistir localmente.

const DEFAULT_TOPICS = [
  'PRODUCTS_CREATE',
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'COLLECTIONS_UPDATE',
  'ORDERS_PAID',
  'INVENTORY_LEVELS_UPDATE',
];

const SUPABASE_PROJECT = 'pxhmzpwvxvlwngjbjkrg'; // lever-system
const CALLBACK_URL = `https://${SUPABASE_PROJECT}.supabase.co/functions/v1/shopify-webhook-receiver`;

function parseArgs() {
  const args = { _: [], topics: null };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--topics=')) args.topics = a.slice(9).split(',').map(t => t.trim());
    else args._.push(a);
  }
  return args;
}

async function watch(client, topics) {
  console.log(`\nSubscrevendo ${topics.length} topics em ${client.name}...`);
  console.log(`Callback URL: ${CALLBACK_URL}\n`);

  let ok = 0, fail = 0;
  for (const topic of topics) {
    try {
      const r = await webhookSubscriptionCreate(
        client.shopify_domain,
        client.shopify_access_token,
        topic,
        CALLBACK_URL
      );
      if (r.userErrors?.length) {
        const isDup = r.userErrors.some(e => /already exists|address has already been taken/i.test(e.message));
        if (isDup) { console.log(`  ⚠ ${topic}: já existe`); ok++; continue; }
        console.log(`  ✗ ${topic}: ${JSON.stringify(r.userErrors)}`);
        fail++;
        continue;
      }
      const sub = r.webhookSubscription;
      console.log(`  ✓ ${topic}: ${sub.id}`);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${topic}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nResultado: ok=${ok} fail=${fail}`);
}

async function unwatch(client) {
  console.log(`\nListando subscriptions de ${client.name}...`);
  const subs = await webhookSubscriptionsList(client.shopify_domain, client.shopify_access_token);
  if (!subs.length) { console.log('Nenhuma subscription.'); return; }

  console.log(`  ${subs.length} subscriptions:`);
  for (const s of subs) console.log(`    - ${s.topic}: ${s.id}`);

  console.log(`\nDeletando...`);
  let ok = 0, fail = 0;
  for (const s of subs) {
    try {
      const r = await webhookSubscriptionDelete(client.shopify_domain, client.shopify_access_token, s.id);
      if (r.userErrors?.length) { console.log(`  ✗ ${s.topic}: ${JSON.stringify(r.userErrors)}`); fail++; }
      else { console.log(`  ✓ deleted ${s.topic}`); ok++; }
    } catch (e) { console.log(`  ✗ ${s.topic}: ${e.message}`); fail++; }
  }

  console.log(`\nResultado: ok=${ok} fail=${fail}`);
}

async function list(client) {
  console.log(`\nSubscriptions ativas em ${client.name}:\n`);
  const subs = await webhookSubscriptionsList(client.shopify_domain, client.shopify_access_token);
  if (!subs.length) { console.log('Nenhuma.'); return; }
  for (const s of subs) {
    console.log(`  ${s.topic}`);
    console.log(`    id:       ${s.id}`);
    console.log(`    callback: ${s.callbackUrl}`);
    console.log(`    format:   ${s.format}`);
    console.log('');
  }
}

async function main() {
  const args = parseArgs();
  const [action, clientArg] = args._;
  if (!action || !clientArg) {
    console.error('Uso: node shopify-watch.mjs <watch|unwatch|list> <cliente> [--topics=A,B]');
    process.exit(1);
  }

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const topics = args.topics || DEFAULT_TOPICS;

  if (action === 'watch') await watch(client, topics);
  else if (action === 'unwatch') await unwatch(client);
  else if (action === 'list') await list(client);
  else { console.error(`Ação desconhecida: ${action}`); process.exit(1); }
}

main().catch(e => { console.error(`\n❌ ${e.message}`); process.exit(1); });

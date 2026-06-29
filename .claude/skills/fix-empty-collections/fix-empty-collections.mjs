#!/usr/bin/env node
// fix-empty-collections — investiga e corrige smart collections vazias.
//
// Fluxo:
//  1. Fetch todos os produtos (pra simulação local de rules)
//  2. Fetch smart collections + products_count da Shopify
//  3. Pra cada coleção com count < min, simula rules + classifica:
//     - REALLY_EMPTY: delete
//     - TYPO_CANDIDATE: corrige rule pra fragmento parcial
//     - RULE_TOO_STRICT: relaxa disjunctive ou simplifica
//     - SYNC_LAG: skip (simulação bate mas Shopify reporta 0)
//  4. Preview → Confirm → Apply
//
// Uso:
//   node fix-empty-collections.mjs <clientIdOrName>                    # DRY-RUN
//   node fix-empty-collections.mjs <clientIdOrName> --apply
//   node fix-empty-collections.mjs <clientIdOrName> --apply --no-delete
//   node fix-empty-collections.mjs <clientIdOrName> --min-products=3

import { shReq, nextPageUrl, delay, API_VERSION, paginate } from '../../lib/shopify-api.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { countMatches, tryFragment } from '../../lib/smart-collections.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';

function parseArgs() {
  const args = { _: [], apply: false, noDelete: false, minProducts: 3 };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--no-delete') args.noDelete = true;
    else if (a.startsWith('--min-products=')) args.minProducts = parseInt(a.slice(15)) || 3;
    else args._.push(a);
  }
  return args;
}

async function fetchAllProducts(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title`, 'products', 500);
}

async function fetchSmartCollections(shop, token) {
  return paginate(shop, token,
    `/admin/api/${API_VERSION}/smart_collections.json?limit=250`, 'smart_collections', 500);
}

async function getCollectionCount(shop, token, colId) {
  const r = await shReq(shop, token, 'GET',
    `/admin/api/${API_VERSION}/products/count.json?collection_id=${colId}`);
  return r.body?.count ?? 0;
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node fix-empty-collections.mjs <clientIdOrName> [--apply] [--no-delete] [--min-products=3]');
    process.exit(1);
  }

  console.log(`\n=== fix-empty-collections ${args.apply ? '[APPLY]' : '[DRY-RUN]'} min=${args.minProducts} ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const shop = client.shopify_domain;
  const token = client.shopify_access_token;

  // FETCH
  console.log(`\nBuscando catálogo completo (pra simulação local)...`);
  const products = await fetchAllProducts(shop, token);
  console.log(`  ${products.length} produtos`);

  console.log(`Buscando smart collections...`);
  const smart = await fetchSmartCollections(shop, token);
  console.log(`  ${smart.length} smart collections`);

  // CLASSIFY
  console.log(`\nClassificando coleções vazias...`);
  const empty = [];
  for (const col of smart) {
    const rules = col.rules || [];
    if (rules.length === 0) continue;
    const count = await getCollectionCount(shop, token, col.id);
    await delay(200);
    if (count >= args.minProducts) continue;

    const localMatches = countMatches(products, rules, col.disjunctive);
    let category, suggestedRules = null, rationale = '';

    if (localMatches >= args.minProducts) {
      category = 'SYNC_LAG';
      rationale = `Simulação bate ${localMatches} produtos mas Shopify reporta ${count}`;
    } else {
      // Tenta typo fix em rules do tipo title contains
      const titleContainsRules = rules.filter(r => r.column === 'title' && r.relation === 'contains');
      if (titleContainsRules.length) {
        const fragmentCandidates = [];
        for (const r of titleContainsRules) {
          const frag = tryFragment(r.condition, products);
          if (frag) fragmentCandidates.push({ rule: r, fragment: frag.fragment, count: frag.count });
        }
        if (fragmentCandidates.length) {
          // Best single fragment
          const best = fragmentCandidates.sort((a, b) => b.count - a.count)[0];
          if (best.count >= args.minProducts) {
            category = 'TYPO_CANDIDATE';
            rationale = `"${best.rule.condition}" → "${best.fragment}" bate ${best.count} produtos`;
            suggestedRules = rules.map(r =>
              r === best.rule
                ? { ...r, condition: best.fragment }
                : r
            );
          }
        }
      }
      if (!category) {
        // Tenta relaxar rules via disjunctive=true se AND tem 0 mas OR tem > 0
        if (!col.disjunctive && rules.length > 1) {
          const orMatches = countMatches(products, rules, true);
          if (orMatches >= args.minProducts) {
            category = 'RULE_TOO_STRICT';
            rationale = `AND=0 mas OR bate ${orMatches} produtos`;
            // Preserva rules, só flipa disjunctive
          }
        }
      }
      if (!category) {
        category = 'REALLY_EMPTY';
        rationale = 'Nenhum produto bate rules, sem fragmento alternativo';
      }
    }

    empty.push({ col, count, localMatches, category, rationale, suggestedRules });
  }

  // PREVIEW
  console.log(`\n=== PREVIEW ===`);
  const byCat = {};
  for (const e of empty) (byCat[e.category] ||= []).push(e);
  console.log(`Total vazias: ${empty.length}`);
  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`  ${cat}: ${items.length}`);
  }

  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`\n━━━ ${cat} (${items.length}) ━━━`);
    for (const e of items.slice(0, 8)) {
      console.log(`  • ${e.col.title} (id=${e.col.id}) — ${e.rationale}`);
    }
    if (items.length > 8) console.log(`  ...+${items.length - 8}`);
  }

  if (empty.length === 0) {
    console.log(`\n✓ Nenhuma coleção vazia detectada.`);
    return;
  }

  printEstimate({ count: empty.length, opName: 'fix empty collections (relax rules / delete)', rateLimitMs: 600, unit: 'coleções' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: empty.length, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra corrigir. Use --no-delete pra preservar REALLY_EMPTY.`);
    return;
  }

  // APPLY
  console.log(`\n=== EXECUTANDO ===`);
  let fixed = 0, deleted = 0, skipped = 0, failed = 0;

  for (const e of empty) {
    try {
      if (e.category === 'SYNC_LAG') {
        skipped++;
        continue;
      }
      if (e.category === 'REALLY_EMPTY') {
        if (args.noDelete) { skipped++; continue; }
        // DELETE
        const r = await shReq(shop, token, 'DELETE',
          `/admin/api/${API_VERSION}/smart_collections/${e.col.id}.json`);
        if (r.status >= 200 && r.status < 300) {
          deleted++;
          console.log(`  ✗ DELETED ${e.col.title}`);
        } else {
          failed++;
          console.log(`  ✗ FAIL deletar ${e.col.title}: ${r.status}`);
        }
        await delay(300);
        continue;
      }
      if (e.category === 'TYPO_CANDIDATE') {
        // UPDATE rules
        const payload = {
          smart_collection: {
            id: e.col.id,
            rules: e.suggestedRules,
          },
        };
        const r = await shReq(shop, token, 'PUT',
          `/admin/api/${API_VERSION}/smart_collections/${e.col.id}.json`, payload);
        if (r.status >= 200 && r.status < 300) {
          fixed++;
          console.log(`  ✓ TYPO FIX ${e.col.title} — ${e.rationale}`);
        } else {
          failed++;
          console.log(`  ✗ FAIL atualizar ${e.col.title}: ${r.status} ${JSON.stringify(r.body).slice(0, 150)}`);
        }
        await delay(300);
        continue;
      }
      if (e.category === 'RULE_TOO_STRICT') {
        // Flipa disjunctive=true
        const payload = {
          smart_collection: {
            id: e.col.id,
            disjunctive: true,
          },
        };
        const r = await shReq(shop, token, 'PUT',
          `/admin/api/${API_VERSION}/smart_collections/${e.col.id}.json`, payload);
        if (r.status >= 200 && r.status < 300) {
          fixed++;
          console.log(`  ✓ RELAX ${e.col.title} — ${e.rationale}`);
        } else {
          failed++;
          console.log(`  ✗ FAIL relaxar ${e.col.title}: ${r.status}`);
        }
        await delay(300);
        continue;
      }
    } catch (err) {
      failed++;
      console.log(`  ✗ ERROR ${e.col.title}: ${err.message}`);
    }
  }

  console.log(`\nResultado: fixed=${fixed} deleted=${deleted} skipped=${skipped} failed=${failed}`);

  await appendExecutionLog({
    skill: 'fix-empty-collections',
    client_id: client.id,
    client_name: client.name,
    shop,
    total_empty: empty.length,
    fixed, deleted, skipped, failed,
    by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.length])),
    dry_run: false,
    no_delete: args.noDelete,
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

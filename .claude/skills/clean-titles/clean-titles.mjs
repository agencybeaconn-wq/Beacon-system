#!/usr/bin/env node
// clean-titles — remove marcas e corrige gramática em títulos de produto Shopify.
//
// Uso:
//   node clean-titles.mjs <clientIdOrName>                       # DRY-RUN
//   node clean-titles.mjs <clientIdOrName> --apply               # aplica via bulk op
//   node clean-titles.mjs <clientIdOrName> --apply --legacy      # loop sequencial
//   node clean-titles.mjs <clientIdOrName> --no-brands           # só corrige gênero
//   node clean-titles.mjs <clientIdOrName> --no-gender           # só remove marcas
//
// Segue o PROTOCOL: VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG.

import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION, getGraphQLErrors } from '../../lib/shopify-api.mjs';
import { runBulkMutation } from '../../lib/shopify-bulk.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'Jordan', 'New Balance', 'Reebok', 'Kappa', 'Umbro', 'Joma',
  'Hummel', 'Castore', 'Macron', 'Mizuno', 'Under Armour', 'Asics', 'Fila', 'Champion',
  'Diadora', 'Erreà', 'Errea', 'Mitre', 'Le Coq Sportif', 'Lotto', 'Topper', 'Olympikus',
];

function parseArgs() {
  const args = { _: [], apply: false, legacy: false, brands: true, gender: true, allowCollisions: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--legacy') args.legacy = true;
    else if (a === '--no-brands') args.brands = false;
    else if (a === '--no-gender') args.gender = false;
    else if (a === '--allow-collisions') args.allowCollisions = true;
    else args._.push(a);
  }
  return args;
}

// Normaliza título pra comparação (case + whitespace + acentos)
function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta colisões de título e decide quais changes skipar.
 * Retorna { finalChanges, collisionGroups, skippedCount }.
 *
 * Regras:
 * - Se N changes mapeiam pro mesmo newTitle → primeiro (por id crescente) vence, resto skip
 * - Se um newTitle colide com um título existente não alterado → TODOS do grupo skipam
 *   (porque mudar criaria duplicata com produto intacto)
 * - Com --allow-collisions, nenhum skip é feito (mantém comportamento antigo)
 */
function detectCollisions(changes, allProducts, allowCollisions) {
  const changedIds = new Set(changes.map(c => c.id));
  const unchangedTitles = new Map(); // normTitle → productTitle original
  for (const p of allProducts) {
    if (!changedIds.has(p.id)) {
      unchangedTitles.set(normalizeTitle(p.title), p.title);
    }
  }

  // Agrupa changes por newTitle normalizado
  const groups = new Map();
  for (const c of changes) {
    const key = normalizeTitle(c.newTitle);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const collisionGroups = [];
  const skippedIds = new Set();
  for (const [key, group] of groups) {
    const existingUnchanged = unchangedTitles.get(key);
    if (group.length > 1 || existingUnchanged) {
      const sorted = [...group].sort((a, b) => a.id - b.id);
      if (allowCollisions) {
        collisionGroups.push({ newTitle: sorted[0].newTitle, items: sorted, existingUnchanged, skipped: [] });
        continue;
      }
      let skipped;
      if (existingUnchanged) {
        // Todos perdem (colidem com produto intacto)
        skipped = sorted;
      } else {
        // Primeiro (menor id) vence, resto skip
        skipped = sorted.slice(1);
      }
      for (const c of skipped) skippedIds.add(c.id);
      collisionGroups.push({
        newTitle: sorted[0].newTitle,
        items: sorted,
        existingUnchanged,
        skipped,
      });
    }
  }

  const finalChanges = changes.filter(c => !skippedIds.has(c.id));
  return { finalChanges, collisionGroups, skippedCount: skippedIds.size };
}

function cleanTitle(title, opts) {
  let t = title;
  if (opts.brands) {
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const brandRe = new RegExp('\\b(' + BRANDS.map(esc).join('|') + ')\\b', 'gi');
    t = t.replace(brandRe, '');
  }
  if (opts.gender && /^(camisa|camiseta)\b/i.test(t)) {
    t = t.replace(/\bFeminino\b/g, 'Feminina')
         .replace(/\bFEMININO\b/g, 'FEMININA')
         .replace(/\bfeminino\b/g, 'feminina');
  }
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+-\s+-\s+/g, ' - ').replace(/^\s*-\s*/, '').replace(/\s*-\s*$/, '');
  return t;
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    if (r.status !== 200) throw new Error(`Shopify ${r.status}`);
    all.push(...(r.body.products || []));
    p = nextPageUrl(r.link);
    if (p) await delay(400);
  }
  return all;
}

const PRODUCT_UPDATE_MUT = `mutation call($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}`;

async function main() {
  const args = parseArgs();
  if (!args._[0]) {
    console.error('Uso: node clean-titles.mjs <clientIdOrName> [--apply] [--legacy] [--no-brands] [--no-gender]');
    process.exit(1);
  }

  console.log(`\n=== clean-titles ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`  brands=${args.brands}  gender=${args.gender}`);

  const client = await assertClientExists(args._[0]);
  await assertShopifyConnected(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);

  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`  ${products.length} produtos carregados`);

  const rawChanges = [];
  for (const p of products) {
    const cleaned = cleanTitle(p.title, args);
    if (cleaned !== p.title && cleaned.length >= 8) {
      rawChanges.push({ id: p.id, handle: p.handle, oldTitle: p.title, newTitle: cleaned });
    }
  }

  // Collision detection
  const { finalChanges: changes, collisionGroups, skippedCount } = detectCollisions(
    rawChanges, products, args.allowCollisions
  );

  console.log(`\n=== PREVIEW ===`);
  console.log(`Produtos detectados pra limpeza: ${rawChanges.length} / ${products.length}`);
  if (collisionGroups.length > 0) {
    console.log(`⚠ Colisões de título detectadas: ${collisionGroups.length} grupos (${skippedCount} produtos skipados${args.allowCollisions ? ' — mas --allow-collisions ativo' : ''})`);
    console.log(`\nAmostra das colisões (até 5):`);
    for (const g of collisionGroups.slice(0, 5)) {
      console.log(`  → "${g.newTitle}"`);
      if (g.existingUnchanged) {
        console.log(`      ⚠ já existe como produto intacto: "${g.existingUnchanged}"`);
      }
      for (const item of g.items) {
        const mark = g.skipped.includes(item) ? '  ⊘ skip' : '  ✓ aplicar';
        console.log(`    ${mark} [${item.id}] ${item.oldTitle}`);
      }
    }
    if (collisionGroups.length > 5) console.log(`    ...+${collisionGroups.length - 5} grupos`);
    console.log();
  }
  console.log(`Produtos a alterar de fato: ${changes.length}`);
  console.log(`\nAmostra (15):`);
  changes.slice(0, 15).forEach(c => {
    console.log(`  ${c.oldTitle}`);
    console.log(`  → ${c.newTitle}\n`);
  });

  const planPath = path.join(__dirname, '.tmp_clean_titles_plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    client: client.name,
    changes,
    collisionGroups: collisionGroups.map(g => ({
      newTitle: g.newTitle,
      existingUnchanged: g.existingUnchanged || null,
      items: g.items.map(i => ({ id: i.id, handle: i.handle, oldTitle: i.oldTitle, skipped: g.skipped.includes(i) })),
    })),
    skippedCount,
    ts: new Date().toISOString(),
  }, null, 2));
  console.log(`Plano salvo em ${planPath}`);

  printEstimate({ count: changes.length, opName: 'rename titles via bulk', bulkOp: true, unit: 'produtos' });
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: changes.length, expected: cost.expected, force: cost.forceLarge })) process.exit(2);

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode novamente com --apply pra aplicar.`);
    return;
  }
  if (changes.length === 0) {
    console.log(`\nNada a limpar. ✓`);
    return;
  }

  console.log(`\n=== EXECUTANDO ${args.legacy ? '[legacy]' : '[bulk op]'} ===`);
  let ok = 0, fail = 0;

  if (args.legacy) {
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      try {
        const r = await shopifyGraphQL(client.shopify_domain, client.shopify_access_token, PRODUCT_UPDATE_MUT, {
          input: { id: `gid://shopify/Product/${c.id}`, title: c.newTitle },
        });
        const errs = getGraphQLErrors(r, 'productUpdate');
        if (errs.length) fail++;
        else ok++;
      } catch (e) { fail++; }
      process.stdout.write(`\r  [${i + 1}/${changes.length}] ok=${ok} fail=${fail}   `);
      await delay(600);
    }
  } else {
    const items = changes.map(c => ({
      input: { id: `gid://shopify/Product/${c.id}`, title: c.newTitle },
    }));
    try {
      const res = await runBulkMutation(
        client.shopify_domain,
        client.shopify_access_token,
        PRODUCT_UPDATE_MUT,
        items,
        {
          jsonlOpts: { wrap: 'none' },
          onStage: () => console.log('  ✓ staged upload criado'),
          onPoll: (op) => process.stdout.write(`\r  status=${op.status} objectCount=${op.objectCount || 0}   `),
          pollOpts: { interval: 3000, timeout: 15 * 60 * 1000 },
        }
      );
      console.log(`\n  ✓ bulk op completed: ${res.op.id}`);
      ok = res.ok;
      fail = res.fail.length;
    } catch (e) {
      console.error(`\n❌ Bulk op falhou: ${e.message}\n→ Tente --legacy.`);
      fail = changes.length;
    }
  }

  console.log(`\n\nResultado: ok=${ok} fail=${fail}`);

  await appendExecutionLog({
    skill: 'clean-titles',
    client_id: client.id,
    client_name: client.name,
    shop: client.shopify_domain,
    affected: changes.length,
    ok, fail,
    dry_run: false,
    bulk_mode: !args.legacy,
    flags: { brands: args.brands, gender: args.gender },
  });
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

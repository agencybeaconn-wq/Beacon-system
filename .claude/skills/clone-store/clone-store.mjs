#!/usr/bin/env node
// clone-store — clona loja Shopify inteira (theme + coleções + páginas + menus + produtos)
// direto via API Shopify, sem depender da edge function store-deployment.
//
// Uso:
//   node clone-store.mjs --source="<origem>" --target="<destino>"                # DRY-RUN
//   node clone-store.mjs --source="<origem>" --target="<destino>" --apply        # EXECUTA
//   node clone-store.mjs ... --skip=products,theme --apply                        # pula etapas
//   node clone-store.mjs ... --only=theme --apply                                  # só uma etapa

import { shReq, shopifyGraphQL, paginate, API_VERSION, delay } from '../../lib/shopify-api.mjs';
import { supaRest } from '../../lib/supabase-rest.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const ALL_STEPS = ['collections', 'pages', 'menus', 'theme', 'products', 'polish'];

function parseArgs() {
  const args = { source: null, target: null, apply: false, skip: [], only: null, vendor: null, newTheme: false, themeName: null, targetTheme: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--new-theme') args.newTheme = true;
    else if (a.startsWith('--source=')) args.source = a.slice(9);
    else if (a.startsWith('--target=')) args.target = a.slice(9);
    else if (a.startsWith('--skip=')) args.skip = a.slice(7).split(',').map(s => s.trim());
    else if (a.startsWith('--only=')) args.only = a.slice(7);
    else if (a.startsWith('--vendor=')) args.vendor = a.slice(9);
    else if (a.startsWith('--theme-name=')) args.themeName = a.slice(13);
    else if (a.startsWith('--target-theme=')) args.targetTheme = a.slice(15);
  }
  return args;
}

async function fetchClient(name) {
  const rows = await supaRest('GET',
    `/agency_clients?select=id,name,shopify_domain,shopify_access_token,shopify_status&name=eq.${encodeURIComponent(name)}&limit=1`,
    null, { serviceRole: true });
  if (!rows.length) throw new Error(`Cliente não encontrado: ${name}`);
  const c = rows[0];
  if (c.shopify_status !== 'connected') throw new Error(`${name} está ${c.shopify_status}, precisa estar connected`);
  return c;
}

// ─── STEP 1: COLLECTIONS ─────────────────────────────────────────────────
async function cloneCollections(src, dst, apply) {
  console.log('\n[collections] buscando source + target...');
  const [srcCustom, srcSmart, dstCustom, dstSmart] = await Promise.all([
    paginate(src.shopify_domain, src.shopify_access_token,
      `/admin/api/${API_VERSION}/custom_collections.json?limit=250`, 'custom_collections', 400),
    paginate(src.shopify_domain, src.shopify_access_token,
      `/admin/api/${API_VERSION}/smart_collections.json?limit=250`, 'smart_collections', 400),
    paginate(dst.shopify_domain, dst.shopify_access_token,
      `/admin/api/${API_VERSION}/custom_collections.json?limit=250&fields=handle`, 'custom_collections', 400),
    paginate(dst.shopify_domain, dst.shopify_access_token,
      `/admin/api/${API_VERSION}/smart_collections.json?limit=250&fields=handle`, 'smart_collections', 400),
  ]);

  const existing = new Set([
    ...dstCustom.map(c => c.handle),
    ...dstSmart.map(c => c.handle),
  ]);
  const toCreateCustom = srcCustom.filter(c => !existing.has(c.handle));
  const toCreateSmart = srcSmart.filter(c => !existing.has(c.handle));

  console.log(`  source: ${srcCustom.length} custom + ${srcSmart.length} smart`);
  console.log(`  target já tem: ${existing.size} handles`);
  console.log(`  a criar: ${toCreateCustom.length} custom + ${toCreateSmart.length} smart`);

  if (!apply) return { created_custom: 0, created_smart: 0, skipped: toCreateCustom.length + toCreateSmart.length, dry_run: true };

  let createdCustom = 0, createdSmart = 0, fails = 0;

  for (const c of toCreateCustom) {
    const payload = { custom_collection: {
      title: c.title, handle: c.handle, body_html: c.body_html, sort_order: c.sort_order,
      published: c.published_at !== null,
      image: c.image ? { src: c.image.src, alt: c.image.alt } : undefined,
    }};
    try {
      const r = await shReq(dst.shopify_domain, dst.shopify_access_token, 'POST',
        `/admin/api/${API_VERSION}/custom_collections.json`, payload);
      if (r.status < 300) createdCustom++; else { fails++; console.warn(`    ✗ custom "${c.handle}" status=${r.status}`); }
    } catch (e) { fails++; console.warn(`    ✗ custom "${c.handle}" ${e.message}`); }
    await delay(600);
  }

  for (const c of toCreateSmart) {
    const payload = { smart_collection: {
      title: c.title, handle: c.handle, body_html: c.body_html, sort_order: c.sort_order,
      disjunctive: c.disjunctive, rules: c.rules,
      published: c.published_at !== null,
      image: c.image ? { src: c.image.src, alt: c.image.alt } : undefined,
    }};
    try {
      const r = await shReq(dst.shopify_domain, dst.shopify_access_token, 'POST',
        `/admin/api/${API_VERSION}/smart_collections.json`, payload);
      if (r.status < 300) createdSmart++; else { fails++; console.warn(`    ✗ smart "${c.handle}" status=${r.status}`); }
    } catch (e) { fails++; console.warn(`    ✗ smart "${c.handle}" ${e.message}`); }
    await delay(600);
  }

  console.log(`  ✓ criadas: ${createdCustom} custom + ${createdSmart} smart | ${fails} fails`);
  return { created_custom: createdCustom, created_smart: createdSmart, fails };
}

// ─── STEP 2: PAGES ───────────────────────────────────────────────────────
async function clonePages(src, dst, apply) {
  console.log('\n[pages] buscando...');
  const srcG = await shopifyGraphQL(src.shopify_domain, src.shopify_access_token,
    `{ pages(first: 100) { edges { node { title handle body isPublished templateSuffix } } } }`);
  const srcPages = (srcG.data?.pages?.edges || []).map(e => e.node);

  const dstG = await shopifyGraphQL(dst.shopify_domain, dst.shopify_access_token,
    `{ pages(first: 100) { edges { node { handle } } } }`);
  const dstHandles = new Set((dstG.data?.pages?.edges || []).map(e => e.node.handle));

  const toCreate = srcPages.filter(p => !dstHandles.has(p.handle));
  console.log(`  source: ${srcPages.length} pages | target já tem: ${dstHandles.size} | a criar: ${toCreate.length}`);

  if (!apply) return { created: 0, skipped: toCreate.length, dry_run: true };

  let created = 0, fails = 0;
  const MUT = `mutation pageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) { page { id handle } userErrors { field message } }
  }`;

  for (const p of toCreate) {
    try {
      const r = await shopifyGraphQL(dst.shopify_domain, dst.shopify_access_token, MUT, {
        page: {
          title: p.title, handle: p.handle, body: p.body || '',
          isPublished: p.isPublished, templateSuffix: p.templateSuffix || undefined,
        },
      });
      const errs = r.data?.pageCreate?.userErrors || [];
      if (errs.length === 0 && r.data?.pageCreate?.page?.id) created++;
      else { fails++; console.warn(`    ✗ page "${p.handle}" ${errs.map(e => e.message).join('; ')}`); }
    } catch (e) { fails++; console.warn(`    ✗ page "${p.handle}" ${e.message}`); }
    await delay(500);
  }

  console.log(`  ✓ criadas: ${created} | ${fails} fails`);
  return { created, fails };
}

// ─── STEP 3: MENUS ───────────────────────────────────────────────────────
// Menus usam menuUpdate nos handles default (main-menu, footer, customer-account-main-menu).
// resourceIds são remapeados por handle (source GID → target GID).
async function cloneMenus(src, dst, apply) {
  console.log('\n[menus] buscando...');
  const Q = `{ menus(first: 20) { edges { node { id title handle items { id title url type resourceId items { id title url type resourceId items { id title url type resourceId } } } } } } }`;
  const [srcG, dstG] = await Promise.all([
    shopifyGraphQL(src.shopify_domain, src.shopify_access_token, Q),
    shopifyGraphQL(dst.shopify_domain, dst.shopify_access_token, Q),
  ]);
  const srcMenus = (srcG.data?.menus?.edges || []).map(e => e.node);
  const dstMenus = (dstG.data?.menus?.edges || []).map(e => e.node);
  console.log(`  source: ${srcMenus.length} menus | target: ${dstMenus.length} menus`);

  const HANDLE_MAP = {
    'main-menu-1': 'main-menu',
    'main-menu': 'main-menu',
    'footer-1': 'footer',
    'footer': 'footer',
    'customer-account-main-menu-1': 'customer-account-main-menu',
    'customer-account-main-menu': 'customer-account-main-menu',
  };

  // Build handle→GID maps no SOURCE (pra saber o handle atrás de cada resourceId usado nos itens)
  // e no TARGET (pra achar o GID equivalente lá).
  console.log('  montando mapas de resource (source/target)...');
  async function fetchResourceMap(shop, token, kind) {
    const queries = {
      collections: `{ collections(first: 250) { edges { node { id handle } } } }`,
      pages: `{ pages(first: 250) { edges { node { id handle } } } }`,
      products: `{ products(first: 250) { edges { node { id handle } } } }`,
      blogs: `{ blogs(first: 50) { edges { node { id handle } } } }`,
    };
    const m = new Map(); // gid → handle
    const byHandle = new Map(); // handle → gid
    let cursor = null;
    let hasNextPage = true;
    const key = kind;
    while (hasNextPage) {
      const q = queries[key].replace(/first: (\d+)/, (_, n) => cursor ? `first: ${n}, after: "${cursor}"` : `first: ${n}`);
      const r = await shopifyGraphQL(shop, token, q);
      const conn = r.data?.[key];
      for (const e of (conn?.edges || [])) {
        m.set(e.node.id, e.node.handle);
        byHandle.set(e.node.handle, e.node.id);
      }
      hasNextPage = false; // MVP: só primeira página (250 * 4 = 1000 deve cobrir)
    }
    return { byGid: m, byHandle };
  }

  // Fetch maps em paralelo
  const [srcCols, dstCols, srcPages, dstPages, srcProds, dstProds] = await Promise.all([
    fetchResourceMap(src.shopify_domain, src.shopify_access_token, 'collections'),
    fetchResourceMap(dst.shopify_domain, dst.shopify_access_token, 'collections'),
    fetchResourceMap(src.shopify_domain, src.shopify_access_token, 'pages'),
    fetchResourceMap(dst.shopify_domain, dst.shopify_access_token, 'pages'),
    fetchResourceMap(src.shopify_domain, src.shopify_access_token, 'products'),
    fetchResourceMap(dst.shopify_domain, dst.shopify_access_token, 'products'),
  ]);
  console.log(`    source: ${srcCols.byGid.size} cols, ${srcPages.byGid.size} pages, ${srcProds.byGid.size} products`);
  console.log(`    target: ${dstCols.byGid.size} cols, ${dstPages.byGid.size} pages, ${dstProds.byGid.size} products`);

  // Remapeia resourceId do source pro GID equivalente no target (via handle)
  function remapResourceId(srcGid) {
    if (!srcGid) return null;
    if (srcGid.includes('/Collection/')) {
      const handle = srcCols.byGid.get(srcGid);
      return handle ? dstCols.byHandle.get(handle) || null : null;
    }
    if (srcGid.includes('/Page/')) {
      const handle = srcPages.byGid.get(srcGid);
      return handle ? dstPages.byHandle.get(handle) || null : null;
    }
    if (srcGid.includes('/Product/')) {
      const handle = srcProds.byGid.get(srcGid);
      return handle ? dstProds.byHandle.get(handle) || null : null;
    }
    // Tipos especiais (OnlineStorePage, ShopPolicy, CustomerAccountPage) — deixa passar ou vira HTTP
    return null;
  }

  function buildItemsInput(items) {
    return (items || []).map(item => {
      const node = { title: item.title, type: item.type || 'HTTP' };
      if (item.url) node.url = item.url;
      if (item.resourceId) {
        const newGid = remapResourceId(item.resourceId);
        if (newGid) {
          node.resourceId = newGid;
        } else {
          // Resource não existe no target — descarta esse item pra não falhar o menu inteiro
          return null;
        }
      }
      if (item.items?.length) {
        const children = buildItemsInput(item.items).filter(Boolean);
        if (children.length) node.items = children;
      }
      return node;
    }).filter(Boolean);
  }

  if (!apply) return { updated: 0, created: 0, dry_run: true };

  const MUT_UPDATE = `mutation menuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
    menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { id handle } userErrors { field message } }
  }`;
  const MUT_CREATE = `mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
    menuCreate(title: $title, handle: $handle, items: $items) { menu { id handle } userErrors { field message } }
  }`;

  let updated = 0, created = 0, fails = 0;

  for (const srcMenu of srcMenus) {
    const targetHandle = HANDLE_MAP[srcMenu.handle] || srcMenu.handle;
    const existing = dstMenus.find(m => m.handle === targetHandle);
    const items = buildItemsInput(srcMenu.items);
    try {
      if (existing) {
        const r = await shopifyGraphQL(dst.shopify_domain, dst.shopify_access_token, MUT_UPDATE, {
          id: existing.id, title: srcMenu.title, handle: targetHandle, items,
        });
        const errs = r.data?.menuUpdate?.userErrors || [];
        if (errs.length === 0) { updated++; console.log(`    ✓ menuUpdate "${targetHandle}" (${items.length} items)`); }
        else { fails++; console.warn(`    ✗ menuUpdate "${targetHandle}" ${errs.map(e => e.message).join('; ')}`); }
      } else {
        const r = await shopifyGraphQL(dst.shopify_domain, dst.shopify_access_token, MUT_CREATE, {
          title: srcMenu.title, handle: targetHandle, items,
        });
        const errs = r.data?.menuCreate?.userErrors || [];
        if (errs.length === 0) { created++; console.log(`    ✓ menuCreate "${targetHandle}" (${items.length} items)`); }
        else { fails++; console.warn(`    ✗ menuCreate "${targetHandle}" ${errs.map(e => e.message).join('; ')}`); }
      }
    } catch (e) { fails++; console.warn(`    ✗ menu "${targetHandle}" ${e.message}`); }
    await delay(700);
  }

  console.log(`  ✓ updated=${updated} created=${created} fails=${fails}`);
  return { updated, created, fails };
}

// ─── STEP 4: THEME ───────────────────────────────────────────────────────
// Copia os arquivos principais do tema main do source pro main do target.
// Com --new-theme, cria um tema novo (unpublished) na target pra receber os assets limpos.
async function cloneTheme(src, dst, apply, opts = {}) {
  console.log('\n[theme] identificando temas...');
  const [srcT, dstT] = await Promise.all([
    shReq(src.shopify_domain, src.shopify_access_token, 'GET', `/admin/api/${API_VERSION}/themes.json`),
    shReq(dst.shopify_domain, dst.shopify_access_token, 'GET', `/admin/api/${API_VERSION}/themes.json`),
  ]);
  const srcTheme = srcT.body?.themes?.find(t => t.role === 'main');
  let dstTheme;
  if (opts.targetTheme) {
    // --target-theme=<id|nome>: mira num tema específico da target (ex: rascunho não-publicado)
    dstTheme = dstT.body?.themes?.find(t =>
      String(t.id) === opts.targetTheme || t.name.toLowerCase() === opts.targetTheme.toLowerCase());
    if (!dstTheme) {
      const avail = (dstT.body?.themes || []).map(t => `"${t.name}" (id=${t.id}, ${t.role})`).join(', ');
      console.warn(`  ✗ --target-theme="${opts.targetTheme}" não encontrado na target. Disponíveis: ${avail}`);
      return { copied: 0, fails: 1, error: 'target_theme_not_found' };
    }
  } else {
    dstTheme = dstT.body?.themes?.find(t => t.role === 'main')
            || dstT.body?.themes?.find(t => /lever/i.test(t.name));
  }

  if (!srcTheme) {
    console.warn('  ✗ tema main não encontrado em source');
    return { copied: 0, fails: 0, skipped: true };
  }
  console.log(`  source theme: "${srcTheme.name}" (id=${srcTheme.id})`);

  // Novo tema na target: cria vazio (unpublished) pra receber assets sem conflito de schema
  if (opts.newTheme) {
    const name = opts.themeName || `Lever (clone from ${src.name})`;
    console.log(`  [new-theme] criando tema vazio "${name}" na target...`);
    if (!apply) {
      console.log('  (dry-run) não cria — simulação');
      dstTheme = { id: 'DRY_RUN', name, role: 'unpublished' };
    } else {
      const r = await shReq(dst.shopify_domain, dst.shopify_access_token, 'POST',
        `/admin/api/${API_VERSION}/themes.json`,
        { theme: { name, role: 'unpublished' } });
      if (r.status >= 300 || !r.body?.theme?.id) {
        console.warn(`  ✗ falha criando tema novo: status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
        return { copied: 0, fails: 1, error: 'create_theme_failed' };
      }
      dstTheme = r.body.theme;
      console.log(`  ✓ tema novo criado: id=${dstTheme.id} role=${dstTheme.role}`);
      // Espera 2s pra Shopify terminar boot do tema (senão PUT de assets pode dar 404)
      await delay(2000);
    }
  } else if (!dstTheme) {
    console.warn('  ✗ tema main não encontrado em target (use --new-theme pra criar)');
    return { copied: 0, fails: 0, skipped: true };
  }
  console.log(`  target theme: "${dstTheme.name}" (id=${dstTheme.id}, role=${dstTheme.role})`);

  // Lista todos os assets do source pra copiar todos os JSON/Liquid relevantes
  const listRes = await shReq(src.shopify_domain, src.shopify_access_token, 'GET',
    `/admin/api/${API_VERSION}/themes/${srcTheme.id}/assets.json`);
  const allAssets = listRes.body?.assets || [];
  // Copiar: config/*, sections/*, templates/*, snippets/*, layout/*, locales/*.default.json, assets/*.liquid (apenas liquid)
  // Ordem importa: snippets → sections → layout → templates → locales → config/settings_schema → config/settings_data por último
  // Isso evita 422 por referência a block/section ainda não existente.
  function priority(key) {
    if (key.startsWith('snippets/')) return 1;
    if (key.startsWith('sections/') && key.endsWith('.liquid')) return 2;
    if (key.startsWith('layout/')) return 3;
    if (key.startsWith('assets/') && key.endsWith('.liquid')) return 4;
    if (key.startsWith('locales/')) return 5;
    if (key === 'config/settings_schema.json') return 6;
    if (key.startsWith('sections/') && key.endsWith('.json')) return 7; // section groups
    if (key.startsWith('templates/') && key.endsWith('.liquid')) return 8;
    if (key.startsWith('templates/')) return 9;
    if (key === 'config/settings_data.json') return 10;
    if (key.startsWith('config/')) return 11;
    return 99;
  }

  const copyKeys = allAssets
    .filter(a => /^(config|sections|templates|snippets|layout|locales)\//.test(a.key) && /\.(json|liquid)$/.test(a.key))
    .map(a => a.key)
    .sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));

  console.log(`  ${copyKeys.length} assets pra copiar (snippets → sections → layout → templates → locales → config)`);
  if (!apply) return { copied: 0, fails: 0, total: copyKeys.length, dry_run: true, theme_id: dstTheme.id };

  // Replace handles com sufixo -1 do template (main-menu-1 → main-menu etc)
  const HANDLE_REPLACEMENTS = [
    ['main-menu-1', 'main-menu'],
    ['footer-1', 'footer'],
    ['customer-account-main-menu-1', 'customer-account-main-menu'],
  ];
  const FILES_TO_FIX = new Set(['sections/header-group.json', 'sections/footer-group.json', 'config/settings_data.json']);

  let copied = 0, fails = 0;
  const failedKeys = [];

  for (let i = 0; i < copyKeys.length; i++) {
    const key = copyKeys[i];
    try {
      const src1 = await shReq(src.shopify_domain, src.shopify_access_token, 'GET',
        `/admin/api/${API_VERSION}/themes/${srcTheme.id}/assets.json?asset[key]=${encodeURIComponent(key)}`);
      let value = src1.body?.asset?.value;
      if (!value) continue;
      // Fix handles nos arquivos conhecidos
      if (FILES_TO_FIX.has(key)) {
        for (const [from, to] of HANDLE_REPLACEMENTS) {
          if (value.includes(from)) value = value.split(from).join(to);
        }
      }
      const r = await shReq(dst.shopify_domain, dst.shopify_access_token, 'PUT',
        `/admin/api/${API_VERSION}/themes/${dstTheme.id}/assets.json`,
        { asset: { key, value } });
      if (r.status < 300) copied++;
      else {
        fails++;
        const errMsg = JSON.stringify(r.body?.errors || r.body).slice(0, 200);
        failedKeys.push({ key, status: r.status, error: errMsg });
        console.warn(`    ✗ "${key}" status=${r.status} ${errMsg}`);
      }
    } catch (e) {
      fails++;
      failedKeys.push({ key, error: e.message });
      console.warn(`    ✗ "${key}" ${e.message}`);
    }
    if ((i + 1) % 20 === 0) console.log(`    ...${i + 1}/${copyKeys.length} (ok=${copied} fail=${fails})`);
    await delay(500);
  }

  console.log(`  ✓ copiados: ${copied} | ${fails} fails`);
  if (opts.newTheme) console.log(`\n  ℹ Novo tema (unpublished) id=${dstTheme.id}. Publique pela UI em Online Store > Themes.`);
  return { copied, fails, total: copyKeys.length, theme_id: dstTheme.id, failed_keys: failedKeys.slice(0, 20) };
}

// ─── STEP 5: PRODUCTS (via bulk-deploy-products) ────────────────────────
async function cloneProducts(src, dst, apply) {
  console.log(`\n[products] invocando bulk-deploy-products...`);
  const applyFlag = apply ? '--apply' : '';
  const cmd = `node ".claude/skills/bulk-deploy-products/bulk-deploy-products.mjs" "${dst.name}" ${applyFlag} --source-id=${src.id}`;
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: PROJECT_ROOT, maxBuffer: 40 * 1024 * 1024, timeout: 25 * 60 * 1000,
    });
    const ms = Date.now() - start;
    const createdMatch = stdout.match(/Criados:\s+(\d+)/);
    const errorsMatch = stdout.match(/Erros:\s+(\d+)/);
    console.log(`  ✓ bulk concluído (${(ms / 1000).toFixed(1)}s)`);
    return { ms, created: createdMatch ? +createdMatch[1] : 0, errors: errorsMatch ? +errorsMatch[1] : 0 };
  } catch (e) {
    console.warn(`  ✗ bulk-deploy-products falhou: ${e.message?.slice(0, 200)}`);
    return { ms: Date.now() - start, error: e.message };
  }
}

// ─── STEP 6: POLISH (via deploy-complete --skip-edge) ───────────────────
async function runPolish(dst, sourceName, vendor, apply) {
  if (!apply) {
    console.log(`\n[polish] (dry-run) invocaria deploy-complete --skip-edge`);
    return { dry_run: true };
  }
  console.log(`\n[polish] invocando deploy-complete --skip-edge --apply...`);
  const vFlag = vendor ? ` --vendor="${vendor}"` : '';
  const cmd = `node ".claude/skills/deploy-complete/deploy-complete.mjs" "${dst.name}" --source-client="${sourceName}"${vFlag} --skip-edge --apply`;
  const start = Date.now();
  try {
    const { stdout } = await execAsync(cmd, {
      cwd: PROJECT_ROOT, maxBuffer: 40 * 1024 * 1024, timeout: 25 * 60 * 1000,
    });
    const ms = Date.now() - start;
    const scoreMatch = stdout.match(/Score final:\s+(\d+)/);
    console.log(`  ✓ polish concluído (${(ms / 1000).toFixed(1)}s), score=${scoreMatch?.[1] || '?'}`);
    return { ms, score: scoreMatch ? +scoreMatch[1] : null };
  } catch (e) {
    console.warn(`  ✗ polish falhou: ${e.message?.slice(0, 200)}`);
    return { ms: Date.now() - start, error: e.message };
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();
  if (!args.source || !args.target) {
    console.error('Uso: node clone-store.mjs --source="<origem>" --target="<destino>" [--apply] [--skip=...] [--only=...]');
    process.exit(1);
  }

  const [src, dst] = await Promise.all([fetchClient(args.source), fetchClient(args.target)]);
  const steps = args.only ? [args.only] : ALL_STEPS.filter(s => !args.skip.includes(s));

  console.log(`\n=== clone-store ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);
  console.log(`source: ${src.name} (${src.shopify_domain})`);
  console.log(`target: ${dst.name} (${dst.shopify_domain})`);
  console.log(`steps:  ${steps.join(' → ')}`);

  const report = {
    source: src.name, target: dst.name, apply: args.apply,
    start: new Date().toISOString(),
    steps: {},
  };
  const allStart = Date.now();

  for (const step of steps) {
    const t0 = Date.now();
    try {
      if (step === 'collections') report.steps.collections = await cloneCollections(src, dst, args.apply);
      else if (step === 'pages') report.steps.pages = await clonePages(src, dst, args.apply);
      else if (step === 'menus') report.steps.menus = await cloneMenus(src, dst, args.apply);
      else if (step === 'theme') report.steps.theme = await cloneTheme(src, dst, args.apply, { newTheme: args.newTheme, themeName: args.themeName, targetTheme: args.targetTheme });
      else if (step === 'products') report.steps.products = await cloneProducts(src, dst, args.apply);
      else if (step === 'polish') report.steps.polish = await runPolish(dst, src.name, args.vendor || dst.name, args.apply);
      report.steps[step].ms = Date.now() - t0;
    } catch (e) {
      console.error(`\n✗ Erro no step "${step}":`, e.message);
      report.steps[step] = { error: e.message, ms: Date.now() - t0 };
    }
  }

  report.end = new Date().toISOString();
  report.elapsed_seconds = Math.round((Date.now() - allStart) / 1000);

  console.log(`\n=== RELATÓRIO ===`);
  console.log(`Tempo total: ${report.elapsed_seconds}s (${(report.elapsed_seconds / 60).toFixed(1)} min)\n`);
  for (const [step, r] of Object.entries(report.steps)) {
    const sec = (r.ms / 1000).toFixed(1);
    console.log(`  ${step.padEnd(12)} ${sec}s`, r.error ? `✗ ${r.error.slice(0, 80)}` : '');
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const reportPath = path.join(os.tmpdir(), `clone-store-${dst.shopify_domain.replace('.myshopify.com', '')}-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Relatório: ${reportPath}`);
}

main().catch(e => { console.error('\n❌ FATAL:', e.message, e.stack); process.exit(1); });

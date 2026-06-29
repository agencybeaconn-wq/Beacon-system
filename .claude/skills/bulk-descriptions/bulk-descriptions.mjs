#!/usr/bin/env node
// bulk-descriptions — altera body_html de produtos em massa via bulk operation.
//
// Modos:
//   --find=X --replace=Y        Find/replace simples em body_html
//   --append="<p>...</p>"        Adiciona no fim
//   --prepend="<p>...</p>"       Adiciona no início
//   --set="<html>"               Sobrescreve body_html inteiro com o HTML dado (mesmo em todos)
//   --template                   Aplica templates/<lang>-<category>.md por categoria
//
// Filtros opcionais:
//   --category=camisa_torcedor   Só aplica em produtos dessa categoria
//   --only-empty                 Só aplica em produtos com body_html vazio
//   --lang=br|en                 Força idioma (default: detecta pelo cliente)
//
// Uso:
//   node bulk-descriptions.mjs <cliente>                                            # DRY-RUN
//   node bulk-descriptions.mjs <cliente> --find="oficial" --replace="autêntica" --apply
//   node bulk-descriptions.mjs <cliente> --template --apply
//   node bulk-descriptions.mjs <cliente> --append="<p>Frete grátis</p>" --apply

import { shReq, shopifyGraphQL, nextPageUrl, delay, API_VERSION } from '../../lib/shopify-api.mjs';
import { runBulkMutation } from '../../lib/shopify-bulk.mjs';
import { fetchBriefing } from '../../lib/supabase-rest.mjs';
import { assertClientExists, assertShopifyConnected, appendExecutionLog } from '../../lib/validate.mjs';
import { printEstimate, abortIfTooLarge, parseCostFlags } from '../../lib/cost-estimate.mjs';
import { categorize } from '../../lib/shopify-pricing.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');

function parseArgs() {
  const args = {
    _: [], apply: false,
    find: null, replace: null,
    append: null, prepend: null,
    set: null, setFile: null,
    template: false,
    category: null,
    onlyEmpty: false,
    lang: null,
    titleContains: null,
  };
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--template') args.template = true;
    else if (a === '--only-empty') args.onlyEmpty = true;
    else if (a.startsWith('--find=')) args.find = a.slice(7);
    else if (a.startsWith('--replace=')) args.replace = a.slice(10);
    else if (a.startsWith('--append=')) args.append = a.slice(9);
    else if (a.startsWith('--prepend=')) args.prepend = a.slice(10);
    else if (a.startsWith('--set=')) args.set = a.slice(6);
    else if (a.startsWith('--set-file=')) args.setFile = a.slice(11);
    else if (a.startsWith('--category=')) args.category = a.slice(11);
    else if (a.startsWith('--lang=')) args.lang = a.slice(7);
    else if (a.startsWith('--title-contains=')) args.titleContains = a.slice(17).toLowerCase();
    else args._.push(a);
  }
  // --set-file lê HTML de um arquivo (pra não ter que escapar aspas no shell)
  if (args.setFile) {
    try {
      args.set = fs.readFileSync(args.setFile, 'utf8');
    } catch (e) {
      console.error(`❌ --set-file="${args.setFile}" não pôde ser lido: ${e.message}`);
      process.exit(1);
    }
  }
  // Validação de modos
  const modes = [
    args.find != null || args.replace != null,
    args.append != null,
    args.prepend != null,
    args.set != null,
    args.template,
  ].filter(Boolean);
  if (modes.length === 0) {
    console.error('❌ Escolha um modo: --find/--replace, --append, --prepend, --set, --set-file, ou --template');
    process.exit(1);
  }
  if ((args.find != null) !== (args.replace != null)) {
    console.error('❌ --find e --replace devem ser usados juntos');
    process.exit(1);
  }
  // Regra Lever: ZERO emojis em descrições (feedback_no_emojis_use_icons).
  // Validar todo input HTML que vai pro body_html.
  const emojiCheckFields = { append: args.append, prepend: args.prepend, set: args.set, replace: args.replace };
  for (const [field, val] of Object.entries(emojiCheckFields)) {
    if (val && containsEmoji(val)) {
      console.error(`❌ --${field} contém emoji. Regra Lever: nunca emojis em descrições, usar SVG via {% render 'icon-*' %}.`);
      console.error(`   Encontrados: ${listEmojis(val).join(' ')}`);
      process.exit(1);
    }
  }
  return args;
}

// Range Unicode pra emoji (cobre maioria — Misc Symbols, Pictographs, Transport, Flags, Supplemental)
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F2FF}]/u;

function containsEmoji(str) {
  return EMOJI_RE.test(str);
}

function listEmojis(str) {
  const re = new RegExp(EMOJI_RE.source, 'gu');
  return [...new Set(str.match(re) || [])];
}

function detectLang(client) {
  const name = (client.name || '').toLowerCase();
  const dom = (client.shopify_domain || '').toLowerCase();
  if (/\b(br|brasil|brazilian|brasileir)\b/i.test(name)) return 'br';
  if (dom.endsWith('.com.br') || dom.endsWith('.br')) return 'br';
  if (/\b(en|english|international|global)\b/i.test(name)) return 'en';
  if (dom.includes('-en.') || dom.endsWith('.en')) return 'en';
  return 'br';
}

/**
 * Markdown → HTML simples (headers, bold, italic, links, listas).
 */
function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false, inParagraph = false;
  const flushP = () => { if (inParagraph) { out.push('</p>'); inParagraph = false; } };
  const flushL = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = s => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#\s/.test(line)) { flushP(); flushL(); out.push(`<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`); }
    else if (/^##\s/.test(line)) { flushP(); flushL(); out.push(`<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`); }
    else if (/^###\s/.test(line)) { flushP(); flushL(); out.push(`<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`); }
    else if (/^[-*]\s/.test(line)) { flushP(); if (!inList) { out.push('<ul>'); inList = true; } out.push(`  <li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`); }
    else if (line === '') { flushP(); flushL(); }
    else { flushL(); if (!inParagraph) { out.push('<p>'); inParagraph = true; } out.push(inline(line)); }
  }
  flushP(); flushL();
  return out.join('\n');
}

function applyPlaceholders(content, data) {
  return content
    .replace(/\{\{product_title\}\}/g, data.product_title)
    .replace(/\{\{client_name\}\}/g, data.client_name)
    .replace(/\{\{support_email\}\}/g, data.support_email)
    .replace(/\{\{support_phone\}\}/g, data.support_phone)
    .replace(/\{\{shipping_min_value\}\}/g, data.shipping_min_value)
    .replace(/\{\{business_hours\}\}/g, data.business_hours || '');
}

function loadTemplate(lang, category) {
  const p = path.join(TEMPLATES_DIR, `${lang}-${category}.md`);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

async function fetchAllProducts(shop, token) {
  const all = [];
  let p = `/admin/api/${API_VERSION}/products.json?limit=250&fields=id,handle,title,body_html`;
  while (p) {
    const r = await shReq(shop, token, 'GET', p);
    if (r.status !== 200) throw new Error(`Shopify ${r.status}`);
    all.push(...(r.body?.products || []));
    p = nextPageUrl(r.link);
    if (p) await delay(400);
  }
  return all;
}

const PRODUCT_UPDATE_MUT = `mutation call($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id }
    userErrors { field message }
  }
}`;

function computeNewDescription(product, args, clientData) {
  const current = product.body_html || '';

  if (args.set != null) {
    return args.set;
  }
  if (args.find != null) {
    if (!current.includes(args.find)) return null; // nada pra trocar
    return current.split(args.find).join(args.replace);
  }
  if (args.append != null) {
    return current + args.append;
  }
  if (args.prepend != null) {
    return args.prepend + current;
  }
  if (args.set != null) {
    if (current === args.set) return null; // já igual — nada a fazer
    return args.set;
  }
  if (args.template) {
    const cat = categorize(product.title);
    if (!cat) return null;
    if (args.category && cat !== args.category) return null;
    const lang = clientData.lang;
    const tpl = loadTemplate(lang, cat);
    if (!tpl) return null; // categoria sem template
    const html = markdownToHtml(applyPlaceholders(tpl, {
      ...clientData,
      product_title: product.title,
    }));
    return html;
  }
  return null;
}

async function main() {
  const args = parseArgs();
  const clientArg = args._[0];
  if (!clientArg) {
    console.error('Uso: node bulk-descriptions.mjs <cliente> [--apply] (--find=X --replace=Y | --append=X | --prepend=X | --template) [--category=X] [--only-empty] [--lang=br|en]');
    process.exit(1);
  }

  console.log(`\n=== bulk-descriptions ${args.apply ? '[APPLY]' : '[DRY-RUN]'} ===`);

  const client = await assertClientExists(clientArg);
  await assertShopifyConnected(client);
  const lang = args.lang || detectLang(client);
  console.log(`✓ Cliente: ${client.name} (${client.shopify_domain})`);
  console.log(`✓ Idioma: ${lang.toUpperCase()}`);

  // Briefing pra placeholders
  let briefing = null;
  try { briefing = await fetchBriefing(client.id); } catch { /* ignore */ }
  const clientData = {
    lang,
    client_name: client.name,
    support_email: briefing?.email || 'contato@loja.com.br',
    support_phone: briefing?.telefone || '+55 (11) 99999-9999',
    shipping_min_value: briefing?.frete_gratis_valor ? String(briefing.frete_gratis_valor) : (lang === 'en' ? '29' : '129,00'),
    business_hours: briefing?.horario_atendimento || 'Seg a Sex: 09h às 18h',
  };

  // Modo que vai rodar
  let mode;
  if (args.find != null) mode = `find="${args.find}" replace="${args.replace}"`;
  else if (args.append) mode = `append="${args.append.slice(0, 40)}..."`;
  else if (args.prepend) mode = `prepend="${args.prepend.slice(0, 40)}..."`;
  else if (args.set != null) mode = `set="${args.set.slice(0, 60)}..." (sobrescreve body_html)`;
  else if (args.template) mode = `template (categoria ${args.category || 'TODAS'})`;
  console.log(`✓ Modo: ${mode}`);
  if (args.onlyEmpty) console.log(`✓ Filtro: só produtos com body_html vazio`);
  if (args.titleContains) console.log(`✓ Filtro: título contém "${args.titleContains}"`);

  // FETCH
  console.log(`\nBuscando produtos...`);
  const products = await fetchAllProducts(client.shopify_domain, client.shopify_access_token);
  console.log(`  ${products.length} produtos carregados`);

  // COMPUTE changes
  const changes = [];
  const catStats = {};
  let skipped = 0;
  for (const p of products) {
    const cat = categorize(p.title);
    if (args.category && cat !== args.category) { skipped++; continue; }
    if (args.titleContains && !p.title.toLowerCase().includes(args.titleContains)) { skipped++; continue; }
    if (args.onlyEmpty && (p.body_html || '').trim().length > 50) { skipped++; continue; }
    const newDesc = computeNewDescription(p, args, clientData);
    if (newDesc == null || newDesc === (p.body_html || '')) { skipped++; continue; }
    changes.push({ id: p.id, title: p.title, oldHtml: p.body_html || '', newHtml: newDesc, category: cat });
    catStats[cat || 'uncategorized'] = (catStats[cat || 'uncategorized'] || 0) + 1;
  }

  // PREVIEW
  console.log(`\n=== PREVIEW ===`);
  console.log(`Produtos a alterar: ${changes.length} / ${products.length}`);
  console.log(`Skipados: ${skipped}`);
  if (Object.keys(catStats).length) {
    console.log(`\nPor categoria:`);
    for (const [k, v] of Object.entries(catStats)) console.log(`  ${k}: ${v}`);
  }
  console.log(`\nAmostra (3 produtos):`);
  for (const c of changes.slice(0, 3)) {
    console.log(`\n  ${c.title}`);
    const oldPreview = c.oldHtml.replace(/\s+/g, ' ').slice(0, 120);
    const newPreview = c.newHtml.replace(/\s+/g, ' ').slice(0, 120);
    console.log(`    ANTES: ${oldPreview || '(vazio)'}`);
    console.log(`    DEPOIS: ${newPreview}`);
  }

  if (changes.length === 0) {
    console.log(`\n✓ Nenhuma mudança necessária.`);
    return;
  }

  // Estimate de custo (bulk op = 1-2 GraphQL calls, ~90s)
  printEstimate({ count: changes.length, opName: 'update body_html', bulkOp: true });

  // Circuit-breaker: se passou --expected=N e diff > 30%, aborta sem --force-large
  const cost = parseCostFlags(process.argv);
  if (abortIfTooLarge({ count: changes.length, expected: cost.expected, force: cost.forceLarge })) {
    process.exit(2);
  }

  if (!args.apply) {
    console.log(`\n[DRY-RUN] Rode com --apply pra alterar.`);
    return;
  }

  // EXECUTE via bulk op
  console.log(`\n=== EXECUTANDO [bulk op] ===`);
  const items = changes.map(c => ({
    input: { id: `gid://shopify/Product/${c.id}`, descriptionHtml: c.newHtml },
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
        pollOpts: { interval: 3000, timeout: 20 * 60 * 1000 },
      }
    );
    console.log(`\n  ✓ bulk op completed: ${res.op.id}`);
    console.log(`  objectCount=${res.op.objectCount}  fileSize=${res.op.fileSize}`);
    console.log(`\nResultado: ok=${res.ok} fail=${res.fail.length}`);
    if (res.fail.length) {
      console.log(`\nPrimeiros erros:`);
      res.fail.slice(0, 5).forEach(f => console.log(`  - ${JSON.stringify(f.errors).slice(0, 150)}`));
    }

    await appendExecutionLog({
      skill: 'bulk-descriptions',
      client_id: client.id,
      client_name: client.name,
      shop: client.shopify_domain,
      mode,
      affected: changes.length,
      ok: res.ok,
      fail: res.fail.length,
      dry_run: false,
    });
  } catch (e) {
    console.error(`\n❌ Bulk op falhou: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

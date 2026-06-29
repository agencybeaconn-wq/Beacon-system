#!/usr/bin/env node
// clone-discover — passo 3 do pipeline /clone-theme.
//
// Abre a URL alvo via Playwright headless, coleta links da home + 1 nível de profundidade,
// classifica em home/PDP/PLP/cart/page/blog/other e seleciona samples conforme scope.
//
// Salva themes/clones/<slug>/_raw/discovery.json e imprime preview pro humano.
//
// Uso:
//   node clone-discover.mjs <slug>

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Padrões de URL → tipo de página. Ordem importa (mais específico primeiro).
const URL_PATTERNS = [
  { type: 'pdp',        re: /\/products?\/[^/?#]+/i },
  { type: 'pdp',        re: /\/produto\/[^/?#]+/i },
  { type: 'plp',        re: /\/collections?\/[^/?#]+/i },
  { type: 'plp',        re: /\/categoria\/[^/?#]+/i },
  { type: 'plp',        re: /\/category\/[^/?#]+/i },
  { type: 'plp',        re: /\/shop(\/|$)/i },
  { type: 'plp',        re: /\/loja(\/|$)/i },
  { type: 'cart',       re: /\/(cart|carrinho|sacola|basket)(\/|$)/i },
  { type: 'blog',       re: /\/blog\/[^/?#]+/i },
  { type: 'blog',       re: /\/news\/[^/?#]+/i },
  { type: 'blog',       re: /\/artigos?\/[^/?#]+/i },
  { type: 'page-sobre', re: /\/(about|sobre|quem-somos)(\/|$)/i },
  { type: 'page-contato', re: /\/(contact|contato|atendimento|fale-conosco)(\/|$)/i },
  { type: 'page-faq',   re: /\/(faq|perguntas|duvidas?)(\/|$)/i },
  { type: 'page-trocas', re: /\/(trocas|returns?|exchanges?|devolu[cç][aã]o)(\/|$)/i },
  { type: 'page-envios', re: /\/(envios?|shipping|delivery|frete|entrega)(\/|$)/i },
  { type: 'page-privacidade', re: /\/(privacy|privacidade|termos|terms)(\/|$)/i },
  { type: 'page',       re: /\/pages?\/[^/?#]+/i },
  { type: 'page',       re: /\/page\/[^/?#]+/i },
];

function classifyUrl(url, baseHost) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.hostname !== baseHost) return null;
  if (u.pathname === '/' || u.pathname === '') return { type: 'home', url: u.href };
  for (const { type, re } of URL_PATTERNS) {
    if (re.test(u.pathname)) return { type, url: u.href };
  }
  return { type: 'other', url: u.href };
}

function pickSamples(classified, scope) {
  const byType = classified.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  const limits = scope === 'full'
    ? { home: 1, pdp: 2, plp: 2, cart: 1, blog: 1, 'page-sobre': 1, 'page-contato': 1, 'page-faq': 1, 'page-trocas': 1, 'page-envios': 1, 'page-privacidade': 1, page: 2 }
    : { home: 1, pdp: 1, plp: 1, cart: 1, blog: 0, 'page-sobre': 1, 'page-contato': 1, 'page-faq': 1, 'page-trocas': 0, 'page-envios': 0, 'page-privacidade': 0, page: 1 };

  const picked = [];
  for (const type of Object.keys(limits)) {
    const items = byType[type] || [];
    picked.push(...items.slice(0, limits[type]));
  }
  return picked;
}

async function collectLinks(page) {
  return await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const seen = new Set();
    const out = [];
    for (const a of anchors) {
      let href;
      try { href = a.href; } catch { continue; }
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      const clean = href.split('#')[0];
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push(clean);
    }
    return out;
  });
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Uso: node clone-discover.mjs <slug>');
    process.exit(1);
  }

  console.log('\n=== clone-discover ===');

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}. Rode clone-validate.mjs antes.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const scope = meta.opts?.scope || 'full';

  console.log(`  URL alvo: ${meta.url}`);
  console.log(`  Escopo:   ${scope}`);

  const rawDir = path.join(workspace, '_raw');
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });

  // Discovery — abre home, coleta links, depois visita até 3 links de cada tipo "primário" pra achar mais URLs
  console.log(`\n  [Playwright] launch chromium...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`  [home] goto ${meta.url}`);
  await page.goto(meta.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Aguarda um pouco pra carregar JS, mas não networkidle (pode pendurar)
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const baseHost = new URL(meta.url).hostname;
  const homeLinks = await collectLinks(page);
  console.log(`  [home] ${homeLinks.length} links coletados`);

  // Classifica links da home
  let classified = [];
  classified.push({ type: 'home', url: meta.url });
  for (const link of homeLinks) {
    const c = classifyUrl(link, baseHost);
    if (c) classified.push(c);
  }

  // Dedupe
  const seen = new Set();
  classified = classified.filter(c => {
    const key = `${c.type}|${c.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Conta por tipo
  const counts = classified.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {});
  console.log(`  [classify]`, JSON.stringify(counts));

  // Se PDP ou PLP estão vazios, visita 1 link da nav pra tentar achar (1 nível mais fundo)
  const needSubcrawl = !counts.pdp || !counts.plp;
  if (needSubcrawl) {
    // Heurística: visita o primeiro link "plp" ou qualquer link da mesma origem que não foi classificado
    const probe = classified.find(c => c.type === 'plp')?.url
      || classified.find(c => c.type === 'other')?.url;
    if (probe) {
      try {
        console.log(`  [subcrawl] probe ${probe}`);
        await page.goto(probe, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const probeLinks = await collectLinks(page);
        for (const link of probeLinks) {
          const c = classifyUrl(link, baseHost);
          if (c) classified.push(c);
        }
        // re-dedupe
        const seen2 = new Set();
        classified = classified.filter(c => {
          const key = `${c.type}|${c.url}`;
          if (seen2.has(key)) return false;
          seen2.add(key);
          return true;
        });
        const counts2 = classified.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc; }, {});
        console.log(`  [subcrawl] após probe:`, JSON.stringify(counts2));
      } catch (e) {
        console.log(`  [subcrawl] falhou: ${e.message}`);
      }
    }
  }

  await browser.close();

  // Pick samples
  const picked = pickSamples(classified, scope);
  console.log(`\n  Picked ${picked.length} páginas pra scrape:`);
  for (const p of picked) console.log(`    - [${p.type.padEnd(18)}] ${p.url}`);

  // Salva discovery.json
  const discovery = {
    url: meta.url,
    base_host: baseHost,
    scope,
    discovered_at: new Date().toISOString(),
    total_classified: classified.length,
    counts,
    picked,
    all_classified: classified,
  };
  fs.writeFileSync(path.join(rawDir, 'discovery.json'), JSON.stringify(discovery, null, 2), 'utf8');

  meta.phase = 'discovered';
  meta.updated_at = new Date().toISOString();
  meta.discovery_stats = { total: classified.length, picked: picked.length, counts };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`\n✓ Discovery salvo em _raw/discovery.json`);
  console.log(`\nPróximo: node .claude/skills/clone-theme/clone-scrape.mjs ${slug}\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

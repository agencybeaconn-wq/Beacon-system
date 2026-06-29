#!/usr/bin/env node
// clone-scrape — passo 4-5 do pipeline /clone-theme.
//
// Para cada URL picked em _raw/discovery.json:
//   - Playwright headless: HTML pós-render + screenshot full-page
//   - Coleta CSS de todas as stylesheets (inline + linked via fetch)
//   - Lista assets externos (imagens, fontes, ícones)
//
// Idempotência: se _raw/<slug-tipo>/ existe e mtime < 24h, pula.
//
// Uso:
//   node clone-scrape.mjs <slug> [--force]

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const STALE_MS = 24 * 60 * 60 * 1000;

function parseArgs() {
  const args = { slug: null, force: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--force') args.force = true;
    else if (!a.startsWith('--')) args.slug = a;
  }
  return args;
}

function fetchText(url, timeout = 15000) {
  return new Promise((resolve) => {
    let mod;
    try {
      const u = new URL(url);
      mod = u.protocol === 'http:' ? http : https;
    } catch { return resolve(null); }
    const req = mod.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/css,*/*;q=0.1' }, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(new URL(res.headers.location, url).href, timeout));
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function pageSlug(picked) {
  // home → 'home', pdp → 'product-<host-path-tail>', etc.
  if (picked.type === 'home') return 'home';
  let tail;
  try {
    const u = new URL(picked.url);
    tail = u.pathname.split('/').filter(Boolean).slice(-2).join('-') || 'root';
  } catch {
    tail = 'unknown';
  }
  return `${picked.type}__${tail}`.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80);
}

async function scrapePage(browser, picked, outDir) {
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Captura URLs de assets carregados durante a navegação
  const assetUrls = new Set();
  page.on('response', (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.startsWith('image/') || ct.includes('font') || url.match(/\.(woff2?|ttf|otf|eot|jpg|jpeg|png|webp|svg|gif|ico)(\?|$)/i)) {
      assetUrls.add(url);
    }
  });

  console.log(`    goto ${picked.url}`);
  await page.goto(picked.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // HTML
  const html = await page.content();
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

  // Screenshot full-page
  await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });

  // CSS: coleta inline + URLs externos (separadamente; CORS bloqueia alguns)
  const cssInfo = await page.evaluate(() => {
    const sheets = [];
    const externalUrls = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      let cssText = '';
      let blocked = false;
      try {
        const rules = Array.from(sheet.cssRules || []);
        cssText = rules.map(r => r.cssText).join('\n');
      } catch {
        blocked = true;
      }
      if (sheet.href) externalUrls.push(sheet.href);
      sheets.push({ href: sheet.href || null, cssText, blocked });
    }
    return { sheets, externalUrls };
  });

  // Pra cada sheet bloqueado por CORS, tenta fetch direto (mesmo origin)
  for (const sheet of cssInfo.sheets) {
    if (sheet.blocked && sheet.href) {
      const css = await fetchText(sheet.href);
      if (css) sheet.cssText = css;
    }
  }

  // Junta tudo num único page.css
  const combined = cssInfo.sheets
    .map((s, i) => `/* ===== sheet ${i} ${s.href || '(inline)'} ${s.blocked ? '(was blocked, fetched manually)' : ''} ===== */\n${s.cssText}`)
    .join('\n\n');
  fs.writeFileSync(path.join(outDir, 'page.css'), combined, 'utf8');

  // assets.json
  const assets = {
    captured_at: new Date().toISOString(),
    sheet_urls: cssInfo.externalUrls,
    asset_urls: Array.from(assetUrls).sort(),
    counts: {
      sheets: cssInfo.sheets.length,
      sheets_blocked_initially: cssInfo.sheets.filter(s => s.blocked).length,
      assets: assetUrls.size,
    },
  };
  fs.writeFileSync(path.join(outDir, 'assets.json'), JSON.stringify(assets, null, 2), 'utf8');

  await context.close();

  return {
    html_bytes: html.length,
    css_bytes: combined.length,
    sheets: cssInfo.sheets.length,
    assets_count: assetUrls.size,
  };
}

async function main() {
  const args = parseArgs();
  if (!args.slug) {
    console.error('Uso: node clone-scrape.mjs <slug> [--force]');
    process.exit(1);
  }

  console.log('\n=== clone-scrape ===');

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  const discoveryPath = path.join(workspace, '_raw', 'discovery.json');
  if (!fs.existsSync(discoveryPath)) {
    console.error(`Não achei ${discoveryPath}. Rode clone-discover.mjs antes.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const discovery = JSON.parse(fs.readFileSync(discoveryPath, 'utf8'));

  const picked = discovery.picked;
  console.log(`  ${picked.length} páginas a processar`);

  const browser = await chromium.launch({ headless: true });
  let scraped = 0, skipped = 0, failed = 0;
  const results = [];

  for (let i = 0; i < picked.length; i++) {
    const p = picked[i];
    const dirName = pageSlug(p);
    const outDir = path.join(workspace, '_raw', dirName);

    // Idempotência: pula se já tem html recente
    const htmlPath = path.join(outDir, 'index.html');
    if (!args.force && fs.existsSync(htmlPath)) {
      const age = Date.now() - fs.statSync(htmlPath).mtimeMs;
      if (age < STALE_MS) {
        console.log(`  [${i + 1}/${picked.length}] SKIP ${dirName} (cache ${Math.round(age / 60000)}min)`);
        skipped++;
        continue;
      }
    }

    fs.mkdirSync(outDir, { recursive: true });
    console.log(`  [${i + 1}/${picked.length}] ${p.type.padEnd(18)} → ${dirName}`);

    try {
      const r = await scrapePage(browser, p, outDir);
      results.push({ ...p, dirName, ...r });
      scraped++;
      console.log(`     ✓ html=${(r.html_bytes / 1024).toFixed(1)}kb css=${(r.css_bytes / 1024).toFixed(1)}kb sheets=${r.sheets} assets=${r.assets_count}`);
    } catch (e) {
      failed++;
      console.log(`     ✗ FALHA: ${e.message}`);
      results.push({ ...p, dirName, error: e.message });
    }
  }

  await browser.close();

  // Update meta
  meta.phase = 'scraped';
  meta.updated_at = new Date().toISOString();
  meta.scrape_stats = { scraped, skipped, failed, total: picked.length };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(workspace, '_raw', 'scrape-results.json'),
    JSON.stringify({ results, stats: meta.scrape_stats }, null, 2),
    'utf8'
  );

  console.log(`\n✓ Scrape concluído: ${scraped} novas, ${skipped} cache, ${failed} falhas`);
  console.log(`\nPróximo: node .claude/skills/clone-theme/clone-tokens.mjs ${args.slug}\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

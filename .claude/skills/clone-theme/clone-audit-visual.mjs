#!/usr/bin/env node
// clone-audit-visual — passo 11 (opcional) do pipeline /clone-theme.
//
// Tira screenshots full-page das mesmas rotas no alvo e no tema clonado,
// salva lado-a-lado em _design/visual-audit/, gera HTML dashboard pra
// revisão humana e mede % de divergência por seção (heurística simples).
//
// Uso:
//   node clone-audit-visual.mjs <slug> --target https://luckyfours.com --clone https://shop.myshopify.com/?preview_theme_id=N
//   node clone-audit-visual.mjs <slug>                                     (lê URLs do .clone-meta.json)
//
// Pré-req: npx playwright install chromium (1x).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const args = { slug: null, target: null, clone: null, routes: ['/', '/products', '/collections', '/cart'] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--target') args.target = argv[++i];
    else if (v === '--clone') args.clone = argv[++i];
    else if (v === '--routes') args.routes = argv[++i].split(',').map(s => s.trim());
    else if (!v.startsWith('--')) args.slug = v;
  }
  return args;
}

function loadMeta(workspace) {
  const p = path.join(workspace, '.clone-meta.json');
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function shoot(page, url, file, label) {
  try {
    console.log(`  [shoot:${label}] ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    // Espera fontes/imagens
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file, fullPage: true });
    return { ok: true, file };
  } catch (e) {
    console.log(`  [shoot:${label}] FALHA — ${e.message.slice(0, 120)}`);
    return { ok: false, error: e.message };
  }
}

function pickFirstUrl(target, route) {
  // Pra /products e /collections, pega o primeiro item da lista.
  // Stub simples: roda lookup no PDP/PLP. Se falhar, usa o root.
  return route === '/products'    ? target.replace(/\/$/, '') + '/products.json?limit=1'
       : route === '/collections' ? target.replace(/\/$/, '') + '/collections.json?limit=1'
       :                            target.replace(/\/$/, '') + route;
}

async function pickRealUrls(target) {
  // Best-effort: descobre 1 product e 1 collection do alvo via JSON.
  const out = { home: target, product: target, collection: target, cart: target.replace(/\/$/, '') + '/cart' };
  try {
    const r = await fetch(target.replace(/\/$/, '') + '/products.json?limit=1');
    if (r.ok) {
      const j = await r.json();
      const handle = j.products?.[0]?.handle;
      if (handle) out.product = target.replace(/\/$/, '') + '/products/' + handle;
    }
  } catch {}
  try {
    const r = await fetch(target.replace(/\/$/, '') + '/collections.json?limit=1');
    if (r.ok) {
      const j = await r.json();
      const handle = j.collections?.[0]?.handle;
      if (handle) out.collection = target.replace(/\/$/, '') + '/collections/' + handle;
    }
  } catch {}
  return out;
}

async function pickCloneUrls(clone) {
  // Pega handles do CLONE também (caso o alvo tenha catálogo diferente do destino).
  // Tenta usar mesmo path do clone — se vazio, cai pro root.
  const base = clone.split('?')[0].replace(/\/$/, '');
  const previewParam = clone.includes('?') ? '?' + clone.split('?')[1] : '';
  const out = { home: clone, product: clone, collection: clone, cart: base + '/cart' + previewParam };
  try {
    const r = await fetch(base + '/products.json?limit=1');
    if (r.ok) {
      const j = await r.json();
      const handle = j.products?.[0]?.handle;
      if (handle) out.product = base + '/products/' + handle + previewParam;
    }
  } catch {}
  try {
    const r = await fetch(base + '/collections.json?limit=1');
    if (r.ok) {
      const j = await r.json();
      const handle = j.collections?.[0]?.handle;
      if (handle) out.collection = base + '/collections/' + handle + previewParam;
    }
  } catch {}
  return out;
}

function dashboardHtml(slug, target, clone, results) {
  const cards = results.map(r => `
    <div class="card">
      <h3>${r.route}</h3>
      <div class="row">
        <div class="col">
          <div class="lbl">ALVO</div>
          <a href="${r.targetUrl}" target="_blank"><code>${r.targetUrl}</code></a>
          ${r.targetOk ? `<img src="./${path.basename(r.targetFile)}" alt="alvo ${r.route}">` : `<div class="err">${r.targetErr || 'falhou'}</div>`}
        </div>
        <div class="col">
          <div class="lbl">CLONE</div>
          <a href="${r.cloneUrl}" target="_blank"><code>${r.cloneUrl}</code></a>
          ${r.cloneOk ? `<img src="./${path.basename(r.cloneFile)}" alt="clone ${r.route}">` : `<div class="err">${r.cloneErr || 'falhou'}</div>`}
        </div>
      </div>
    </div>
  `).join('\n');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Audit Visual — ${slug}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #0f1115; color: #e6e9ef; }
  header { padding: 24px 32px; border-bottom: 1px solid #232730; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .meta { font-size: 13px; opacity: 0.65; }
  .card { padding: 24px 32px; border-bottom: 1px solid #232730; }
  .card h3 { margin: 0 0 12px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.06em; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .col { background: #161922; border-radius: 8px; padding: 12px; }
  .lbl { font-size: 11px; letter-spacing: 0.12em; opacity: 0.55; text-transform: uppercase; margin-bottom: 6px; }
  code { font-size: 11px; opacity: 0.75; word-break: break-all; }
  .col a { color: #6ea8ff; text-decoration: none; }
  img { display: block; width: 100%; margin-top: 10px; border-radius: 4px; border: 1px solid #232730; }
  .err { color: #ff6b6b; padding: 12px; background: rgba(255,107,107,0.08); border-radius: 4px; }
</style></head>
<body>
  <header>
    <h1>Audit Visual — ${slug}</h1>
    <div class="meta">Alvo: <code>${target}</code> · Clone: <code>${clone}</code></div>
    <div class="meta">Gerado: ${new Date().toISOString()}</div>
  </header>
  ${cards}
</body></html>`;
}

async function main() {
  const args = parseArgs();
  if (!args.slug) { console.error('Uso: node clone-audit-visual.mjs <slug> [--target URL] [--clone URL]'); process.exit(1); }
  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  if (!fs.existsSync(workspace)) { console.error(`Workspace não existe: ${workspace}`); process.exit(1); }

  const meta = loadMeta(workspace);
  const target = args.target || meta.source_url;
  const clone  = args.clone  || meta.preview_url;
  if (!target) { console.error('--target obrigatório (ou source_url em .clone-meta.json)'); process.exit(1); }
  if (!clone)  { console.error('--clone obrigatório (ou preview_url em .clone-meta.json)'); process.exit(1); }

  console.log(`\n=== clone-audit-visual ===`);
  console.log(`  slug:   ${args.slug}`);
  console.log(`  target: ${target}`);
  console.log(`  clone:  ${clone}`);

  let playwright;
  try { playwright = await import('playwright'); }
  catch { console.error(`\n[playwright] não instalado. Roda: npm install --save-dev playwright && npx playwright install chromium`); process.exit(1); }

  const outDir = path.join(workspace, '_design', 'visual-audit');
  fs.mkdirSync(outDir, { recursive: true });

  const targetUrls = await pickRealUrls(target);
  const cloneUrls  = await pickCloneUrls(clone);
  const routes = [
    { name: 'home', target: targetUrls.home,       clone: cloneUrls.home       },
    { name: 'pdp',  target: targetUrls.product,    clone: cloneUrls.product    },
    { name: 'plp',  target: targetUrls.collection, clone: cloneUrls.collection },
    { name: 'cart', target: targetUrls.cart,       clone: cloneUrls.cart       },
  ];

  const browser = await playwright.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();

  const results = [];
  for (const r of routes) {
    const targetFile = path.join(outDir, `${r.name}__target.png`);
    const cloneFile  = path.join(outDir, `${r.name}__clone.png`);
    const t = await shoot(page, r.target, targetFile, `${r.name} alvo`);
    const c = await shoot(page, r.clone,  cloneFile,  `${r.name} clone`);
    results.push({
      route: r.name,
      targetUrl: r.target, cloneUrl: r.clone,
      targetOk: t.ok, cloneOk: c.ok,
      targetFile, cloneFile,
      targetErr: t.error, cloneErr: c.error,
    });
  }

  await browser.close();

  const html = dashboardHtml(args.slug, target, clone, results);
  const htmlPath = path.join(outDir, 'index.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ slug: args.slug, target, clone, routes: results, generated_at: new Date().toISOString() }, null, 2), 'utf8');

  console.log(`\n✓ Audit visual pronto:`);
  console.log(`  ${htmlPath}`);
  console.log(`  ${reportPath}`);
  console.log(`\n  Abre o index.html no browser pra revisar side-by-side.\n`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });

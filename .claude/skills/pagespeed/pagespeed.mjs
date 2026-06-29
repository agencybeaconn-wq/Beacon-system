#!/usr/bin/env node
// pagespeed — analisa Core Web Vitals e gargalos via Google PageSpeed Insights API.
//
// Modos:
//   <cliente>                  Analisa loja única (fuzzy match no nome)
//   --top-recent=N             Top N lojas mais ativas (default 10)
//   --all                      Todas as lojas ativas
//
// Opções:
//   --pages=home,pdp,collection   Páginas a analisar (default: home)
//   --strategy=mobile|desktop|both (default: mobile)
//   --no-save                   Não salva JSON/MD local

import { shReq, API_VERSION } from '../../lib/shopify-api.mjs';
import { supaRest, fetchClient } from '../../lib/supabase-rest.mjs';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'out', 'pagespeed');

function loadEnv() {
  const env = {};
  try {
    fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    });
  } catch {}
  return env;
}
const ENV = loadEnv();

function parseArgs() {
  const args = { _: [], topRecent: null, all: false, pages: ['home'], strategy: 'mobile', save: true, parallel: 4, retryFailed: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--all') args.all = true;
    else if (a === '--no-save') args.save = false;
    else if (a === '--retry-failed') args.retryFailed = true;
    else if (a.startsWith('--top-recent=')) args.topRecent = parseInt(a.slice(13), 10);
    else if (a.startsWith('--pages=')) args.pages = a.slice(8).split(',').map(s => s.trim());
    else if (a.startsWith('--strategy=')) args.strategy = a.slice(11);
    else if (a.startsWith('--parallel=')) args.parallel = Math.max(1, parseInt(a.slice(11), 10));
    else args._.push(a);
  }
  return args;
}

// ---------- Lighthouse crash blacklist ----------
const BLACKLIST_FILE = path.join(OUT_DIR, '_lighthouse-blacklist.json');
function loadBlacklist() {
  try { return JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')); }
  catch { return {}; }
}
function saveBlacklist(bl) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(bl, null, 2));
}
function isBlacklisted(bl, clientId) {
  const e = bl[clientId];
  if (!e) return false;
  // expira em 7 dias - permite retry depois
  const age = Date.now() - new Date(e.lastFailAt).getTime();
  return e.consecutiveFails >= 2 && age < 7 * 24 * 3600 * 1000;
}
function recordFail(bl, clientId, reason) {
  const e = bl[clientId] || { consecutiveFails: 0 };
  e.consecutiveFails += 1;
  e.lastFailAt = new Date().toISOString();
  e.lastReason = reason;
  bl[clientId] = e;
}
function recordSuccess(bl, clientId) {
  if (bl[clientId]) delete bl[clientId];
}

// ---------- Parallel pool ----------
async function runWithPool(items, fn, poolSize) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: poolSize }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = await fn(items[idx], idx); }
      catch (e) { results[idx] = { error: e.message }; }
    }
  }));
  return results;
}

// ---------- PageSpeed Insights API ----------
function psiCall(url, strategy = 'mobile') {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ url, strategy });
    params.append('category', 'performance');
    params.append('category', 'accessibility');
    params.append('category', 'best-practices');
    params.append('category', 'seo');
    if (ENV.PAGESPEED_API_KEY) params.append('key', ENV.PAGESPEED_API_KEY);

    const req = https.request({
      hostname: 'www.googleapis.com',
      path: '/pagespeedonline/v5/runPagespeed?' + params.toString(),
      method: 'GET',
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body: { error: body.slice(0, 200) } }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(300000, () => { req.destroy(); reject(new Error('PSI timeout 300s')); });
    req.end();
  });
}

function extractScores(psi) {
  const r = psi.body?.lighthouseResult;
  if (!r) return null;
  const cat = r.categories || {};
  const audits = r.audits || {};
  const get = (id) => audits[id]?.numericValue ?? null;

  // Top diagnostics que falharam (score < 0.9 e tem savings)
  const oppKeys = [
    'unused-javascript', 'render-blocking-resources', 'unminified-javascript',
    'modern-image-formats', 'uses-optimized-images', 'efficient-animated-content',
    'uses-text-compression', 'uses-responsive-images', 'offscreen-images',
    'preload-lcp-image', 'unsized-images', 'lcp-lazy-loaded',
    'third-party-summary', 'font-display', 'duplicated-javascript',
    'video-poster', 'unused-css-rules', 'legacy-javascript',
  ];
  const issues = [];
  for (const k of oppKeys) {
    const a = audits[k];
    if (!a) continue;
    if (a.score === null || a.score < 0.9) {
      issues.push({
        id: k,
        title: a.title,
        score: a.score,
        savingsMs: a.details?.overallSavingsMs ?? null,
        savingsBytes: a.details?.overallSavingsBytes ?? null,
        displayValue: a.displayValue ?? null,
      });
    }
  }
  issues.sort((a, b) => (b.savingsMs ?? b.savingsBytes ?? 0) - (a.savingsMs ?? a.savingsBytes ?? 0));

  // LCP element
  const lcpEl = audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0] || {};
  const lcpElement = {
    snippet: lcpEl.node?.snippet?.slice(0, 200) || null,
    selector: lcpEl.node?.selector || null,
  };

  // Heavy network requests (>100KB or >500ms)
  const netItems = audits['network-requests']?.details?.items || [];
  const heavyRequests = netItems
    .filter(r => (r.transferSize || 0) > 100_000 || ((r.networkEndTime || 0) - (r.networkRequestTime || 0)) > 500)
    .map(r => ({
      url: r.url,
      kb: Math.round((r.transferSize || 0) / 1024),
      ms: Math.round((r.networkEndTime || 0) - (r.networkRequestTime || 0)),
      type: r.resourceType,
    }))
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 8);

  // Third-party impact
  const tpItems = audits['third-party-summary']?.details?.items || [];
  const thirdParties = tpItems
    .map(t => ({
      entity: t.entity,
      kb: Math.round((t.transferSize || 0) / 1024),
      blockingMs: Math.round(t.blockingTime || 0),
      mainThreadMs: Math.round(t.mainThreadTime || 0),
    }))
    .sort((a, b) => b.blockingMs - a.blockingMs)
    .slice(0, 6);

  // Image diagnostics
  const oversized = (audits['uses-optimized-images']?.details?.items || [])
    .map(i => ({ url: i.url, savingsKb: Math.round((i.wastedBytes || 0) / 1024) }))
    .filter(i => i.savingsKb > 0).slice(0, 5);
  const wrongFormat = (audits['modern-image-formats']?.details?.items || [])
    .map(i => ({ url: i.url, savingsKb: Math.round((i.wastedBytes || 0) / 1024) }))
    .filter(i => i.savingsKb > 0).slice(0, 5);

  return {
    performance: Math.round((cat.performance?.score ?? 0) * 100),
    accessibility: Math.round((cat.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cat['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cat.seo?.score ?? 0) * 100),
    metrics: {
      lcp_ms: Math.round(get('largest-contentful-paint') ?? 0),
      fcp_ms: Math.round(get('first-contentful-paint') ?? 0),
      tbt_ms: Math.round(get('total-blocking-time') ?? 0),
      cls: parseFloat((get('cumulative-layout-shift') ?? 0).toFixed(3)),
      speed_index_ms: Math.round(get('speed-index') ?? 0),
      tti_ms: Math.round(get('interactive') ?? 0),
    },
    lcpElement,
    heavyRequests,
    thirdParties,
    imageIssues: { oversized, wrongFormat },
    topIssues: issues.slice(0, 10),
  };
}

// ---------- Shopify helpers ----------
async function getShopInfo(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/shop.json`);
  return r.body?.shop;
}

async function getSamplePDP(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/products.json?limit=1&status=active&fields=handle,title`);
  return r.body?.products?.[0];
}

async function getSampleCollection(shop, token) {
  const r = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/custom_collections.json?limit=1&published_status=published&fields=handle,title`);
  if (r.body?.custom_collections?.[0]) return r.body.custom_collections[0];
  const r2 = await shReq(shop, token, 'GET', `/admin/api/${API_VERSION}/smart_collections.json?limit=1&published_status=published&fields=handle,title`);
  return r2.body?.smart_collections?.[0];
}

function buildBaseUrl(shopInfo) {
  const dom = shopInfo?.domain || shopInfo?.myshopify_domain;
  // Prefer primary_domain (usually `lojaXXXX.com.br`)
  return `https://${shopInfo?.primary_domain?.host || dom}`;
}

// ---------- Pick stores ----------
async function pickStores(args) {
  if (args._.length > 0) {
    const c = await fetchClient(args._[0]);
    if (!c) throw new Error(`Cliente não encontrado: ${args._[0]}`);
    return [{ id: c.id, name: c.name, shop: c.shopify_domain, token: c.shopify_access_token }];
  }
  // Top recent or all
  const tasks = await supaRest('GET', '/client_tasks?select=client_id,updated_at&order=updated_at.desc&limit=300', null, { serviceRole: true });
  const qruns = await supaRest('GET', '/client_quality_runs?select=client_id,created_at&order=created_at.desc&limit=200', null, { serviceRole: true });
  const score = {};
  for (const t of tasks) score[t.client_id] = (score[t.client_id] || 0) + 1;
  for (const q of qruns) score[q.client_id] = (score[q.client_id] || 0) + 2;

  const clients = await supaRest('GET',
    '/agency_clients?select=id,name,shopify_domain,shopify_access_token,is_archived,is_internal,shopify_status&is_archived=eq.false&shopify_status=eq.connected',
    null, { serviceRole: true });

  const ranked = clients
    .filter(c => !c.is_internal && c.shopify_access_token)
    .map(c => ({ id: c.id, name: c.name, shop: c.shopify_domain, token: c.shopify_access_token, score: score[c.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  if (args.all) return ranked;
  return ranked.slice(0, args.topRecent || 10);
}

// ---------- Run analysis ----------
async function analyzeStore(store, args) {
  const log = (msg) => console.log(`[${store.name}] ${msg}`);
  let shopInfo;
  try { shopInfo = await getShopInfo(store.shop, store.token); }
  catch (e) { log(`✗ shop info falhou: ${e.message}`); return { client: store, error: 'shop_info_failed' }; }
  if (!shopInfo) { log(`✗ shop info vazio (token quebrado?)`); return { client: store, error: 'shop_info_empty' }; }

  const baseUrl = buildBaseUrl(shopInfo);

  const urls = [];
  if (args.pages.includes('home')) urls.push({ type: 'home', url: baseUrl });
  if (args.pages.includes('pdp')) {
    const p = await getSamplePDP(store.shop, store.token);
    if (p) urls.push({ type: 'pdp', url: `${baseUrl}/products/${p.handle}`, ref: p.title });
  }
  if (args.pages.includes('collection')) {
    const c = await getSampleCollection(store.shop, store.token);
    if (c) urls.push({ type: 'collection', url: `${baseUrl}/collections/${c.handle}`, ref: c.title });
  }

  const strategies = args.strategy === 'both' ? ['mobile', 'desktop'] : [args.strategy];
  const results = [];
  let lhCrash = false;

  for (const u of urls) {
    for (const strat of strategies) {
      let psi, dt, attempt = 0;
      const maxAttempts = 2;
      while (attempt < maxAttempts) {
        attempt++;
        const t0 = Date.now();
        psi = await psiCall(u.url, strat).catch(e => ({ status: 0, body: { error: { message: e.message } } }));
        dt = ((Date.now() - t0) / 1000).toFixed(1);
        if (psi.status === 200) break;
        const m = psi.body?.error?.message || '';
        // só dá retry em timeout/network — não em Lighthouse crash (sempre vai falhar)
        const retriable = (typeof m === 'string') && (m.includes('timeout') || m.includes('ECONN') || m.includes('socket'));
        if (!retriable || attempt >= maxAttempts) break;
        log(`⟳ retry ${strat} ${u.type} (1ª falhou em ${dt}s)`);
      }
      if (psi.status !== 200) {
        const errMsg = psi.body?.error?.message || psi.body?.error || `status ${psi.status}`;
        const msg = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        log(`✗ PSI ${strat} ${u.type} ${dt}s — ${msg.slice(0, 80)}`);
        if (msg.includes('Lighthouse returned error') || msg.includes('Something went wrong')) lhCrash = true;
        continue;
      }
      const scores = extractScores(psi);
      if (!scores) { log(`✗ PSI ${strat} ${u.type} ${dt}s — sem lighthouseResult`); continue; }
      log(`✓ PSI ${strat} ${u.type} perf=${scores.performance} a11y=${scores.accessibility} bp=${scores.bestPractices} seo=${scores.seo} LCP=${scores.metrics.lcp_ms}ms (${dt}s)`);
      results.push({ url: u.url, page_type: u.type, ref: u.ref, strategy: strat, ...scores });
    }
  }

  return { client: store, baseUrl, results, lhCrash };
}

// ---------- Report ----------
function summarizeIssues(allResults) {
  const counter = {};
  for (const store of allResults) {
    if (!store?.results) continue;
    for (const r of store.results) {
      for (const issue of r.topIssues) {
        if (!counter[issue.id]) counter[issue.id] = { id: issue.id, title: issue.title, count: 0, totalSavingsMs: 0, totalSavingsBytes: 0 };
        counter[issue.id].count += 1;
        counter[issue.id].totalSavingsMs += issue.savingsMs || 0;
        counter[issue.id].totalSavingsBytes += issue.savingsBytes || 0;
      }
    }
  }
  return Object.values(counter).sort((a, b) => b.count - a.count);
}

function fmtBytes(b) {
  if (!b) return '-';
  if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  if (b > 1024) return (b / 1024).toFixed(0) + ' KB';
  return b + ' B';
}

function makeMarkdown(allResults, args) {
  const date = new Date().toISOString().slice(0, 10);
  const ok = allResults.filter(s => s?.results?.length);
  let md = `# PageSpeed Report — ${date}\n\n`;
  md += `**Lojas analisadas:** ${ok.length}/${allResults.length} · **Páginas:** ${args.pages.join(', ')} · **Estratégia:** ${args.strategy}\n\n`;

  // Ranking
  md += `## Ranking (mobile, página home)\n\n`;
  md += `| Loja | Perf | A11y | BP | SEO | LCP | TBT | CLS |\n`;
  md += `|---|---:|---:|---:|---:|---:|---:|---:|\n`;
  const ranking = ok.map(s => {
    const home = s.results.find(r => r.page_type === 'home' && r.strategy === 'mobile') || s.results[0];
    return { name: s.client.name, baseUrl: s.baseUrl, ...home };
  }).sort((a, b) => (a.performance ?? 999) - (b.performance ?? 999));
  for (const r of ranking) {
    md += `| ${r.name} | ${r.performance ?? '-'} | ${r.accessibility ?? '-'} | ${r.bestPractices ?? '-'} | ${r.seo ?? '-'} | ${r.metrics?.lcp_ms ?? '-'}ms | ${r.metrics?.tbt_ms ?? '-'}ms | ${r.metrics?.cls ?? '-'} |\n`;
  }

  // Gargalos comuns
  const summary = summarizeIssues(ok);
  md += `\n## Gargalos mais comuns\n\n`;
  md += `| # | Issue | Lojas afetadas | Tempo total | Bytes total |\n`;
  md += `|---|---|---:|---:|---:|\n`;
  for (let i = 0; i < Math.min(15, summary.length); i++) {
    const s = summary[i];
    md += `| ${i + 1} | ${s.title} | ${s.count} | ${s.totalSavingsMs ? Math.round(s.totalSavingsMs) + 'ms' : '-'} | ${fmtBytes(s.totalSavingsBytes)} |\n`;
  }

  // Apps/scripts mais comuns que pesam
  const tpAggregator = {};
  for (const s of ok) {
    for (const r of s.results) {
      for (const t of r.thirdParties || []) {
        if (!tpAggregator[t.entity]) tpAggregator[t.entity] = { entity: t.entity, lojas: 0, blockingMs: 0, kb: 0 };
        tpAggregator[t.entity].lojas += 1;
        tpAggregator[t.entity].blockingMs += t.blockingMs;
        tpAggregator[t.entity].kb += t.kb;
      }
    }
  }
  const tpRanked = Object.values(tpAggregator).sort((a, b) => b.blockingMs - a.blockingMs);
  if (tpRanked.length) {
    md += `\n## Apps/Scripts third-party que mais pesam\n\n`;
    md += `| # | Entidade | Lojas | Blocking total | KB total |\n|---|---|---:|---:|---:|\n`;
    tpRanked.slice(0, 10).forEach((t, i) => {
      md += `| ${i + 1} | ${t.entity} | ${t.lojas} | ${t.blockingMs}ms | ${t.kb} KB |\n`;
    });
  }

  // Por loja
  md += `\n## Detalhamento por loja\n\n`;
  for (const s of ok) {
    md += `### ${s.client.name} — ${s.baseUrl}\n\n`;
    for (const r of s.results) {
      md += `**${r.page_type}** (${r.strategy}) — perf=${r.performance} · LCP=${r.metrics.lcp_ms}ms · TBT=${r.metrics.tbt_ms}ms · CLS=${r.metrics.cls}\n\n`;
      if (r.lcpElement?.snippet) {
        md += `_LCP element:_ \`${r.lcpElement.snippet.replace(/\n/g, ' ').slice(0, 150)}\`\n\n`;
      }
      if (r.thirdParties?.length) {
        md += `**Third-parties pesados:**\n`;
        for (const t of r.thirdParties.slice(0, 5)) {
          md += `- ${t.entity} — ${t.kb}KB · blocking ${t.blockingMs}ms\n`;
        }
        md += `\n`;
      }
      if (r.heavyRequests?.length) {
        md += `**Requests pesados:**\n`;
        for (const h of r.heavyRequests.slice(0, 5)) {
          md += `- ${h.kb}KB · ${h.ms}ms · ${h.type} · \`${h.url.slice(0, 90)}\`\n`;
        }
        md += `\n`;
      }
      if (r.imageIssues?.wrongFormat?.length || r.imageIssues?.oversized?.length) {
        md += `**Imagens otimizáveis:**\n`;
        for (const i of (r.imageIssues.wrongFormat || []).slice(0, 3)) {
          md += `- formato moderno faltando — economiza ${i.savingsKb}KB · \`${i.url.slice(0, 90)}\`\n`;
        }
        for (const i of (r.imageIssues.oversized || []).slice(0, 3)) {
          md += `- imagem grande demais — economiza ${i.savingsKb}KB · \`${i.url.slice(0, 90)}\`\n`;
        }
        md += `\n`;
      }
      if (r.topIssues.length) {
        md += `**Top gargalos:**\n`;
        for (const i of r.topIssues.slice(0, 5)) {
          const sav = i.savingsMs ? `${Math.round(i.savingsMs)}ms` : (i.savingsBytes ? fmtBytes(i.savingsBytes) : '');
          md += `- ${i.title} ${sav ? '— ' + sav : ''}${i.displayValue ? ' (' + i.displayValue + ')' : ''}\n`;
        }
        md += `\n`;
      }
    }
  }

  return md;
}

// ---------- Main ----------
(async () => {
  const args = parseArgs();
  let stores = await pickStores(args);

  // Blacklist: pula lojas que crasharam Lighthouse 2x consecutivas em 7 dias
  const blacklist = loadBlacklist();
  const skipped = [];
  if (!args.retryFailed) {
    const before = stores.length;
    stores = stores.filter(s => {
      if (isBlacklisted(blacklist, s.id)) {
        skipped.push({ name: s.name, reason: blacklist[s.id]?.lastReason });
        return false;
      }
      return true;
    });
    if (skipped.length) {
      console.log(`⚠️  Pulando ${skipped.length} lojas blacklistadas (Lighthouse crash recorrente — use --retry-failed pra forçar):`);
      for (const s of skipped) console.log(`     - ${s.name} (${(s.reason || '').slice(0, 60)})`);
    }
  }

  console.log(`=== pagespeed ===`);
  console.log(`Lojas: ${stores.length} · Páginas: ${args.pages.join(',')} · Estratégia: ${args.strategy} · Pool: ${args.parallel}`);
  console.log(`API key: ${ENV.PAGESPEED_API_KEY ? 'sim (25k req/dia)' : 'NÃO (rate limit baixo, considere setar PAGESPEED_API_KEY)'}`);
  console.log(`Tempo estimado: ~${Math.ceil(stores.length * 90 / args.parallel / 60)} min\n`);

  const t0 = Date.now();
  const allResults = await runWithPool(stores, async (s) => {
    try { return await analyzeStore(s, args); }
    catch (e) { console.log(`[${s.name}] ✗ erro: ${e.message}`); return { client: s, error: e.message }; }
  }, args.parallel);
  console.log(`\n⏱️  Concluído em ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // Atualiza blacklist
  for (const r of allResults) {
    if (!r?.client?.id) continue;
    if (r.lhCrash) recordFail(blacklist, r.client.id, 'Lighthouse crash');
    else if (r.results?.length) recordSuccess(blacklist, r.client.id);
  }
  saveBlacklist(blacklist);

  // Save outputs
  if (args.save) {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const jsonPath = path.join(OUT_DIR, `${stamp}.json`);
    const mdPath = path.join(OUT_DIR, `${date}-report.md`);
    fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));
    fs.writeFileSync(mdPath, makeMarkdown(allResults, args));
    console.log(`\n📊 Relatório salvo:`);
    console.log(`  JSON: ${path.relative(ROOT, jsonPath)}`);
    console.log(`  MD:   ${path.relative(ROOT, mdPath)}`);
  }

  // Console summary
  const ok = allResults.filter(s => s?.results?.length);
  console.log(`\n=== RANKING (mobile home) ===`);
  const ranking = ok.map(s => {
    const home = s.results.find(r => r.page_type === 'home' && r.strategy === 'mobile') || s.results[0];
    return { name: s.client.name, perf: home.performance, lcp: home.metrics.lcp_ms, tbt: home.metrics.tbt_ms, cls: home.metrics.cls };
  }).sort((a, b) => a.perf - b.perf);
  console.table(ranking);

  const summary = summarizeIssues(ok);
  console.log(`\n=== TOP GARGALOS ===`);
  console.table(summary.slice(0, 10).map(s => ({ issue: s.title, lojas: s.count, savings_ms: Math.round(s.totalSavingsMs), savings: fmtBytes(s.totalSavingsBytes) })));
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

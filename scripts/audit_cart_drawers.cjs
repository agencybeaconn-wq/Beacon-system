// Audit cart-drawer.liquid across all connected Lever stores
const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'https://pxhmzpwvxvlwngjbjkrg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4aG16cHd2eHZsd25namJqa3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzQ5NDksImV4cCI6MjA4NDUxMDk0OX0.9Wz6imtaCdwU4d0yRodSehWwHHWKRZ3WCRatL0WXyos';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function getClients() {
  const res = await req({
    hostname: 'pxhmzpwvxvlwngjbjkrg.supabase.co',
    path: '/rest/v1/agency_clients?shopify_status=eq.connected&select=id,name,shopify_domain,shopify_access_token',
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  });
  return JSON.parse(res.body);
}

async function getMainThemeId(domain, token) {
  const res = await req({
    hostname: domain,
    path: '/admin/api/2026-01/themes.json',
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
  });
  if (res.status !== 200) return null;
  const { themes } = JSON.parse(res.body);
  const main = themes.find(t => t.role === 'main');
  return main ? main.id : null;
}

async function getCartDrawer(domain, token, themeId) {
  const res = await req({
    hostname: domain,
    path: `/admin/api/2026-01/themes/${themeId}/assets.json?asset[key]=snippets/cart-drawer.liquid`,
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
  });
  if (res.status !== 200) return null;
  try {
    return JSON.parse(res.body).asset;
  } catch { return null; }
}

function scoreCartDrawer(content) {
  if (!content) return null;
  const c = content.toLowerCase();
  const features = {
    savings_calculator: /you\s*save|voc[eê]\s*economiza|total_savings|economia/.test(c),
    milestones_progress: /milestone|progress[-_ ]?bar|buy[-_ ]?\d|leve[-_ ]?\d|compre[-_ ]?\d/.test(c),
    patches_as_properties: /line[-_ ]?item[-_ ]?propert|properties\[.*patch|_patch/.test(c),
    qty_selector_conditional: /(unless|if).*(custom|personaliz|patch|propert)/.test(c),
    custom_layout: /cart[-_ ]?drawer[-_ ]?item|custom[-_ ]?cart|stacked|line[-_ ]?item[-_ ]?details/.test(c),
    colored_checkout_btn: /background:\s*#[0-9a-f]*[1-9a-f]|checkout[-_ ]?button.*(green|color|bg)|btn[-_ ]?checkout/.test(c),
    jersey_filter_milestone: /product_type.*jersey|camisa|tag.*jersey|filter.*jersey|jerseys?\s*only/.test(c),
    free_item_badge: /\bfree\b|\bgr[aá]tis\b|gratuit/.test(c),
    patch_thumbnails: /patch.*image|patch.*thumb|img.*patch/.test(c),
    modern_liquid_render: /\{\%\s*render\s+/.test(c),
  };
  const count = Object.values(features).filter(Boolean).length;
  const lines = content.split('\n').length;
  return { features, count, lines };
}

async function main() {
  console.log('Fetching connected clients...');
  const clients = await getClients();
  console.log(`Found ${clients.length} connected clients\n`);

  const results = [];
  for (const client of clients) {
    const { name, shopify_domain: domain, shopify_access_token: token } = client;
    if (!domain || !token) {
      results.push({ name, error: 'missing_domain_or_token' });
      continue;
    }
    process.stdout.write(`[${name}] `);
    try {
      const themeId = await getMainThemeId(domain, token);
      await delay(400);
      if (!themeId) { results.push({ name, domain, error: 'no_main_theme' }); console.log('no main theme'); continue; }
      const asset = await getCartDrawer(domain, token, themeId);
      await delay(400);
      if (!asset || !asset.value) { results.push({ name, domain, error: 'no_cart_drawer' }); console.log('no cart-drawer'); continue; }
      const score = scoreCartDrawer(asset.value);
      results.push({ name, domain, themeId, ...score });
      console.log(`${score.count}/10 (${score.lines} lines)`);
    } catch (e) {
      results.push({ name, domain, error: e.message });
      console.log(`ERROR ${e.message}`);
      await delay(400);
    }
  }

  const outPath = 'c:/Users/pedro/OneDrive/Documentos/Lever System/Lever-System/scripts/cart_drawer_audit.json';
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Print ranked table
  const scored = results.filter(r => typeof r.count === 'number').sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lines - a.lines;
  });
  console.log('\n=== RANKED CART DRAWERS ===\n');
  scored.forEach((r, i) => {
    const feats = Object.entries(r.features).filter(([, v]) => v).map(([k]) => k).join(',');
    const missing = Object.entries(r.features).filter(([, v]) => !v).map(([k]) => k).join(',');
    console.log(`${i + 1}. ${r.name} — ${r.count}/10 — ${r.lines} lines`);
    console.log(`   HAS: ${feats}`);
    console.log(`   MISSING: ${missing}\n`);
  });

  const errs = results.filter(r => r.error);
  if (errs.length) {
    console.log('=== ERRORS ===');
    errs.forEach(r => console.log(`${r.name}: ${r.error}`));
  }

  console.log(`\nSaved full results to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });

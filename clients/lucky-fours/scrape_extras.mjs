// Extrai pages, policies e menus do luckyfours.com pra um JSON salvo localmente.
// Uso: node clients/lucky-fours/scrape_extras.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://luckyfours.com';
const OUT = path.join(__dirname, 'extras.json');

const POLICIES = ['privacy-policy', 'refund-policy', 'terms-of-service', 'shipping-policy'];

async function fetchHTML(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

function extractPolicyBody(html) {
  // <div class="shopify-policy__body">...</div>  (multiline)
  const m = html.match(/<div[^>]*class="shopify-policy__body"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
  if (!m) {
    // fallback: pega só o body div se não conseguir o close balanceado
    const start = html.indexOf('shopify-policy__body');
    if (start === -1) return '';
    const slice = html.slice(start);
    const open = slice.indexOf('>');
    const close = slice.indexOf('</div>', open);
    return slice.slice(open + 1, close);
  }
  return m[1].trim();
}

function extractPolicyTitle(html) {
  const m = html.match(/<h1[^>]*class="shopify-policy__title"[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extractMenusFromHome(html) {
  const menus = { header: [], footer: [] };
  // Tenta achar nav main
  const headerNav = html.match(/<nav[^>]*(?:header|main)[^>]*>([\s\S]*?)<\/nav>/i);
  const linksFromBlock = (block) => {
    if (!block) return [];
    const out = [];
    const re = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(block)) !== null) {
      const url = m[1];
      const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text || /^\s*$/.test(text)) continue;
      if (!/\/(collections|pages|policies|products)\//.test(url) && url !== '/') continue;
      out.push({ text, url });
    }
    return out;
  };
  if (headerNav) menus.header = linksFromBlock(headerNav[1]);
  const footerNav = html.match(/<footer[\s\S]*?<\/footer>/i);
  if (footerNav) menus.footer = linksFromBlock(footerNav[0]);

  // Dedupe por URL+text
  const dedupe = (arr) => {
    const seen = new Set();
    return arr.filter(l => {
      const k = `${l.text}|${l.url}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  };
  menus.header = dedupe(menus.header);
  menus.footer = dedupe(menus.footer);
  return menus;
}

async function main() {
  console.log(`\n=== Scrape extras de ${ORIGIN} ===\n`);

  // 1) Pages via API pública
  console.log(`→ Buscando pages.json...`);
  const pagesRaw = await fetch(`${ORIGIN}/pages.json`).then(r => r.json());
  const pages = (pagesRaw.pages || []).map(p => ({
    handle: p.handle,
    title: p.title,
    body_html: p.body_html,
    published: p.published_at != null,
  }));
  console.log(`  ${pages.length} pages: ${pages.map(p => p.handle).join(', ')}`);

  // 2) Policies (4 padrão Shopify)
  console.log(`\n→ Buscando policies (HTML scrape)...`);
  const policies = [];
  for (const handle of POLICIES) {
    try {
      const html = await fetchHTML(`${ORIGIN}/policies/${handle}`);
      const body = extractPolicyBody(html);
      const title = extractPolicyTitle(html) || handle;
      policies.push({ handle, title, body_html: body });
      console.log(`  + ${handle} (${title}): ${body.length} chars`);
    } catch (e) {
      console.warn(`  ! ${handle}: ${e.message}`);
    }
  }

  // 3) Menus via HTML home
  console.log(`\n→ Buscando menus (HTML home)...`);
  const home = await fetchHTML(`${ORIGIN}/`);
  const menus = extractMenusFromHome(home);
  console.log(`  header: ${menus.header.length} links`);
  console.log(`  footer: ${menus.footer.length} links`);

  const out = { pages, policies, menus, scraped_at: new Date().toISOString(), origin: ORIGIN };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\n✓ Salvo em ${OUT}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

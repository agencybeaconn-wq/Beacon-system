// ============================================================
// Fallback scraper for JS-rendered Meta pages (WhatsApp docs etc)
// Uses Playwright to render pages that the HTTP scraper couldn't extract.
//
//   node scraper_meta_js_fallback.js
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

const OUT_DIR = path.join(__dirname, 'meta-marketing-api');
const PAGES_DIR = path.join(OUT_DIR, 'pages');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});

function findEmptyPages() {
  const empty = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name === 'content.md') {
        try {
          const stat = fs.statSync(fp);
          if (stat.size < 100) empty.push(path.dirname(fp));
        } catch {}
      }
    }
  }
  walk(PAGES_DIR);
  return empty;
}

(async () => {
  const emptyDirs = findEmptyPages();
  console.log(`[INFO] Found ${emptyDirs.length} empty pages.\n`);

  if (emptyDirs.length === 0) {
    console.log('[FIM] Nothing to do.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < emptyDirs.length; i++) {
    const dir = emptyDirs[i];
    const metaPath = path.join(dir, 'metadata.json');

    let url = '';
    try {
      url = JSON.parse(fs.readFileSync(metaPath, 'utf-8')).url;
    } catch {
      console.log(`[SKIP ${i + 1}/${emptyDirs.length}] No metadata in ${path.relative(PAGES_DIR, dir)}`);
      continue;
    }

    if (!url) continue;

    process.stdout.write(`[${i + 1}/${emptyDirs.length}] ${url.substring(url.indexOf('/docs/') + 6)}...`);

    try {
      const targetUrl = url + (url.includes('?') ? '&' : '?') + 'locale=en_US';
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(3000);

      // Wait for any h1 or main content to appear
      try {
        await page.waitForSelector('h1, article, main, [role="main"]', { timeout: 15000 });
      } catch {}

      const html = await page.content();
      fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');

      // Parse the rendered HTML
      const $ = cheerio.load(html);
      $('script, style, noscript, link, meta, iframe').remove();

      let $main = $('#docsContent');
      if (!$main.length) $main = $('[role="main"]');
      if (!$main.length) $main = $('article');
      if (!$main.length) $main = $('main');
      if (!$main.length) $main = $('body');

      const title = $('h1').first().text().trim() ||
        ($('title').text() || '').replace(/ - Documentation - Meta for Developers$/i, '').trim();

      const textContent = $main.text().replace(/\s+/g, ' ').trim();
      let markdown = '';
      try { markdown = turndown.turndown($main.html() || ''); } catch { markdown = textContent; }

      // Only save if we actually got content
      if (markdown.length > 100) {
        fs.writeFileSync(path.join(dir, 'content.md'), markdown, 'utf-8');
        fs.writeFileSync(path.join(dir, 'content.txt'), textContent, 'utf-8');

        // Update metadata
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          meta.title = title;
          meta.word_count = textContent.split(/\s+/).filter(Boolean).length;
          meta.rendered_with = 'playwright';
          meta.rendered_at = new Date().toISOString();
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        } catch {}

        success++;
        console.log(` OK (${markdown.length} chars)`);
      } else {
        failed++;
        console.log(` STILL EMPTY`);
      }

      await page.waitForTimeout(500 + Math.random() * 1000);
    } catch (err) {
      failed++;
      console.log(` ERR: ${err.message.substring(0, 60)}`);
    }
  }

  await browser.close();
  console.log(`\n[FIM] ${success} recovered, ${failed} still failed.`);
})();

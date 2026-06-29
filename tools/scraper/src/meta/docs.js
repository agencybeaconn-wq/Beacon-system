// ============================================================
// SCRAPER Meta Marketing API Docs — BFS full archive
//
//   npm install cheerio turndown
//   node scraper_meta_docs.js
//
// Output: ./meta-marketing-api/
//   ├── pages/<url-path>/{index.html, clean.html, content.md, content.txt,
//   │                     metadata.json, code-samples.json, tables.json, sidebar.json}
//   ├── images/{media_id}.{ext}
//   ├── images/_manifest.json
//   ├── index.json
//   ├── search-index.json
//   ├── visited.json
//   └── queue.json
// ============================================================

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

// ---------- CONFIG ----------
const BASE = 'https://developers.facebook.com';
// URL path prefixes that are in-scope for the crawler.
// The BFS will only follow links whose pathname starts with one of these.
const PREFIXES = [
  '/docs/marketing-api',
  '/docs/marketing-apis',        // some URLs use the plural form
  '/docs/graph-api',             // base API — Marketing API references objects here
  '/docs/business-sdk',          // official SDKs (Python, PHP, Java, Node, Ruby)
  '/docs/facebook-pixel',        // tracking pixel docs
  '/docs/pages-api',             // pages management (used by Marketing API)
  '/docs/permissions',           // permission reference (each API needs specific scopes)
  '/docs/webhooks',              // webhooks (Marketing API delivery/lead notifications)
  '/docs/business-manager-api',  // business manager (owns ad accounts)
  '/docs/instagram-api',         // Instagram business accounts used in ads
  '/docs/instagram-platform',    // Instagram Graph API
  '/docs/messenger-platform',    // Messenger ads
  '/docs/whatsapp',              // WhatsApp Business (click-to-WhatsApp ads)
  '/docs/threads',               // Threads API (new ad surface)
  '/docs/app-events',            // App Events for conversions
  '/docs/audience-network',      // Audience Network placements
  '/docs/atlas',                 // Atlas measurement
];
const LOCALE = 'en_US';
const OUT_DIR = path.join(__dirname, 'meta-marketing-api');
const PAGES_DIR = path.join(OUT_DIR, 'pages');
const IMAGES_DIR = path.join(OUT_DIR, 'images');
const VISITED_FILE = path.join(OUT_DIR, 'visited.json');
const QUEUE_FILE = path.join(OUT_DIR, 'queue.json');
const INDEX_FILE = path.join(OUT_DIR, 'index.json');
const SEARCH_INDEX_FILE = path.join(OUT_DIR, 'search-index.json');
const IMG_MANIFEST_FILE = path.join(IMAGES_DIR, '_manifest.json');

const CONCURRENCY = 4;
const SAVE_EVERY = 20;
const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 500;
const MAX_RETRIES = 3;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ' +
  '(+archive bot; contact: europa-chaves-scraper)';

// ---------- SEED URLS ----------
const SEEDS = [
  // ===== Marketing API (core) =====
  '/docs/marketing-api',
  '/docs/marketing-api/overview',
  '/docs/marketing-api/get-started',
  '/docs/marketing-api/get-started/basic-ad-creation',
  '/docs/marketing-api/get-started/manage-campaigns',
  '/docs/marketing-api/get-started/ad-optimization-basics',
  '/docs/marketing-api/get-started/authorization',
  '/docs/marketing-api/creative',
  '/docs/marketing-api/bidding',
  '/docs/marketing-api/ad-rules',
  '/docs/marketing-api/audiences',
  '/docs/marketing-api/audiences/audiences-api/pixel',
  '/docs/marketing-api/insights',
  '/docs/marketing-api/insights/action-breakdowns',
  '/docs/marketing-api/insights/async',
  '/docs/marketing-api/insights/best-practices',
  '/docs/marketing-api/insights/breakdowns',
  '/docs/marketing-api/catalog',
  '/docs/marketing-api/conversions-api',
  '/docs/marketing-api/brand-safety-and-suitability',
  '/docs/marketing-api/best-practices',
  '/docs/marketing-api/troubleshooting',
  '/docs/marketing-api/reference',
  '/docs/marketing-api/marketing-api-changelog',
  '/docs/marketing-api/out-of-cycle-changes',
  '/docs/marketing-api/reference/ad-account',
  '/docs/marketing-api/reference/ad-account-user',
  '/docs/marketing-api/reference/ad-campaign',
  '/docs/marketing-api/reference/ad-campaign-group',
  '/docs/marketing-api/reference/ad-creative',
  '/docs/marketing-api/reference/adgroup',
  '/docs/marketing-api/reference/custom-audience',
  '/docs/marketing-api/reference/ads-pixel',
  '/docs/marketing-api/reference/ad-label',
  '/docs/marketing-api/reference/business/adaccount',

  // ===== Graph API (base — Marketing API references these objects) =====
  '/docs/graph-api',
  '/docs/graph-api/overview',
  '/docs/graph-api/get-started',
  '/docs/graph-api/guides',
  '/docs/graph-api/guides/error-handling',
  '/docs/graph-api/guides/field-expansion',
  '/docs/graph-api/guides/rate-limiting',
  '/docs/graph-api/batch-requests',
  '/docs/graph-api/webhooks',
  '/docs/graph-api/reference',
  '/docs/graph-api/reference/user',
  '/docs/graph-api/reference/page',
  '/docs/graph-api/reference/business',
  '/docs/graph-api/reference/post',
  '/docs/graph-api/reference/photo',
  '/docs/graph-api/reference/video',
  '/docs/graph-api/reference/application',
  '/docs/graph-api/reference/ad-account',
  '/docs/graph-api/reference/ad-campaign',
  '/docs/graph-api/reference/ad-creative',
  '/docs/graph-api/changelog',

  // ===== Business SDK (official SDKs) =====
  '/docs/business-sdk',
  '/docs/business-sdk/getting-started',
  '/docs/business-sdk/guides',

  // ===== Facebook Pixel =====
  '/docs/facebook-pixel',
  '/docs/facebook-pixel/implementation',
  '/docs/facebook-pixel/reference',

  // ===== Pages API =====
  '/docs/pages-api',
  '/docs/pages-api/overview',

  // ===== Permissions reference =====
  '/docs/permissions',
  '/docs/permissions/reference',

  // ===== Webhooks =====
  '/docs/webhooks',
  '/docs/webhooks/getting-started',
  '/docs/webhooks/reference',

  // ===== Business Manager API =====
  '/docs/business-manager-api',

  // ===== Instagram (Business + Graph) =====
  '/docs/instagram-api',
  '/docs/instagram-platform',

  // ===== Messenger Platform (for Messenger ads) =====
  '/docs/messenger-platform',

  // ===== WhatsApp Business (click-to-WhatsApp ads) =====
  '/docs/whatsapp',
  '/docs/whatsapp/cloud-api',
  '/docs/whatsapp/business-management-api',

  // ===== Threads (newer ad surface) =====
  '/docs/threads',

  // ===== App Events (conversions tracking) =====
  '/docs/app-events',

  // ===== Audience Network =====
  '/docs/audience-network',

  // ===== Atlas measurement =====
  '/docs/atlas',
];

// ---------- UTILS ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => sleep(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeUrl(raw) {
  // Accepts absolute or relative, returns a canonical dedup key
  // (strips locale, fragment, trailing slash; keeps path)
  try {
    const u = new URL(raw, BASE);
    u.searchParams.delete('locale');
    u.hash = '';
    let p = u.pathname.replace(/\/+$/, '');
    if (!p) p = '/';
    return `${u.protocol}//${u.host.toLowerCase()}${p}${u.search}`;
  } catch {
    return null;
  }
}

function withLocale(url) {
  const u = new URL(url, BASE);
  u.searchParams.set('locale', LOCALE);
  return u.toString();
}

function isMarketingApiUrl(url) {
  try {
    const u = new URL(url, BASE);
    if (!u.host.endsWith('developers.facebook.com')) return false;
    return PREFIXES.some(p => u.pathname.startsWith(p));
  } catch {
    return false;
  }
}

function urlToPathSegments(url) {
  const u = new URL(url, BASE);
  // Strip leading /docs/ only — keep the API name as the first segment
  // so we get pages like: pages/marketing-api/reference/ad-account
  //                       pages/graph-api/reference/user
  //                       pages/business-sdk/python
  const rel = u.pathname.replace(/^\/docs\//, '').replace(/^\/+|\/+$/g, '');
  return rel ? rel.split('/') : ['_root'];
}

function urlToDiskPath(url) {
  const segments = urlToPathSegments(url).map(s => s.replace(/[^\w.-]/g, '_'));
  return path.join(PAGES_DIR, ...segments);
}

function loadJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function saveJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- HTTP ----------
async function fetchWithRetry(url, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Cookie': `locale=${LOCALE}`,
          ...opts.headers,
        },
      });
      if ([400, 429, 500, 502, 503, 504].includes(res.status)) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        const backoff = 1000 * 2 ** attempt;
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

// ---------- TURNDOWN ----------
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});
turndown.addRule('preserveLinks', {
  filter: 'a',
  replacement: (content, node) => {
    const href = node.getAttribute('href') || '';
    if (!content.trim()) return '';
    if (!href) return content;
    return `[${content}](${href})`;
  },
});
turndown.addRule('codeBlock', {
  filter: node => node.nodeName === 'PRE' && node.querySelector('code'),
  replacement: (_, node) => {
    const code = node.querySelector('code');
    const lang = (code.className.match(/language-(\w+)/) || [, ''])[1];
    return `\n\n\`\`\`${lang}\n${code.textContent}\n\`\`\`\n\n`;
  },
});

// ---------- PAGE PARSING ----------
// imageMap: Map<originalUrl, localFilename> to rewrite refs with local paths
function extractPage(html, url, imageMap = new Map(), relativeImagesPath = '../images') {
  const $ = cheerio.load(html);

  // Strip <script>/<style>/tracking pixels from a clone for the "clean" version
  const $clean = cheerio.load(html);
  $clean('script, style, noscript, link[rel="preload"], iframe').remove();

  // Rewrite image URLs in the cleaned HTML to local paths
  $clean('img[src]').each((_, el) => {
    const src = $clean(el).attr('src');
    if (!src) return;
    try {
      const abs = new URL(src, url).toString();
      if (abs.includes('lookaside.fbsbx.com/elementpath/media') && imageMap.has(abs)) {
        $clean(el).attr('src', `${relativeImagesPath}/${imageMap.get(abs)}`);
      }
    } catch {}
  });

  const cleanHtml = $clean.html();

  // Strip scripts/styles/tracking from the main cheerio instance too
  // (otherwise turndown emits inline JS data as markdown noise)
  $('script, style, noscript, link, meta, iframe').remove();
  // Meta wraps real docs content in various layouts — remove big global chrome divs
  $('[id^="fb_"], [class*="requireLazy"], #u_0_a_, #hsrsFrm').remove();

  // Find main content area — try several selectors, fall back to body
  let $main = $('#docsContent');
  if (!$main.length) $main = $('[role="main"]');
  if (!$main.length) $main = $('article');
  if (!$main.length) $main = $('main');
  if (!$main.length) $main = $('body');

  // Title
  let title = $('h1').first().text().trim();
  if (!title) {
    title = ($('title').text() || '')
      .replace(/ - Marketing API - Documentation - Meta for Developers$/i, '')
      .trim();
  }

  // Breadcrumbs
  const breadcrumbs = [];
  $('nav[aria-label="Breadcrumb"] a, nav.breadcrumb a, .breadcrumb a').each((_, el) => {
    const t = $(el).text().trim();
    const h = $(el).attr('href') || '';
    if (t) breadcrumbs.push({ text: t, href: h });
  });

  // Headings (for search index)
  const headings = [];
  $main.find('h1, h2, h3, h4').each((_, el) => {
    const tag = el.tagName || el.name;
    headings.push({
      level: parseInt(tag.replace('h', ''), 10),
      text: $(el).text().trim(),
      id: $(el).attr('id') || '',
    });
  });

  // Out-links (to other marketing-api pages)
  const outLinks = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      if (isMarketingApiUrl(abs)) {
        const norm = normalizeUrl(abs);
        if (norm) outLinks.add(norm);
      }
    } catch {}
  });

  // Images (content images on lookaside)
  const images = [];
  $main.find('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    try {
      const abs = new URL(src, url).toString();
      if (abs.includes('lookaside.fbsbx.com/elementpath/media')) {
        const u = new URL(abs);
        const mediaId = u.searchParams.get('media_id') || '';
        images.push({
          url: abs,
          media_id: mediaId,
          alt: $(el).attr('alt') || '',
        });
      }
    } catch {}
  });

  // Code samples
  const codeSamples = [];
  $main.find('pre code').each((_, el) => {
    const $el = $(el);
    const langMatch = ($el.attr('class') || '').match(/language-(\w+)/);
    const heading = $el.closest('section, div').prevAll('h1, h2, h3, h4').first().text().trim();
    codeSamples.push({
      language: langMatch ? langMatch[1] : '',
      code: $el.text(),
      context_heading: heading,
    });
  });

  // Tables
  const tables = [];
  $main.find('table').each((_, tbl) => {
    const $tbl = $(tbl);
    const caption = $tbl.find('caption').text().trim();
    const headers = [];
    $tbl.find('thead tr th, tr:first-child th').each((_, th) => {
      headers.push($(th).text().trim());
    });
    const rows = [];
    $tbl.find('tbody tr, tr:not(:first-child)').each((_, tr) => {
      const cells = [];
      $(tr).find('td').each((_, td) => cells.push($(td).text().trim()));
      if (cells.length) rows.push(cells);
    });
    const heading = $tbl.closest('section, div').prevAll('h1, h2, h3, h4').first().text().trim();
    tables.push({ caption, headers, rows, context_heading: heading });
  });

  // Sidebar contextual tree
  const sidebar = [];
  $('nav[aria-label="Docs Navigation"] a, nav._9_7 a, ._9_7 a[href^="/docs/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (text && href.includes('/docs/')) {
      sidebar.push({ text, href });
    }
  });

  // Plain text (for search index)
  const textContent = $main.text().replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  // Rewrite img src inside $main to local paths BEFORE turndown
  $main.find('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    try {
      const abs = new URL(src, url).toString();
      if (abs.includes('lookaside.fbsbx.com/elementpath/media') && imageMap.has(abs)) {
        $(el).attr('src', `${relativeImagesPath}/${imageMap.get(abs)}`);
      }
    } catch {}
  });

  // Markdown via turndown — feed just the main content
  let markdown = '';
  try {
    markdown = turndown.turndown($main.html() || '');
  } catch {
    markdown = textContent;
  }

  return {
    title,
    breadcrumbs,
    headings,
    outLinks: [...outLinks],
    images,
    codeSamples,
    tables,
    sidebar,
    textContent,
    wordCount,
    markdown,
    cleanHtml,
  };
}

// ---------- IMAGE DOWNLOAD ----------
async function downloadImage(imgUrl, manifest) {
  try {
    const u = new URL(imgUrl);
    const mediaId = u.searchParams.get('media_id');
    if (!mediaId) return null;

    // Already downloaded?
    const existing = Object.keys(manifest).find(k => k.startsWith(mediaId + '.'));
    if (existing) return existing;

    const res = await fetchWithRetry(imgUrl);
    if (!res.ok) return null;

    const ct = res.headers.get('content-type') || 'image/png';
    const ext = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg'
              : ct.includes('gif') ? 'gif'
              : ct.includes('webp') ? 'webp'
              : ct.includes('svg') ? 'svg'
              : 'png';
    const filename = `${mediaId}.${ext}`;
    const fp = path.join(IMAGES_DIR, filename);
    ensureDir(IMAGES_DIR);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(fp, buf);
    return filename;
  } catch {
    return null;
  }
}

// ---------- MAIN ----------
(async () => {
  ensureDir(OUT_DIR);
  ensureDir(PAGES_DIR);
  ensureDir(IMAGES_DIR);

  // Load state
  const visited = new Set(loadJSON(VISITED_FILE, []));
  const queue = loadJSON(QUEUE_FILE, []);
  const imgManifest = loadJSON(IMG_MANIFEST_FILE, {});
  const pageIndex = loadJSON(INDEX_FILE, { pages: [] });
  const pageIndexMap = new Map(pageIndex.pages.map(p => [p.url, p]));

  // Seed the queue with any seeds not yet visited or queued
  const queuedSet = new Set(queue);
  for (const s of SEEDS) {
    const abs = normalizeUrl(BASE + s);
    if (abs && !visited.has(abs) && !queuedSet.has(abs)) {
      queue.push(abs);
      queuedSet.add(abs);
    }
  }

  console.log(`[INFO] Output: ${OUT_DIR}`);
  console.log(`[INFO] Visited: ${visited.size}, Queued: ${queue.length}`);
  if (visited.size > 0) console.log('[RESUME] Continuing from saved state.\n');

  let pagesProcessed = 0;
  const startTime = Date.now();

  // Worker function — pulls from queue
  async function worker(id) {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      try {
        const res = await fetchWithRetry(withLocale(url));
        if (!res.ok) {
          console.log(`[${visited.size}] [${res.status}] ${url}`);
          continue;
        }
        const html = await res.text();

        // First pass: find images in the page (no rewriting yet)
        const preData = extractPage(html, url);

        // Compute disk path for this page BEFORE extracting markdown,
        // so we can figure out the relative path to the global images folder
        const dir = urlToDiskPath(url);
        const depth = path.relative(PAGES_DIR, dir).split(path.sep).length;
        const relativeImagesPath = '../'.repeat(depth) + 'images';

        // Download all images FIRST, fill imageMap with originalUrl -> localFilename
        const imageMap = new Map();
        for (const img of preData.images) {
          const filename = await downloadImage(img.url, imgManifest);
          if (filename) {
            imageMap.set(img.url, filename);
            if (!imgManifest[filename]) imgManifest[filename] = [];
            if (!imgManifest[filename].includes(url)) imgManifest[filename].push(url);
          }
        }

        // Second pass: extract with image rewriting (markdown + clean.html get local paths)
        const data = extractPage(html, url, imageMap, relativeImagesPath);

        // Write files
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
        fs.writeFileSync(path.join(dir, 'clean.html'), data.cleanHtml || '', 'utf-8');
        fs.writeFileSync(path.join(dir, 'content.md'), data.markdown || '', 'utf-8');
        fs.writeFileSync(path.join(dir, 'content.txt'), data.textContent || '', 'utf-8');
        saveJSON(path.join(dir, 'code-samples.json'), data.codeSamples);
        saveJSON(path.join(dir, 'tables.json'), data.tables);
        saveJSON(path.join(dir, 'sidebar.json'), data.sidebar);
        saveJSON(path.join(dir, 'metadata.json'), {
          url,
          fetched_at: new Date().toISOString(),
          locale: LOCALE,
          title: data.title,
          breadcrumbs: data.breadcrumbs,
          headings: data.headings,
          word_count: data.wordCount,
          out_links: data.outLinks,
          images: data.images.map(img => ({
            ...img,
            local_path: imageMap.has(img.url) ? `${relativeImagesPath}/${imageMap.get(img.url)}` : null,
          })),
          code_sample_count: data.codeSamples.length,
          table_count: data.tables.length,
        });

        // Update master index
        const indexEntry = {
          url,
          path: path.relative(PAGES_DIR, dir).replace(/\\/g, '/'),
          title: data.title,
          section: urlToPathSegments(url)[0] || '',
          word_count: data.wordCount,
          image_count: data.images.length,
          code_sample_count: data.codeSamples.length,
          table_count: data.tables.length,
          out_links: data.outLinks.length,
          fetched_at: new Date().toISOString(),
        };
        pageIndexMap.set(url, indexEntry);

        // Queue new out-links
        let newLinks = 0;
        for (const link of data.outLinks) {
          if (!visited.has(link) && !queue.includes(link)) {
            queue.push(link);
            newLinks++;
          }
        }

        pagesProcessed++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(
          `[${visited.size}] (+${newLinks} | queue:${queue.length} | ${elapsed}s) ${data.title || url.substring(url.lastIndexOf('/') + 1)}`
        );

        // Periodic save
        if (pagesProcessed % SAVE_EVERY === 0) {
          saveState();
        }
      } catch (err) {
        console.log(`[ERR] ${url}: ${err.message.substring(0, 100)}`);
      }

      await jitter();
    }
  }

  function saveState() {
    saveJSON(VISITED_FILE, [...visited]);
    saveJSON(QUEUE_FILE, queue);
    saveJSON(IMG_MANIFEST_FILE, imgManifest);
    saveJSON(INDEX_FILE, {
      scraped_at: new Date().toISOString(),
      locale: LOCALE,
      total_pages: pageIndexMap.size,
      total_images: Object.keys(imgManifest).length,
      pages: [...pageIndexMap.values()],
    });
    // Search index — compact version
    const searchEntries = [...pageIndexMap.values()].map(p => ({
      path: p.path,
      title: p.title,
      section: p.section,
      url: p.url,
    }));
    saveJSON(SEARCH_INDEX_FILE, searchEntries);
  }

  // Launch workers
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  // Final save
  saveState();

  // Write a README at the root to help LLMs understand the structure
  const readme = `# Meta Marketing API — Offline Archive

Scraped on: ${new Date().toISOString()}
Locale: ${LOCALE}
Total pages: ${pageIndexMap.size}
Total images: ${Object.keys(imgManifest).length}

## Folder structure

- \`pages/\` — mirrors the Meta docs URL tree. Each page path (e.g. \`reference/ad-campaign/insights\`) becomes a folder with 8 files.
- \`images/\` — all content images from the docs, stored as \`{media_id}.{ext}\`.
- \`index.json\` — master list of every page (url, title, section, word count, metadata).
- \`search-index.json\` — compact search index (path, title, section, url).
- \`images/_manifest.json\` — maps each image file to the pages that reference it.

## Files inside each page folder

| File | Purpose |
|---|---|
| \`index.html\` | Raw HTML as fetched from Meta (preserves fidelity). |
| \`clean.html\` | Same HTML with \`<script>\`/\`<style>\`/tracking removed and image \`<img src>\` rewritten to local paths. |
| \`content.md\` | Clean markdown extracted from the main content, with image references pointing to \`../images/<file>\` relative paths. Use this for LLM context. |
| \`content.txt\` | Plain text version. |
| \`metadata.json\` | Title, breadcrumbs, headings, out-links, image refs (with local_path), word count. |
| \`code-samples.json\` | Every \`<pre><code>\` block with language and context heading. |
| \`tables.json\` | Every \`<table>\` with headers, rows, caption, context heading. |
| \`sidebar.json\` | Contextual Meta nav tree visible from that page. |

## For LLM consumption

The \`content.md\` files are self-contained: they reference images via relative paths like \`../images/12345.png\` so when this whole folder tree is uploaded as context, the LLM can correlate each image with the section it appears in — without needing internet access.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf-8');

  console.log(`\n[FIM] ${pagesProcessed} pages processed this run.`);
  console.log(`      Total pages visited: ${visited.size}`);
  console.log(`      Total images: ${Object.keys(imgManifest).length}`);
  console.log(`      Output: ${OUT_DIR}`);
})();

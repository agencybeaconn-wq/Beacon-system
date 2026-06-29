// ============================================================
// SCRAPER Shopify Dev Docs — usa o endpoint .md nativo
//
//   node scraper_shopify_docs.js
//
// Output: ./shopify-docs/
//   ├── pages/<url-path>/{content.md, metadata.json}
//   ├── images/<filename>
//   ├── llms.txt                 (índice curado da Shopify)
//   ├── sitemap.xml              (sitemap original)
//   ├── index.json               (master index)
//   ├── search-index.json        (compact)
//   └── README.md
// ============================================================

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- CONFIG ----------
const BASE = 'https://shopify.dev';
const SITEMAP_URL = 'https://shopify.dev/sitemap_standard.xml.gz';
const LLMS_TXT_URL = 'https://shopify.dev/llms.txt';
const OUT_DIR = path.join(__dirname, 'shopify-docs');
const PAGES_DIR = path.join(OUT_DIR, 'pages');
const IMAGES_DIR = path.join(OUT_DIR, 'images');
const VISITED_FILE = path.join(OUT_DIR, 'visited.json');
const INDEX_FILE = path.join(OUT_DIR, 'index.json');
const SEARCH_INDEX_FILE = path.join(OUT_DIR, 'search-index.json');

const CONCURRENCY = 15;
const SAVE_EVERY = 100;
const MAX_RETRIES = 3;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ' +
  '(+archive bot; contact: leverads)';

// Disallowed paths from robots.txt
const DISALLOWED = [
  '/beta/',
  '/api/shipping-partner-platform/',
  '/docs/api/shipping-partner-platform/',
];

// Extra seeds not in sitemap
const EXTRA_SEEDS = [
  '/docs/agents',
  '/docs/agents/catalog',
  '/docs/agents/catalog/mcp',
  '/docs/agents/catalog/storefront-mcp',
  '/docs/agents/checkout',
  '/docs/agents/checkout/mcp',
  '/docs/agents/checkout/ecp',
  '/docs/agents/checkout/shop-pay-handler',
  '/docs/agents/get-started/authentication',
  '/docs/api/admin-graphql',
  '/docs/api/storefront',
  '/docs/api/customer',
  '/docs/api/webhooks',
  '/docs/api/functions',
  '/docs/api/liquid',
  '/docs/api/admin-rest',
  '/docs/api/shopify-cli',
  '/docs/apps',
  '/docs/storefronts',
  '/docs/storefronts/themes',
  '/docs/storefronts/headless',
];

// ---------- UTILS ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => sleep(30 + Math.random() * 70);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

function saveJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizePath(pathname) {
  // Convert legacy /api/ and /apps/ and /storefronts/ to /docs/...
  if (pathname.startsWith('/api/')) return '/docs' + pathname;
  if (pathname.startsWith('/apps/')) return '/docs' + pathname;
  if (pathname.startsWith('/storefronts/')) return '/docs' + pathname;
  return pathname;
}

function urlToDiskPath(url) {
  const u = new URL(url, BASE);
  const rel = u.pathname
    .replace(/^\/docs\//, '')
    .replace(/\.md$/, '')
    .replace(/^\/+|\/+$/g, '');
  const segments = rel ? rel.split('/').map(s => s.replace(/[^\w.-]/g, '_')) : ['_root'];
  return path.join(PAGES_DIR, ...segments);
}

function isDisallowed(pathname) {
  return DISALLOWED.some(d => pathname.includes(d));
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
          'Accept': 'text/markdown, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          ...opts.headers,
        },
      });
      if ([429, 500, 502, 503, 504].includes(res.status)) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastErr;
}

// ---------- SITEMAP ----------
async function fetchSitemap() {
  console.log('[INFO] Fetching sitemap...');
  const res = await fetchWithRetry(SITEMAP_URL);
  const buf = Buffer.from(await res.arrayBuffer());
  const xml = zlib.gunzipSync(buf).toString('utf-8');

  // Save raw sitemap
  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml, 'utf-8');

  // Extract <loc> entries
  const urls = [];
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
  for (const m of matches) {
    const raw = m.replace(/<\/?loc>/g, '').trim();
    try {
      const u = new URL(raw);
      if (u.host !== 'shopify.dev') continue;
      const normalized = normalizePath(u.pathname);
      if (isDisallowed(normalized)) continue;
      urls.push(normalized);
    } catch {}
  }

  // Dedupe
  const unique = [...new Set(urls)];
  console.log(`[OK] Sitemap: ${matches.length} entries → ${unique.length} unique.\n`);
  return unique;
}

async function fetchLlmsTxt() {
  try {
    const res = await fetchWithRetry(LLMS_TXT_URL);
    if (res.ok) {
      const txt = await res.text();
      fs.writeFileSync(path.join(OUT_DIR, 'llms.txt'), txt, 'utf-8');
      console.log(`[OK] llms.txt saved (${txt.length} bytes)\n`);
    }
  } catch (err) {
    console.log(`[WARN] Failed to fetch llms.txt: ${err.message}\n`);
  }
}

// ---------- IMAGE DOWNLOAD ----------
const imgCache = new Set(); // dedup across workers

async function downloadImage(imgUrl) {
  try {
    // Only download cdn.shopify.com assets
    if (!imgUrl.includes('cdn.shopify.com/shopifycloud/shopify-dev')) return null;

    // Filename from URL — keep last segment
    const u = new URL(imgUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    const filename = segments[segments.length - 1];
    if (!filename) return null;

    const fp = path.join(IMAGES_DIR, filename);

    if (imgCache.has(filename)) return filename;
    if (fs.existsSync(fp)) { imgCache.add(filename); return filename; }

    const res = await fetchWithRetry(imgUrl);
    if (!res.ok) return null;

    ensureDir(IMAGES_DIR);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(fp, buf);
    imgCache.add(filename);
    return filename;
  } catch {
    return null;
  }
}

// ---------- PARSE MARKDOWN ----------
function parseMarkdown(md, url) {
  // Extract YAML frontmatter
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---\n/);
  let frontmatter = {};
  let body = md;
  if (fmMatch) {
    body = md.slice(fmMatch[0].length);
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) frontmatter[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }

  // Extract image URLs
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const images = [];
  let match;
  while ((match = imgRegex.exec(body))) {
    const imgUrl = match[1].split(' ')[0]; // strip alt-title
    if (imgUrl.includes('cdn.shopify.com')) images.push(imgUrl);
  }

  // Extract headings
  const headings = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  while ((match = headingRegex.exec(body))) {
    headings.push({ level: match[1].length, text: match[2].trim() });
  }

  // Word count
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return { frontmatter, body, images, headings, wordCount };
}

// ---------- REWRITE IMAGES ----------
function rewriteImagePaths(md, imageMap, relativeImagesPath) {
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, url) => {
    const cleanUrl = url.split(' ')[0];
    if (imageMap.has(cleanUrl)) {
      const filename = imageMap.get(cleanUrl);
      return `![${alt}](${relativeImagesPath}/${filename})`;
    }
    return full;
  });
}

// ---------- MAIN ----------
(async () => {
  ensureDir(OUT_DIR);
  ensureDir(PAGES_DIR);
  ensureDir(IMAGES_DIR);

  // Get sitemap + llms.txt
  await fetchLlmsTxt();
  const sitemapUrls = await fetchSitemap();

  // Merge with extra seeds
  const allUrls = new Set(sitemapUrls);
  for (const s of EXTRA_SEEDS) allUrls.add(s);

  // Load resume state
  const visited = new Set(loadJSON(VISITED_FILE, []));
  const pageIndex = loadJSON(INDEX_FILE, { pages: [] });
  const pageIndexMap = new Map(pageIndex.pages.map(p => [p.path, p]));

  // Build queue (skip already visited)
  const queue = [...allUrls].filter(u => !visited.has(u));
  console.log(`[INFO] Queue: ${queue.length} pages (${visited.size} already visited)\n`);

  const startTime = Date.now();
  let processed = 0;
  let errors404 = 0;

  async function worker(id) {
    while (queue.length > 0) {
      const pathname = queue.shift();
      if (!pathname || visited.has(pathname)) continue;
      visited.add(pathname);

      try {
        // Fetch .md version
        const mdUrl = `${BASE}${pathname}.md`;
        const res = await fetchWithRetry(mdUrl);

        if (res.status === 404) {
          errors404++;
          continue;
        }
        if (!res.ok) {
          console.log(`[${visited.size}] [${res.status}] ${pathname}`);
          continue;
        }

        const md = await res.text();
        const parsed = parseMarkdown(md, pathname);

        // Disk path
        const dir = urlToDiskPath(pathname);
        const depth = path.relative(PAGES_DIR, dir).split(path.sep).length;
        const relativeImagesPath = '../'.repeat(depth) + 'images';

        // Download images first
        const imageMap = new Map();
        for (const imgUrl of parsed.images) {
          const filename = await downloadImage(imgUrl);
          if (filename) imageMap.set(imgUrl, filename);
        }

        // Rewrite image paths in markdown
        const localMd = rewriteImagePaths(md, imageMap, relativeImagesPath);

        // Write files
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, 'content.md'), localMd, 'utf-8');
        saveJSON(path.join(dir, 'metadata.json'), {
          url: `${BASE}${pathname}`,
          md_url: mdUrl,
          fetched_at: new Date().toISOString(),
          title: parsed.frontmatter.title || '',
          description: parsed.frontmatter.description || '',
          api_version: parsed.frontmatter.api_version || '',
          api_name: parsed.frontmatter.api_name || '',
          source_url: parsed.frontmatter.source_url || '',
          word_count: parsed.wordCount,
          heading_count: parsed.headings.length,
          images: parsed.images.map(u => ({
            url: u,
            local_path: imageMap.has(u) ? `${relativeImagesPath}/${imageMap.get(u)}` : null,
          })),
        });

        // Update master index
        pageIndexMap.set(pathname, {
          path: pathname,
          title: parsed.frontmatter.title || '',
          description: parsed.frontmatter.description || '',
          section: pathname.split('/').filter(Boolean).slice(1, 3).join('/'),
          api_version: parsed.frontmatter.api_version || '',
          api_name: parsed.frontmatter.api_name || '',
          word_count: parsed.wordCount,
          image_count: parsed.images.length,
        });

        processed++;
        if (processed % 50 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const rate = (processed / (elapsed || 1)).toFixed(1);
          console.log(`[${processed}/${queue.length + processed}] ${rate} p/s | ${parsed.frontmatter.title || pathname.split('/').pop()}`);
        }

        if (processed % SAVE_EVERY === 0) saveState();
      } catch (err) {
        console.log(`[ERR] ${pathname}: ${err.message.substring(0, 80)}`);
      }

      await jitter();
    }
  }

  function saveState() {
    saveJSON(VISITED_FILE, [...visited]);
    saveJSON(INDEX_FILE, {
      scraped_at: new Date().toISOString(),
      total_pages: pageIndexMap.size,
      total_images: imgCache.size,
      pages: [...pageIndexMap.values()],
    });
    const searchEntries = [...pageIndexMap.values()].map(p => ({
      path: p.path,
      title: p.title,
      section: p.section,
      description: (p.description || '').substring(0, 200),
    }));
    saveJSON(SEARCH_INDEX_FILE, searchEntries);
  }

  // Launch workers
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  // Final save
  saveState();

  // Write README
  const readme = `# Shopify Developer Docs — Offline Archive

Scraped on: ${new Date().toISOString()}
Source: https://shopify.dev/docs
Total pages: ${pageIndexMap.size}
Total images: ${imgCache.size}
404s: ${errors404}

## Structure

- \`pages/\` — mirrors the Shopify docs URL tree. Each page is a folder with:
  - \`content.md\` — clean markdown (with YAML frontmatter), images rewritten to local paths
  - \`metadata.json\` — title, description, api_version, api_name, word_count, image list
- \`images/\` — all content images from cdn.shopify.com
- \`llms.txt\` — Shopify's official curated index of every doc page (from https://shopify.dev/llms.txt)
- \`sitemap.xml\` — original Shopify sitemap (decompressed)
- \`index.json\` — master list of every scraped page
- \`search-index.json\` — compact search index (path, title, section, description)

## Key sections

- \`pages/apps/\` — Apps development guides (build, launch, extensions, functions, AI toolkit)
- \`pages/storefronts/\` — Themes, Hydrogen (headless), mobile Checkout Kit
- \`pages/api/admin-graphql/latest/\` — Admin GraphQL API (queries, mutations, objects, enums)
- \`pages/api/admin-rest/\` — Admin REST API
- \`pages/api/storefront/\` — Storefront API (GraphQL)
- \`pages/api/customer/\` — Customer Account API
- \`pages/api/liquid/\` — Liquid template language reference
- \`pages/api/functions/\` — Shopify Functions
- \`pages/api/webhooks/\` — Webhooks
- \`pages/api/shopify-cli/\` — Shopify CLI
- \`pages/agents/\` — New 2026 Agents/AI/MCP docs

## For LLM consumption

Each \`content.md\` file has YAML frontmatter with title, description, api_version, and links to images via local relative paths. The \`llms.txt\` at the root is Shopify's own curated index — use it as a table of contents.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readme, 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n[FIM] ${processed} pages scraped in ${elapsed}s`);
  console.log(`      Total in archive: ${pageIndexMap.size}`);
  console.log(`      Images: ${imgCache.size}`);
  console.log(`      404s: ${errors404}`);
  console.log(`      Output: ${OUT_DIR}`);
})();

// Fetch missing pages from llms.txt that aren't in the sitemap
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'shopify-docs');
const PAGES_DIR = path.join(OUT_DIR, 'pages');
const IMAGES_DIR = path.join(OUT_DIR, 'images');
const INDEX_FILE = path.join(OUT_DIR, 'index.json');
const BASE = 'https://shopify.dev';

function urlToDiskPath(url) {
  const u = new URL(url, BASE);
  const rel = u.pathname.replace(/^\/docs\//, '').replace(/\.md$/, '').replace(/^\/+|\/+$/g, '');
  const segments = rel ? rel.split('/').map(s => s.replace(/[^\w.-]/g, '_')) : ['_root'];
  return path.join(PAGES_DIR, ...segments);
}

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

async function downloadImage(imgUrl) {
  try {
    if (!imgUrl.includes('cdn.shopify.com/shopifycloud/shopify-dev')) return null;
    const u = new URL(imgUrl);
    const filename = u.pathname.split('/').filter(Boolean).pop();
    if (!filename) return null;
    const fp = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(fp)) return filename;
    const res = await fetch(imgUrl);
    if (!res.ok) return null;
    ensureDir(IMAGES_DIR);
    fs.writeFileSync(fp, Buffer.from(await res.arrayBuffer()));
    return filename;
  } catch { return null; }
}

(async () => {
  // Parse llms.txt and extract all unique page paths
  const llms = fs.readFileSync(path.join(OUT_DIR, 'llms.txt'), 'utf-8');
  const urls = [...llms.matchAll(/https:\/\/shopify\.dev(\/[^)\s#]+)/g)]
    .map(m => {
      let p = m[1];
      p = p.replace(/\.md$/, '').replace(/\?.*$/, '').replace(/\/$/, '');
      // Normalize /api/ → /docs/api/, /apps/ → /docs/apps/
      if (p.startsWith('/api/')) p = '/docs' + p;
      if (p.startsWith('/apps/')) p = '/docs' + p;
      if (p.startsWith('/storefronts/')) p = '/docs' + p;
      return p;
    })
    .filter(p => p.startsWith('/docs/'));

  const unique = [...new Set(urls)];
  console.log(`[INFO] ${unique.length} unique paths in llms.txt`);

  // Load existing index
  const idx = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  const existing = new Set(idx.pages.map(p => p.path));
  const pageMap = new Map(idx.pages.map(p => [p.path, p]));

  const missing = unique.filter(p => !existing.has(p));
  console.log(`[INFO] ${missing.length} missing pages to fetch\n`);

  let success = 0;
  let failed = 0;

  for (const pathname of missing) {
    try {
      const mdUrl = `${BASE}${pathname}.md`;
      const res = await fetch(mdUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/markdown, text/plain, */*',
        },
      });
      if (!res.ok) {
        console.log(`[${res.status}] ${pathname}`);
        failed++;
        continue;
      }
      const md = await res.text();

      // Parse frontmatter
      let frontmatter = {};
      let body = md;
      const fmMatch = md.match(/^---\n([\s\S]*?)\n---\n/);
      if (fmMatch) {
        body = md.slice(fmMatch[0].length);
        fmMatch[1].split('\n').forEach(line => {
          const m = line.match(/^(\w+):\s*(.*)$/);
          if (m) frontmatter[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
        });
      }

      // Images
      const imgUrls = [...body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
        .map(m => m[1].split(' ')[0])
        .filter(u => u.includes('cdn.shopify.com'));

      const dir = urlToDiskPath(pathname);
      const depth = path.relative(PAGES_DIR, dir).split(path.sep).length;
      const relativeImagesPath = '../'.repeat(depth) + 'images';

      const imageMap = new Map();
      for (const imgUrl of imgUrls) {
        const fn = await downloadImage(imgUrl);
        if (fn) imageMap.set(imgUrl, fn);
      }

      // Rewrite images
      const localMd = md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, u) => {
        const clean = u.split(' ')[0];
        if (imageMap.has(clean)) return `![${alt}](${relativeImagesPath}/${imageMap.get(clean)})`;
        return full;
      });

      ensureDir(dir);
      fs.writeFileSync(path.join(dir, 'content.md'), localMd, 'utf-8');
      fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({
        url: `${BASE}${pathname}`,
        md_url: mdUrl,
        fetched_at: new Date().toISOString(),
        title: frontmatter.title || '',
        description: frontmatter.description || '',
        api_version: frontmatter.api_version || '',
        api_name: frontmatter.api_name || '',
        source_url: frontmatter.source_url || '',
        word_count: body.split(/\s+/).filter(Boolean).length,
        images: imgUrls.map(u => ({ url: u, local_path: imageMap.has(u) ? `${relativeImagesPath}/${imageMap.get(u)}` : null })),
        source: 'llms.txt (fallback)',
      }, null, 2), 'utf-8');

      pageMap.set(pathname, {
        path: pathname,
        title: frontmatter.title || '',
        description: frontmatter.description || '',
        section: pathname.split('/').filter(Boolean).slice(1, 3).join('/'),
        api_version: frontmatter.api_version || '',
        api_name: frontmatter.api_name || '',
        word_count: body.split(/\s+/).filter(Boolean).length,
        image_count: imgUrls.length,
      });

      success++;
      console.log(`[OK] ${frontmatter.title || pathname}`);
    } catch (err) {
      console.log(`[ERR] ${pathname}: ${err.message}`);
      failed++;
    }
  }

  // Update index.json
  idx.pages = [...pageMap.values()];
  idx.total_pages = idx.pages.length;
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf-8');

  const searchEntries = idx.pages.map(p => ({
    path: p.path, title: p.title, section: p.section,
    description: (p.description || '').substring(0, 200),
  }));
  fs.writeFileSync(path.join(OUT_DIR, 'search-index.json'),
    JSON.stringify(searchEntries, null, 2), 'utf-8');

  console.log(`\n[FIM] ${success} recovered, ${failed} failed`);
  console.log(`Total in archive: ${idx.pages.length}`);
})();

// ============================================================
// Reprocessa todos os index.html já salvos, regenerando
// content.md, content.txt, clean.html, metadata.json, etc.
// com a lógica atualizada (sem re-scrapear da Meta).
//
//   node reprocess_meta_docs.js
// ============================================================

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

const OUT_DIR = path.join(__dirname, 'meta-marketing-api');
const PAGES_DIR = path.join(OUT_DIR, 'pages');
const IMAGES_DIR = path.join(OUT_DIR, 'images');
const IMG_MANIFEST_FILE = path.join(IMAGES_DIR, '_manifest.json');

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

// Build an inverted imageMap: originalUrl -> localFilename from metadata.json
function buildImageMapFromMetadata(metadataPath) {
  try {
    const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const map = new Map();
    for (const img of meta.images || []) {
      if (img.url && img.local_path) {
        const filename = path.basename(img.local_path);
        map.set(img.url, filename);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function extractPage(html, url, imageMap, relativeImagesPath) {
  const $ = cheerio.load(html);

  // Clean version
  const $clean = cheerio.load(html);
  $clean('script, style, noscript, link[rel="preload"], iframe').remove();
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

  // Strip scripts/styles from main cheerio for markdown/text extraction
  $('script, style, noscript, link, meta, iframe').remove();

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
      .replace(/ - Documentation - Meta for Developers$/i, '')
      .trim();
  }

  // Breadcrumbs
  const breadcrumbs = [];
  $('nav[aria-label="Breadcrumb"] a, nav.breadcrumb a, .breadcrumb a').each((_, el) => {
    const t = $(el).text().trim();
    const h = $(el).attr('href') || '';
    if (t) breadcrumbs.push({ text: t, href: h });
  });

  // Headings
  const headings = [];
  $main.find('h1, h2, h3, h4').each((_, el) => {
    const tag = el.tagName || el.name;
    headings.push({
      level: parseInt(tag.replace('h', ''), 10),
      text: $(el).text().trim(),
      id: $(el).attr('id') || '',
    });
  });

  // Out-links
  const outLinks = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, url).toString();
      if (abs.includes('developers.facebook.com/docs/')) {
        outLinks.add(abs);
      }
    } catch {}
  });

  // Images
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

  // Sidebar
  const sidebar = [];
  $('nav[aria-label="Docs Navigation"] a, nav._9_7 a, ._9_7 a[href^="/docs/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (text && href.includes('/docs/')) sidebar.push({ text, href });
  });

  // Plain text
  const textContent = $main.text().replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  // Rewrite images in $main to local paths BEFORE turndown
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

  // Markdown
  let markdown = '';
  try {
    markdown = turndown.turndown($main.html() || '');
  } catch {
    markdown = textContent;
  }

  return {
    title, breadcrumbs, headings, outLinks: [...outLinks],
    images, codeSamples, tables, sidebar,
    textContent, wordCount, markdown, cleanHtml,
  };
}

function findAllIndexHtml(dir) {
  const results = [];
  function walk(current) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const fp = path.join(current, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name === 'index.html') results.push(fp);
    }
  }
  walk(dir);
  return results;
}

// Build global URL -> local filename map from manifest
function buildGlobalImageMap(manifest) {
  // manifest is { filename: [urls that reference it] }
  // We need the reverse: { lookasideUrl: filename }
  // But manifest only stores page URLs, not image URLs. So we need to scan metadata.json files.
  return new Map();
}

(async () => {
  const pages = findAllIndexHtml(PAGES_DIR);
  console.log(`[INFO] ${pages.length} pages to reprocess.\n`);

  const imgManifest = JSON.parse(fs.readFileSync(IMG_MANIFEST_FILE, 'utf-8'));

  // Build global imageMap from all existing metadata.json files (to reuse previous downloads)
  const globalImageMap = new Map();
  for (const indexFile of pages) {
    const dir = path.dirname(indexFile);
    const metaFile = path.join(dir, 'metadata.json');
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      for (const img of meta.images || []) {
        if (img.url) {
          // Derive filename from media_id + extension (guess .png since images were mostly png)
          const u = new URL(img.url);
          const mediaId = u.searchParams.get('media_id');
          if (mediaId) {
            // Find actual file in images/
            const matches = Object.keys(imgManifest).filter(f => f.startsWith(mediaId + '.'));
            if (matches.length) globalImageMap.set(img.url, matches[0]);
          }
        }
      }
    } catch {}
  }
  console.log(`[INFO] Global image map: ${globalImageMap.size} entries.\n`);

  let processed = 0;
  let errors = 0;

  for (const indexFile of pages) {
    const dir = path.dirname(indexFile);
    const rel = path.relative(PAGES_DIR, dir);
    const depth = rel.split(path.sep).length;
    const relativeImagesPath = '../'.repeat(depth) + 'images';

    try {
      const html = fs.readFileSync(indexFile, 'utf-8');
      const metaFile = path.join(dir, 'metadata.json');
      let url = '';
      try {
        url = JSON.parse(fs.readFileSync(metaFile, 'utf-8')).url || '';
      } catch {}

      const data = extractPage(html, url, globalImageMap, relativeImagesPath);

      fs.writeFileSync(path.join(dir, 'clean.html'), data.cleanHtml || '', 'utf-8');
      fs.writeFileSync(path.join(dir, 'content.md'), data.markdown || '', 'utf-8');
      fs.writeFileSync(path.join(dir, 'content.txt'), data.textContent || '', 'utf-8');
      fs.writeFileSync(
        path.join(dir, 'code-samples.json'),
        JSON.stringify(data.codeSamples, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(dir, 'tables.json'),
        JSON.stringify(data.tables, null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(dir, 'sidebar.json'),
        JSON.stringify(data.sidebar, null, 2),
        'utf-8'
      );

      // Update metadata.json preserving url/fetched_at
      let existingMeta = {};
      try { existingMeta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')); } catch {}
      const imagesWithLocal = data.images.map(img => ({
        ...img,
        local_path: globalImageMap.has(img.url) ? `${relativeImagesPath}/${globalImageMap.get(img.url)}` : null,
      }));
      fs.writeFileSync(metaFile, JSON.stringify({
        ...existingMeta,
        title: data.title,
        breadcrumbs: data.breadcrumbs,
        headings: data.headings,
        word_count: data.wordCount,
        out_links: data.outLinks,
        images: imagesWithLocal,
        code_sample_count: data.codeSamples.length,
        table_count: data.tables.length,
        reprocessed_at: new Date().toISOString(),
      }, null, 2), 'utf-8');

      processed++;
      if (processed % 100 === 0) {
        console.log(`[${processed}/${pages.length}] reprocessed`);
      }
    } catch (err) {
      errors++;
      console.log(`[ERR] ${rel}: ${err.message.substring(0, 80)}`);
    }
  }

  console.log(`\n[FIM] ${processed} pages reprocessed, ${errors} errors.`);
})();

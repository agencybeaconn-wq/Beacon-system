#!/usr/bin/env node
// clone-tokens — passo 6 do pipeline /clone-theme.
//
// Parse de todos _raw/<page>/page.css via postcss → extrai design tokens:
//   - colors (hex, rgb, rgba, hsl)
//   - fonts (font-family stacks únicos)
//   - font_sizes (type scale)
//   - spacing (padding/margin/gap valores únicos)
//   - border_radius
//   - breakpoints (@media min-width / max-width)
//
// Salva themes/clones/<slug>/_design/tokens.json
//
// Uso:
//   node clone-tokens.mjs <slug>

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Regex pra cores no CSS
const RE_HEX = /#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
const RE_RGB = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi;
const RE_RGB_MODERN = /rgba?\(\s*\d+\s+\d+\s+\d+\s*(?:\/\s*[\d.%]+\s*)?\)/gi;
const RE_HSL = /hsla?\(\s*\d+(?:deg)?\s*,?\s*[\d.]+%\s*,?\s*[\d.]+%\s*(?:[,/]\s*[\d.]+\s*)?\)/gi;

const COLOR_PROPS = new Set([
  'color', 'background', 'background-color', 'border', 'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline', 'outline-color', 'fill', 'stroke', 'box-shadow', 'text-shadow',
  'text-decoration-color', 'caret-color', 'accent-color',
]);

const SPACING_PROPS = new Set([
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'gap', 'row-gap', 'column-gap',
]);

const RADIUS_PROPS = new Set([
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
]);

function normalizeHex(hex) {
  let h = hex.toLowerCase().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 4) h = h.split('').map(c => c + c).join('').slice(0, 8);
  return '#' + h;
}

function extractColors(value) {
  const out = [];
  let m;
  while ((m = RE_HEX.exec(value)) !== null) out.push(normalizeHex(m[0]));
  RE_HEX.lastIndex = 0;
  while ((m = RE_RGB.exec(value)) !== null) out.push(m[0].replace(/\s+/g, ' '));
  RE_RGB.lastIndex = 0;
  while ((m = RE_RGB_MODERN.exec(value)) !== null) out.push(m[0].replace(/\s+/g, ' '));
  RE_RGB_MODERN.lastIndex = 0;
  while ((m = RE_HSL.exec(value)) !== null) out.push(m[0].replace(/\s+/g, ' '));
  RE_HSL.lastIndex = 0;
  return out;
}

function extractLengths(value) {
  // Captura "16px", "1.5rem", "8%", "1em" — não negativos por simplicidade
  const out = [];
  const re = /(?:^|\s|,|\()(\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh|pt))(?=\s|,|\)|$|;)/g;
  let m;
  while ((m = re.exec(value)) !== null) out.push(m[1]);
  return out;
}

function bumpFreq(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortByFreq(map, limit) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function findCssFiles(rawDir) {
  if (!fs.existsSync(rawDir)) return [];
  const out = [];
  for (const sub of fs.readdirSync(rawDir)) {
    const full = path.join(rawDir, sub);
    if (!fs.statSync(full).isDirectory()) continue;
    const css = path.join(full, 'page.css');
    if (fs.existsSync(css)) out.push({ source: sub, path: css });
  }
  return out;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Uso: node clone-tokens.mjs <slug>');
    process.exit(1);
  }

  console.log('\n=== clone-tokens ===');

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  const rawDir = path.join(workspace, '_raw');
  const designDir = path.join(workspace, '_design');

  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}. Rode clone-validate.mjs antes.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  const cssFiles = findCssFiles(rawDir);
  if (cssFiles.length === 0) {
    console.error(`Nenhum page.css encontrado em _raw/*/. Rode clone-scrape.mjs antes.`);
    process.exit(1);
  }
  console.log(`  ${cssFiles.length} arquivos CSS a parsear`);

  const colors = new Map();
  const fonts = new Map();
  const fontSizes = new Map();
  const fontWeights = new Map();
  const lineHeights = new Map();
  const spacing = new Map();
  const radii = new Map();
  const shadows = new Map();
  const breakpoints = new Map();
  const fontFaces = new Set();

  let totalBytes = 0;
  let totalDecls = 0;
  let parseErrors = 0;

  for (const file of cssFiles) {
    const cssText = fs.readFileSync(file.path, 'utf8');
    totalBytes += cssText.length;

    let root;
    try { root = postcss.parse(cssText); }
    catch (e) { parseErrors++; continue; }

    root.walkDecls(decl => {
      totalDecls++;
      const prop = decl.prop.toLowerCase();
      const value = decl.value;

      if (COLOR_PROPS.has(prop) || /-color$/.test(prop)) {
        for (const c of extractColors(value)) bumpFreq(colors, c);
      }
      if (prop === 'box-shadow' || prop === 'text-shadow') {
        for (const c of extractColors(value)) bumpFreq(colors, c);
        bumpFreq(shadows, value.replace(/\s+/g, ' ').slice(0, 120));
      }
      if (prop === 'font-family') {
        const fam = value.replace(/\s+/g, ' ').trim();
        bumpFreq(fonts, fam);
      }
      if (prop === 'font-size') {
        const lens = extractLengths(value);
        for (const l of lens) bumpFreq(fontSizes, l);
      }
      if (prop === 'font-weight') {
        bumpFreq(fontWeights, value.trim());
      }
      if (prop === 'line-height') {
        bumpFreq(lineHeights, value.trim());
      }
      if (SPACING_PROPS.has(prop)) {
        for (const l of extractLengths(value)) bumpFreq(spacing, l);
      }
      if (RADIUS_PROPS.has(prop)) {
        for (const l of extractLengths(value)) bumpFreq(radii, l);
      }
    });

    root.walkAtRules('media', atRule => {
      const params = atRule.params;
      const re = /(min-width|max-width)\s*:\s*([\d.]+(?:px|em|rem))/gi;
      let m;
      while ((m = re.exec(params)) !== null) bumpFreq(breakpoints, `${m[1]}:${m[2]}`);
    });

    root.walkAtRules('font-face', atRule => {
      let family = null, src = null;
      atRule.walkDecls(d => {
        if (d.prop === 'font-family') family = d.value.replace(/['"]/g, '').trim();
        if (d.prop === 'src') src = d.value;
      });
      if (family || src) fontFaces.add(JSON.stringify({ family, src: src ? src.slice(0, 200) : null }));
    });
  }

  // Detecta licença de fontes (heurística por hostname no @font-face src)
  const PAID_FONT_HOSTS = ['use.typekit.net', 'fonts.adobe.com', 'use.fontawesome.com', 'p.typekit.net'];
  const FREE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
  const fontFlags = { paid: [], free: [], unknown_self_hosted: [] };
  for (const ffJson of fontFaces) {
    const ff = JSON.parse(ffJson);
    if (!ff.src) continue;
    const hosts = (ff.src.match(/https?:\/\/([^/'"\s)]+)/g) || []).map(u => new URL(u).hostname);
    if (hosts.some(h => PAID_FONT_HOSTS.some(p => h.includes(p)))) {
      fontFlags.paid.push(ff);
    } else if (hosts.some(h => FREE_FONT_HOSTS.some(f => h.includes(f)))) {
      fontFlags.free.push(ff);
    } else {
      fontFlags.unknown_self_hosted.push(ff);
    }
  }

  const tokens = {
    extracted_at: new Date().toISOString(),
    sources: cssFiles.map(f => f.source),
    stats: {
      css_files: cssFiles.length,
      total_bytes: totalBytes,
      total_declarations: totalDecls,
      parse_errors: parseErrors,
    },
    colors: sortByFreq(colors, 50),
    fonts: sortByFreq(fonts, 20),
    font_sizes: sortByFreq(fontSizes, 30),
    font_weights: sortByFreq(fontWeights, 15),
    line_heights: sortByFreq(lineHeights, 15),
    spacing: sortByFreq(spacing, 40),
    border_radius: sortByFreq(radii, 15),
    shadows: sortByFreq(shadows, 10),
    breakpoints: sortByFreq(breakpoints, 10),
    font_face: {
      total: fontFaces.size,
      paid: fontFlags.paid,
      free: fontFlags.free,
      unknown_self_hosted: fontFlags.unknown_self_hosted,
    },
  };

  if (!fs.existsSync(designDir)) fs.mkdirSync(designDir, { recursive: true });
  fs.writeFileSync(path.join(designDir, 'tokens.json'), JSON.stringify(tokens, null, 2), 'utf8');

  // Resumo no terminal
  console.log(`\n  CSS parseado: ${(totalBytes / 1024).toFixed(1)}kb em ${cssFiles.length} files, ${totalDecls} declarations`);
  console.log(`  Cores:        ${tokens.colors.length} únicas  (top 5: ${tokens.colors.slice(0, 5).map(c => c.value).join(', ')})`);
  console.log(`  Fontes:       ${tokens.fonts.length} stacks  (top 3: ${tokens.fonts.slice(0, 3).map(f => f.value.split(',')[0]).join(', ')})`);
  console.log(`  Font sizes:   ${tokens.font_sizes.length} valores`);
  console.log(`  Spacing:      ${tokens.spacing.length} valores`);
  console.log(`  Border-radius:${tokens.border_radius.length} valores`);
  console.log(`  Breakpoints:  ${tokens.breakpoints.length}  (${tokens.breakpoints.map(b => b.value).join(', ')})`);
  console.log(`  @font-face:   ${tokens.font_face.total}  (paid=${fontFlags.paid.length}, free=${fontFlags.free.length}, self-hosted=${fontFlags.unknown_self_hosted.length})`);

  if (fontFlags.paid.length > 0) {
    console.log(`\n  ⚠️  ATENÇÃO — ${fontFlags.paid.length} fonte(s) paga(s) detectada(s):`);
    for (const f of fontFlags.paid) console.log(`     - ${f.family}`);
    console.log(`     Substituir por fallback livre na Fase 2.`);
  }

  meta.phase = 'tokens_extracted';
  meta.updated_at = new Date().toISOString();
  meta.tokens_summary = {
    colors: tokens.colors.length,
    fonts: tokens.fonts.length,
    font_sizes: tokens.font_sizes.length,
    spacing: tokens.spacing.length,
    breakpoints: tokens.breakpoints.length,
    paid_fonts: fontFlags.paid.length,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`\n✓ Tokens salvos em _design/tokens.json`);
  console.log(`\nFase 1 completa. Inspecione:`);
  console.log(`   - themes/clones/${slug}/_raw/discovery.json`);
  console.log(`   - themes/clones/${slug}/_raw/<page>/{index.html, page.css, screenshot.png, assets.json}`);
  console.log(`   - themes/clones/${slug}/_design/tokens.json\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

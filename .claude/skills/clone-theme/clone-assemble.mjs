#!/usr/bin/env node
// clone-assemble — passo 6 do pipeline /clone-theme.
//
// Forka o Dawn (tema oficial Shopify, MIT-licensed) e injeta os tokens
// extraídos do alvo (paleta, fontes Google) sobre a estrutura Dawn.
//
// Mantém Dawn intacto — adiciona apenas:
//   - assets/clone-base.css         (CSS vars com tokens)
//   - assets/clone-fonts.css        (Google Fonts import)
//   - snippets/clone-tokens.liquid  (inclui os CSS acima no <head>)
//   - patch em layout/theme.liquid  (renderiza o snippet acima)
//   - update em config/settings_data.json (nome do tema)
//
// Uso:
//   node clone-assemble.mjs <slug> [--refresh-dawn]

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DAWN_CACHE = path.join(os.homedir(), '.claude-cache', 'dawn');
const DAWN_REPO = 'https://github.com/Shopify/dawn.git';
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Lista de templates premium copiados literalmente pro workspace (battle-tested no Mont Royal).
// São aditivos — não sobrescrevem nada do Dawn existente.
const PREMIUM_TEMPLATES = [
  ['snippets/clone-cart-drawer.liquid',     'snippets/clone-cart-drawer.liquid'],
  ['assets/clone-cart.js',                  'assets/clone-cart.js'],
  ['assets/clone-storefront.js',            'assets/clone-storefront.js'],
  ['assets/clone-header.js',                'assets/clone-header.js'],
  ['assets/clone-baseline.css',             'assets/clone-baseline.css'],
  ['sections/clone-product-grid.liquid',    'sections/clone-product-grid.liquid'],
  ['sections/clone-product-main.liquid',    'sections/clone-product-main.liquid'],
  ['sections/clone-reviews.liquid',         'sections/clone-reviews.liquid'],
];

function parseArgs() {
  const args = { slug: null, refreshDawn: false };
  for (const a of process.argv.slice(2)) {
    if (a === '--refresh-dawn') args.refreshDawn = true;
    else if (!a.startsWith('--')) args.slug = a;
  }
  return args;
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
}

function ensureDawn(refresh) {
  if (refresh && fs.existsSync(DAWN_CACHE)) {
    console.log(`  [dawn] --refresh-dawn → removendo cache`);
    fs.rmSync(DAWN_CACHE, { recursive: true, force: true });
  }
  if (!fs.existsSync(DAWN_CACHE)) {
    fs.mkdirSync(path.dirname(DAWN_CACHE), { recursive: true });
    console.log(`  [dawn] clonando Shopify/dawn → ${DAWN_CACHE} (1x, ~5MB)`);
    run(`git clone --depth=1 ${DAWN_REPO} "${DAWN_CACHE}"`);
  } else {
    try {
      console.log(`  [dawn] cache existe — git pull`);
      run(`git -C "${DAWN_CACHE}" pull --ff-only`);
    } catch (e) {
      console.log(`  [dawn] git pull falhou (offline?) — usando cache atual`);
    }
  }
  // Conta arquivos
  const count = parseInt(run(`find "${DAWN_CACHE}" -type f -not -path "*/.git/*" | wc -l`));
  console.log(`  [dawn] ${count} arquivos no fork`);
  return count;
}

function copyDawnTo(workspace) {
  const PRESERVE = new Set(['_raw', '_design', '_preview', '.clone-meta.json']);
  console.log(`  [copy] Dawn → ${workspace}`);
  let copied = 0;
  function walk(srcDir, dstDir) {
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === '.github') continue;
      const src = path.join(srcDir, entry.name);
      const dst = path.join(dstDir, entry.name);
      if (entry.isDirectory()) {
        walk(src, dst);
      } else {
        fs.copyFileSync(src, dst);
        copied++;
      }
    }
  }
  // Só copia se o destino top-level não está em PRESERVE
  for (const entry of fs.readdirSync(DAWN_CACHE, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.github') continue;
    if (PRESERVE.has(entry.name)) continue;
    const src = path.join(DAWN_CACHE, entry.name);
    const dst = path.join(workspace, entry.name);
    if (entry.isDirectory()) walk(src, dst);
    else { fs.copyFileSync(src, dst); copied++; }
  }
  console.log(`  [copy] ${copied} arquivos copiados`);
  return copied;
}

function pickPrimaryColors(colorsList) {
  const neutralRe = /^(#000000|#ffffff|rgb\(0, 0, 0\)|rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0(\.\d+)?\)|rgba\(255, 255, 255, 0(\.\d+)?\))$/i;
  const branded = colorsList.filter(c => !neutralRe.test(c.value) && !c.value.includes('rgba(0, 0, 0,') && !c.value.includes('rgba(255, 255, 255,'));
  return {
    foreground: '#000000',
    background: '#ffffff',
    primary: branded[0]?.value || '#1a1a1a',
    secondary: branded[1]?.value || '#666666',
    accent: branded[2]?.value || '#cccccc',
    palette: colorsList.slice(0, 16).map(c => c.value),
  };
}

function pickFonts(fontsList) {
  const generic = /^(inherit|initial|unset|system-ui|-apple-system|sans-serif|serif|monospace)$/i;
  const named = fontsList.filter(f => {
    const first = f.value.split(',')[0].replace(/['"]/g, '').trim();
    return !generic.test(first);
  });
  const body = named[0]?.value.split(',')[0].replace(/['"]/g, '').trim() || 'system-ui';
  const heading = (named[1]?.value || named[0]?.value || 'system-ui').split(',')[0].replace(/['"]/g, '').trim();
  return { body, heading };
}

function googleFontsUrl(fonts) {
  const list = [...new Set([fonts.body, fonts.heading])].filter(f => f && !/system|apple|sans|serif|mono/i.test(f));
  if (!list.length) return null;
  const families = list.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function writeCloneAssets(workspace, colors, fonts, fontsUrl) {
  const assetsDir = path.join(workspace, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  // clone-fonts.css — apenas o @import do Google Fonts (se aplicável)
  if (fontsUrl) {
    fs.writeFileSync(path.join(assetsDir, 'clone-fonts.css'), `@import url('${fontsUrl}');\n`, 'utf8');
  }

  // clone-base.css — CSS vars com tokens extraídos, aplicadas sobre o Dawn
  const css = `/* clone-theme — tokens extraídos do alvo, aplicados sobre Dawn */

:root {
  --clone-color-foreground: ${colors.foreground};
  --clone-color-background: ${colors.background};
  --clone-color-primary: ${colors.primary};
  --clone-color-secondary: ${colors.secondary};
  --clone-color-accent: ${colors.accent};
  --clone-color-border: rgba(0, 0, 0, 0.08);
  --clone-color-muted: #f5f5f5;

  --clone-font-body: '${fonts.body}', system-ui, -apple-system, sans-serif;
  --clone-font-heading: '${fonts.heading}', '${fonts.body}', system-ui, serif;

  /* Override Dawn's CSS vars onde fizer sentido */
  --color-foreground: 0, 0, 0;
  --color-background: 255, 255, 255;
}

/* Aplica fontes no body e headings sobre Dawn */
body { font-family: var(--clone-font-body); }
h1, h2, h3, h4, h5, h6,
.h0, .h1, .h2, .h3, .h4, .h5, .h6,
.product__title, .card__heading, .section-header__title {
  font-family: var(--clone-font-heading);
}

/* Sections custom do clone-theme */
.clone-hero { background: var(--clone-color-foreground); color: var(--clone-color-background); }
.clone-hero__eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; opacity: 0.7; }
.clone-hero__title { font-family: var(--clone-font-heading); letter-spacing: -0.02em; line-height: 1.1; }
.clone-hero__btn { display: inline-block; padding: 12px 32px; border: 1px solid currentColor; text-transform: uppercase; letter-spacing: 0.08em; font-size: 13px; transition: opacity 0.2s; }
.clone-hero__btn:hover { opacity: 0.85; }
.clone-hero__btn--primary { background: var(--clone-color-background); color: var(--clone-color-foreground); }
.clone-hero__btn--ghost { background: transparent; color: var(--clone-color-background); }

.clone-features { padding: 48px 0; }
.clone-features__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 32px; }
.clone-features__item { text-align: center; }
.clone-features__icon { font-size: 28px; color: var(--clone-color-primary); margin-bottom: 12px; }
.clone-features__heading { font-size: 18px; margin-bottom: 8px; font-family: var(--clone-font-heading); }
.clone-features__body { color: var(--clone-color-secondary); font-size: 14px; }

.clone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.clone-grid__card { background: var(--clone-color-background); border: 1px solid var(--clone-color-border); border-radius: 6px; overflow: hidden; transition: border-color 0.2s; }
.clone-grid__card:hover { border-color: var(--clone-color-foreground); }
.clone-grid__media { aspect-ratio: 4/5; background: var(--clone-color-muted); overflow: hidden; }
.clone-grid__media img { width: 100%; height: 100%; object-fit: cover; }
.clone-grid__info { padding: 12px 14px 16px; }
.clone-grid__title { font-family: var(--clone-font-body); font-weight: 500; font-size: 15px; margin-bottom: 4px; }
.clone-grid__price { font-size: 14px; color: var(--clone-color-primary); font-weight: 600; }

.clone-page-content { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
.clone-page-content h1 { font-size: 40px; letter-spacing: -0.02em; margin-bottom: 24px; }
.clone-page-content h2 { font-size: 24px; margin: 32px 0 16px; }
.clone-page-content p { margin-bottom: 16px; line-height: 1.7; }
.clone-page-content blockquote { border-left: 3px solid var(--clone-color-primary); padding: 16px 20px; margin: 24px 0; color: var(--clone-color-secondary); font-style: italic; }
`;
  fs.writeFileSync(path.join(assetsDir, 'clone-base.css'), css, 'utf8');
  console.log(`  [tokens] clone-base.css + clone-fonts.css escritos em assets/`);
}

function writeCloneSnippet(workspace, fontsUrl) {
  const snippetsDir = path.join(workspace, 'snippets');
  if (!fs.existsSync(snippetsDir)) fs.mkdirSync(snippetsDir, { recursive: true });
  const liquid = `{%- comment -%}
  clone-theme — injeta tokens (paleta + fontes Google) sobre Dawn.
  Renderize este snippet em layout/theme.liquid antes de </head>.
{%- endcomment -%}
${fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{{ 'clone-fonts.css' | asset_url | stylesheet_tag }}` : ''}
{{ 'clone-base.css' | asset_url | stylesheet_tag }}
`;
  fs.writeFileSync(path.join(snippetsDir, 'clone-tokens.liquid'), liquid, 'utf8');
  console.log(`  [tokens] snippets/clone-tokens.liquid escrito`);
}

function patchThemeLiquid(workspace) {
  const themePath = path.join(workspace, 'layout', 'theme.liquid');
  if (!fs.existsSync(themePath)) {
    console.log(`  [patch] layout/theme.liquid não existe — skip`);
    return false;
  }
  let content = fs.readFileSync(themePath, 'utf8');
  const marker = `{%- render 'clone-tokens' -%}`;
  if (content.includes(marker)) {
    console.log(`  [patch] theme.liquid já tem clone-tokens — skip`);
    return false;
  }
  // Insere antes de </head>
  const newContent = content.replace(/<\/head>/i, `  ${marker}\n  </head>`);
  if (newContent === content) {
    console.log(`  [patch] não achei </head> em theme.liquid — append antes do fim`);
    fs.writeFileSync(themePath, content + `\n${marker}\n`, 'utf8');
    return true;
  }
  fs.writeFileSync(themePath, newContent, 'utf8');
  console.log(`  [patch] inserido render 'clone-tokens' antes de </head>`);
  return true;
}

function updateSettingsData(workspace, themeName, fonts) {
  // Dawn usa formato preset-based:
  //   { "current": "Default" | { ...settings }, "presets": { "Default": { ... } } }
  // Quando 'current' é string, settings vivem em presets[current].
  const sdPath = path.join(workspace, 'config', 'settings_data.json');
  if (!fs.existsSync(sdPath)) {
    console.log(`  [settings] settings_data.json não existe — skip`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(sdPath, 'utf8'));
  // Resolve onde escrever
  let target;
  if (typeof data.current === 'string') {
    if (!data.presets) data.presets = {};
    if (!data.presets[data.current]) data.presets[data.current] = {};
    target = data.presets[data.current];
  } else if (data.current && typeof data.current === 'object') {
    target = data.current;
  } else {
    data.current = {};
    target = data.current;
  }
  // Dawn não tem campo `theme_name` no settings_schema — não inventar.
  // Apenas registra os tokens aplicados pra debug (são ignorados pelo Dawn mas
  // ficam visíveis no JSON pra inspeção humana).
  target['_clone_theme_meta'] = {
    name: themeName,
    body_font: fonts.body,
    heading_font: fonts.heading,
    applied_at: new Date().toISOString(),
  };
  fs.writeFileSync(sdPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  [settings] _clone_theme_meta gravado em current preset ("${typeof data.current === 'string' ? data.current : 'inline'}")`);
}

// ============================================================
// PREMIUM TEMPLATES — features ecommerce battle-tested (Mont Royal)
// ============================================================

function copyPremiumTemplates(workspace) {
  let copied = 0, skipped = 0;
  for (const [src, dst] of PREMIUM_TEMPLATES) {
    const srcPath = path.join(TEMPLATES_DIR, src);
    const dstPath = path.join(workspace, dst);
    if (!fs.existsSync(srcPath)) { console.log(`  [premium] template não existe: ${src}`); continue; }
    const dstDir = path.dirname(dstPath);
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    // Se já existe (re-run), pula pra não sobrescrever ajustes manuais
    if (fs.existsSync(dstPath)) { skipped++; continue; }
    fs.copyFileSync(srcPath, dstPath);
    copied++;
  }
  console.log(`  [premium] ${copied} templates copiados, ${skipped} preservados (já existiam)`);
}

function appendBaselineCss(workspace) {
  // Concatena clone-baseline.css ao final do clone-base.css
  // pra garantir que defensive rules + cards canonical sobrescrevem Dawn defaults.
  const basePath = path.join(workspace, 'assets', 'clone-base.css');
  const baselinePath = path.join(TEMPLATES_DIR, 'assets', 'clone-baseline.css');
  if (!fs.existsSync(basePath)) { console.log(`  [baseline] clone-base.css não existe — skip`); return; }
  if (!fs.existsSync(baselinePath)) { console.log(`  [baseline] template baseline não existe — skip`); return; }
  let css = fs.readFileSync(basePath, 'utf8');
  if (css.includes('/* BASELINE DEFENSIVO')) {
    console.log(`  [baseline] já apendado — skip`);
    return;
  }
  const baseline = fs.readFileSync(baselinePath, 'utf8');
  fs.writeFileSync(basePath, css + '\n\n' + baseline, 'utf8');
  console.log(`  [baseline] +${baseline.split('\n').length} linhas apendadas no clone-base.css`);
}

function writeOptimizedTokensSnippet(workspace, fonts, fontsUrl) {
  // Substitui o snippets/clone-tokens.liquid pela versão com performance baseline:
  // preconnect cdn.shopify.com + fonts via <link> (não @import) + preload CSS principal.
  const snippetPath = path.join(workspace, 'snippets', 'clone-tokens.liquid');
  const fontsLink = fontsUrl
    ? `<link rel="preload" as="style" href="${fontsUrl}">\n<link rel="stylesheet" href="${fontsUrl}" media="print" onload="this.media='all'">\n<noscript><link rel="stylesheet" href="${fontsUrl}"></noscript>`
    : '<!-- nenhuma fonte Google detectada -->';
  const liquid = `{%- comment -%}
  clone-theme — tokens (paleta + fontes Google + preconnect) sobre Dawn.
  Renderize antes de </head>. Otimizado pra carga paralela e LCP rápido.
{%- endcomment -%}
{%- comment -%} Preconnect aos CDNs críticos {%- endcomment -%}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
<link rel="dns-prefetch" href="https://cdn.shopify.com">

{%- comment -%} Fontes Google em <link> paralelo (não @import — bloqueia render) {%- endcomment -%}
${fontsLink}

{%- comment -%} CSS principal do tema com preload (high priority) {%- endcomment -%}
{{ 'clone-base.css' | asset_url | stylesheet_tag: preload: true }}
`;
  fs.writeFileSync(snippetPath, liquid, 'utf8');

  // Limpa o @import do clone-fonts.css (agora as fontes vêm via <link>)
  const fontsPath = path.join(workspace, 'assets', 'clone-fonts.css');
  if (fs.existsSync(fontsPath)) {
    fs.writeFileSync(fontsPath, `/* Fontes carregadas via <link> no clone-tokens.liquid (paralelo, não bloqueia render). */\n`, 'utf8');
  }
  console.log(`  [tokens] clone-tokens.liquid otimizado (preconnect cdn.shopify.com + fonts paralelas + preload CSS)`);
}

function patchHeaderSettings(workspace) {
  // Apenda settings "Cores customizadas (Lever)" no schema do sections/header.liquid +
  // injeta CSS vars no <style> da section pra alimentar var(--clone-header-*) do baseline.
  const headerPath = path.join(workspace, 'sections', 'header.liquid');
  if (!fs.existsSync(headerPath)) { console.log(`  [header-settings] header.liquid não existe — skip`); return; }
  let content = fs.readFileSync(headerPath, 'utf8');
  if (content.includes('--clone-header-bg')) { console.log(`  [header-settings] já aplicado — skip`); return; }

  // Injeta CSS vars dentro do {%- style -%} existente (ou cria novo)
  const styleInject = `{%- style -%}
  :root {
    --clone-header-bg: {{ section.settings.header_bg_color | default: '#1b2a26' }};
    --clone-header-text: {{ section.settings.header_text_color | default: '#ffffff' }};
    --clone-header-dropdown-bg: {{ section.settings.header_dropdown_bg | default: '#1b2a26' }};
    --clone-header-dropdown-text: {{ section.settings.header_dropdown_text | default: '#ffffff' }};
  }
  {%- if section.settings.transparent_on_home == false -%}
    body.template-index .section-header,
    body.template-index .section-header .header-wrapper {
      background: var(--clone-header-bg) !important;
      background-color: var(--clone-header-bg) !important;
    }
  {%- endif -%}
{%- endstyle -%}

`;
  // Insere antes do primeiro {%- style -%} ou no início do arquivo
  if (content.match(/{%-?\s*style\s*-?%}/)) {
    content = content.replace(/({%-?\s*style\s*-?%})/, styleInject + '$1');
  } else {
    content = styleInject + content;
  }

  // Apenda settings no schema (antes do "spacing" header ou no fim do settings array)
  const newSettings = `    {
      "type": "header",
      "content": "Cores customizadas (Lever)"
    },
    {
      "type": "checkbox",
      "id": "transparent_on_home",
      "default": true,
      "label": "Header transparente sobre banner (home)",
      "info": "No topo da home, o header fica transparente até o usuário rolar."
    },
    {
      "type": "color",
      "id": "header_bg_color",
      "label": "Cor de fundo (sticky/mobile)",
      "default": "#1b2a26"
    },
    {
      "type": "color",
      "id": "header_text_color",
      "label": "Cor do texto e ícones",
      "default": "#ffffff"
    },
    {
      "type": "color",
      "id": "header_dropdown_bg",
      "label": "Cor de fundo dos dropdowns do menu",
      "default": "#1b2a26"
    },
    {
      "type": "color",
      "id": "header_dropdown_text",
      "label": "Cor do texto dos dropdowns",
      "default": "#ffffff"
    },
`;
  // Tenta inserir antes do bloco "header__1.content" (cores Dawn) ou de "spacing"
  const insertMarker = content.match(/{\s*\n\s*"type":\s*"header",\s*\n\s*"content":\s*"t:sections\.all\.spacing"/);
  if (insertMarker) {
    content = content.replace(insertMarker[0], newSettings + '    ' + insertMarker[0]);
  } else {
    // Fallback: insere antes do "blocks" do schema
    content = content.replace(/(\n\s*\],?\n\s*"blocks":)/, `,\n${newSettings.trimEnd()}\n  ]$1`.replace(/^,/, ''));
  }
  fs.writeFileSync(headerPath, content, 'utf8');
  console.log(`  [header-settings] 5 settings de cor + CSS vars injetadas em header.liquid`);
}

function patchAnnouncementBarSettings(workspace) {
  const p = path.join(workspace, 'sections', 'announcement-bar.liquid');
  if (!fs.existsSync(p)) { console.log(`  [announcement-settings] não existe — skip`); return; }
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('--clone-announcement-bg')) { console.log(`  [announcement-settings] já aplicado — skip`); return; }

  const styleInject = `{%- style -%}
  :root {
    --clone-announcement-bg: {{ section.settings.announcement_bg_color | default: '#000000' }};
    --clone-announcement-text: {{ section.settings.announcement_text_color | default: '#ffffff' }};
  }
{%- endstyle -%}

`;
  if (content.match(/{%-?\s*style\s*-?%}/)) {
    content = content.replace(/({%-?\s*style\s*-?%})/, styleInject + '$1');
  } else {
    content = styleInject + content;
  }

  const newSettings = `    {
      "type": "header",
      "content": "Cores customizadas (Lever)"
    },
    {
      "type": "color",
      "id": "announcement_bg_color",
      "label": "Cor de fundo",
      "default": "#000000"
    },
    {
      "type": "color",
      "id": "announcement_text_color",
      "label": "Cor do texto",
      "default": "#ffffff"
    },
`;
  // Insere após o color_scheme (Dawn default) ou no fim do settings
  const after = content.match(/{\s*\n\s*"type":\s*"color_scheme",\s*\n\s*"id":\s*"color_scheme"[\s\S]*?\},?\n/);
  if (after) {
    content = content.replace(after[0], after[0] + newSettings);
  } else {
    content = content.replace(/(\n\s*\],?\n\s*"blocks":)/, `,\n${newSettings.trimEnd()}\n  ]$1`.replace(/^,/, ''));
  }
  fs.writeFileSync(p, content, 'utf8');
  console.log(`  [announcement-settings] 2 settings de cor + CSS vars injetadas em announcement-bar.liquid`);
}

function patchFooterSettings(workspace) {
  const p = path.join(workspace, 'sections', 'footer.liquid');
  if (!fs.existsSync(p)) { console.log(`  [footer-settings] não existe — skip`); return; }
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('--clone-footer-bg')) { console.log(`  [footer-settings] já aplicado — skip`); return; }

  const styleInject = `{%- style -%}
  :root {
    --clone-footer-bg: {{ section.settings.footer_bg_color | default: '#1b2a26' }};
    --clone-footer-text: {{ section.settings.footer_text_color | default: '#cfd6d3' }};
    --clone-footer-heading: {{ section.settings.footer_heading_color | default: '#ffffff' }};
    --clone-footer-border: {{ section.settings.footer_border_color | default: '#26312d' }};
  }
  .footer,
  .footer.color-scheme-1,
  .footer.color-scheme-1.gradient {
    background: var(--clone-footer-bg) !important;
    background-color: var(--clone-footer-bg) !important;
    background-image: none !important;
    border-top: 1px solid var(--clone-footer-border) !important;
  }
  .footer, .footer a, .footer .footer-block__details-content,
  .footer .list-menu__item--link, .footer__copyright, .footer__copyright a {
    color: var(--clone-footer-text) !important;
  }
  .footer .footer-block__heading, .footer h2 {
    color: var(--clone-footer-heading) !important;
  }
{%- endstyle -%}

`;
  if (content.match(/{%-?\s*style\s*-?%}/)) {
    content = content.replace(/({%-?\s*style\s*-?%})/, styleInject + '$1');
  } else {
    content = styleInject + content;
  }

  const newSettings = `    {
      "type": "header",
      "content": "Cores customizadas (Lever)"
    },
    {
      "type": "color",
      "id": "footer_bg_color",
      "label": "Cor de fundo",
      "default": "#1b2a26"
    },
    {
      "type": "color",
      "id": "footer_text_color",
      "label": "Cor do texto e links",
      "default": "#cfd6d3"
    },
    {
      "type": "color",
      "id": "footer_heading_color",
      "label": "Cor dos títulos dos blocos",
      "default": "#ffffff"
    },
    {
      "type": "color",
      "id": "footer_border_color",
      "label": "Cor da borda superior",
      "default": "#26312d"
    },
`;
  const after = content.match(/{\s*\n\s*"type":\s*"color_scheme",\s*\n\s*"id":\s*"color_scheme"[\s\S]*?\},?\n/);
  if (after) {
    content = content.replace(after[0], after[0] + newSettings);
  } else {
    content = content.replace(/(\n\s*\],?\n\s*"default":)/, `,\n${newSettings.trimEnd()}\n  ]$1`.replace(/^,/, ''));
  }
  fs.writeFileSync(p, content, 'utf8');
  console.log(`  [footer-settings] 4 settings de cor + CSS vars injetadas em footer.liquid`);
}

function injectPremiumScripts(workspace) {
  // Apenda <script> tags do clone-storefront.js / clone-cart.js / clone-header.js
  // no layout/theme.liquid, antes de </body>. E renderiza o cart drawer.
  const themePath = path.join(workspace, 'layout', 'theme.liquid');
  if (!fs.existsSync(themePath)) { console.log(`  [premium-scripts] theme.liquid não existe — skip`); return; }
  let content = fs.readFileSync(themePath, 'utf8');
  if (content.includes('clone-storefront.js')) { console.log(`  [premium-scripts] já aplicado — skip`); return; }

  const inject = `    <script>
      window.CLONE_BOGO_CODE  = {{ settings.clone_bogo_discount_code | default: '' | json }};
      window.CLONE_BOGO_LABEL = {{ settings.clone_bogo_discount_label | default: '' | json }};
      window.CLONE_SHIPPING_VARIANT_ID = {{ settings.clone_shipping_protection_variant_id | default: '' | json }};
      window.CLONE_MONEY_FORMAT = {{ shop.money_format | json }};
      window.CLONE_UPSELL_ENABLED = {{ settings.clone_upsell_enabled | default: true | json }};
      window.CLONE_UPSELL_COLLECTION = {{ settings.clone_upsell_collection | default: '' | json }};
      window.CLONE_UPSELL_AUTOMATCH = {{ settings.clone_upsell_auto_match | default: true | json }};
    </script>
    <script src="{{ 'clone-storefront.js' | asset_url }}" defer="defer"></script>
    <script src="{{ 'clone-cart.js' | asset_url }}" defer="defer"></script>
    <script src="{{ 'clone-header.js' | asset_url }}" defer="defer"></script>
    {%- render 'clone-cart-drawer' -%}
`;
  // Insere logo após o <body ...>
  const newContent = content.replace(/(<body[^>]*>\s*\n)/, `$1${inject}`);
  if (newContent === content) {
    console.log(`  [premium-scripts] não achei <body> em theme.liquid — append manual`);
    fs.writeFileSync(themePath, content + '\n' + inject, 'utf8');
  } else {
    fs.writeFileSync(themePath, newContent, 'utf8');
  }
  console.log(`  [premium-scripts] 3 scripts + cart drawer renderizados em theme.liquid`);
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-assemble ===');

  if (!args.slug) {
    console.error('Uso: node clone-assemble.mjs <slug> [--refresh-dawn]');
    process.exit(1);
  }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  if (!fs.existsSync(metaPath)) {
    console.error(`Não achei ${metaPath}.`);
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(path.join(workspace, '_design', 'tokens.json'), 'utf8'));

  // 1. Dawn fork
  ensureDawn(args.refreshDawn);
  // 2. Copy Dawn pra workspace
  copyDawnTo(workspace);

  // 3. Tokens
  const colors = pickPrimaryColors(tokens.colors);
  const fonts = pickFonts(tokens.fonts);
  const fontsUrl = googleFontsUrl(fonts);
  console.log(`  [tokens] primary=${colors.primary}, fonts=${fonts.body}/${fonts.heading}`);

  // 4. Write assets + snippet + patch layout
  writeCloneAssets(workspace, colors, fonts, fontsUrl);
  writeCloneSnippet(workspace, fontsUrl);
  patchThemeLiquid(workspace);
  updateSettingsData(workspace, meta.theme_name, fonts);

  // 5. PREMIUM — templates battle-tested + baseline CSS + performance + settings modulares
  console.log(`\n--- Aplicando camada PREMIUM (Lucky Fours-grade) ---`);
  copyPremiumTemplates(workspace);
  appendBaselineCss(workspace);
  writeOptimizedTokensSnippet(workspace, fonts, fontsUrl);
  patchHeaderSettings(workspace);
  patchAnnouncementBarSettings(workspace);
  patchFooterSettings(workspace);
  injectPremiumScripts(workspace);

  // Update meta
  meta.phase = 'assembled';
  meta.updated_at = new Date().toISOString();
  meta.assembly = {
    dawn_source: 'Shopify/dawn',
    tokens_applied: { primary: colors.primary, body_font: fonts.body, heading_font: fonts.heading },
    google_fonts_url: fontsUrl,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`\n✓ Dawn fork + tokens aplicados em themes/clones/${args.slug}/`);
  console.log(`\n  Próximo: gerar sections customizadas (eu in-conversation lendo _raw/) +`);
  console.log(`           node clone-package.mjs ${args.slug}\n`);
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

#!/usr/bin/env node
// clone-preview — passo 9 do pipeline (modo offline, sem Shopify).
//
// Gera `_preview/` com HTML estático demo pra cada page-type usando os tokens
// extraídos (paleta + fontes + spacing) e um dashboard `index.html` com
// comparação side-by-side: render do clone (iframe) vs screenshot do alvo (img).
//
// Foco do MVP: provar que a paleta/fontes/estrutura extraídas batem com o alvo,
// SEM precisar de Dawn fork, Liquid engine ou loja Shopify.
//
// Uso:
//   node clone-preview.mjs <slug>          # gera _preview/ e mostra URL pra abrir
//   node clone-preview.mjs <slug> --serve  # acima + sobe npx serve em background

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseArgs() {
  const args = { slug: null, serve: false, port: 4173 };
  for (const a of process.argv.slice(2)) {
    if (a === '--serve') args.serve = true;
    else if (a.startsWith('--port=')) args.port = parseInt(a.slice(7));
    else if (!a.startsWith('--')) args.slug = a;
  }
  return args;
}

function pickPrimaryColors(colors) {
  // Filtra brancos/pretos puros e transparentes — pega cores "de marca"
  const neutralRe = /^(#000000|#ffffff|#fff|#000|rgb\(0, 0, 0\)|rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0(\.\d+)?\)|rgba\(255, 255, 255, 0(\.\d+)?\)|#0000(00)?[0-9a-f]{0,2}|#ffff(ff)?[0-9a-f]{0,2})$/i;
  const branded = colors.filter(c => !neutralRe.test(c.value) && !c.value.includes('rgba(0, 0, 0,') && !c.value.includes('rgba(255, 255, 255,'));
  return {
    foreground: '#000000',
    background: '#ffffff',
    primary: branded[0]?.value || '#1a1a1a',
    secondary: branded[1]?.value || '#666666',
    accent: branded.find(c => c.value !== branded[0]?.value)?.value || '#cccccc',
    palette: colors.slice(0, 16).map(c => c.value),
  };
}

function pickFonts(fonts) {
  // Top font = body, segundo distinto = heading. Tira 'inherit', '-apple-system' genéricos
  const generic = /^(inherit|initial|unset|system-ui|-apple-system|sans-serif|serif|monospace)$/i;
  const named = fonts.filter(f => {
    const first = f.value.split(',')[0].replace(/['"]/g, '').trim();
    return !generic.test(first);
  });
  const body = named[0]?.value.split(',')[0].replace(/['"]/g, '').trim() || 'system-ui';
  const heading = (named[1]?.value || named[0]?.value || 'system-ui').split(',')[0].replace(/['"]/g, '').trim();
  return { body, heading };
}

function googleFontsUrl(body, heading) {
  // Heurística: monta URL Google Fonts pra carregar as fontes detectadas (se forem comuns)
  const fonts = [...new Set([body, heading])].filter(f => f && !/system|apple|sans|serif|mono/i.test(f));
  if (!fonts.length) return null;
  const families = fonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function baseStyles(tokens, colors, fonts, fontsUrl) {
  return `
${fontsUrl ? `@import url('${fontsUrl}');` : ''}

:root {
  --c-fg: ${colors.foreground};
  --c-bg: ${colors.background};
  --c-primary: ${colors.primary};
  --c-secondary: ${colors.secondary};
  --c-accent: ${colors.accent};
  --c-border: rgba(0, 0, 0, 0.1);
  --c-muted: #f5f5f5;

  --f-body: ${fonts.body}, system-ui, sans-serif;
  --f-heading: ${fonts.heading}, ${fonts.body}, system-ui, sans-serif;

  --fs-xs: 12px;
  --fs-sm: 14px;
  --fs-base: 16px;
  --fs-lg: 18px;
  --fs-xl: 24px;
  --fs-2xl: 32px;
  --fs-3xl: 48px;
  --fs-4xl: 64px;

  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 16px;
  --sp-4: 24px;
  --sp-5: 32px;
  --sp-6: 48px;
  --sp-7: 64px;

  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 16px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: var(--f-body); color: var(--c-fg); background: var(--c-bg); }
body { font-size: var(--fs-base); line-height: 1.5; -webkit-font-smoothing: antialiased; }
h1, h2, h3, h4, h5, h6 { font-family: var(--f-heading); font-weight: 600; line-height: 1.2; }
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; }
.container { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-4); }
`;
}

function headerHtml(themeName) {
  return `
<header class="site-header">
  <div class="container">
    <div class="header-inner">
      <a href="home.html" class="logo">${escapeHtml(themeName)}</a>
      <nav class="nav">
        <a href="collection.html">Shop</a>
        <a href="collection.html">Coleções</a>
        <a href="page.html">Sobre</a>
        <a href="page.html">FAQ</a>
      </nav>
      <div class="header-actions">
        <span>🔍</span>
        <span>👤</span>
        <a href="cart.html">🛒 <sup>2</sup></a>
      </div>
    </div>
  </div>
</header>
<style>
  .site-header { padding: var(--sp-4) 0; border-bottom: 1px solid var(--c-border); position: sticky; top: 0; background: var(--c-bg); z-index: 10; }
  .header-inner { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); }
  .logo { font-family: var(--f-heading); font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.02em; }
  .nav { display: flex; gap: var(--sp-5); }
  .nav a { font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.06em; }
  .nav a:hover { color: var(--c-primary); }
  .header-actions { display: flex; gap: var(--sp-3); align-items: center; font-size: var(--fs-lg); }
</style>
`;
}

function footerHtml(themeName) {
  return `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <h4>${escapeHtml(themeName)}</h4>
        <p style="margin-top: var(--sp-2); color: var(--c-secondary); font-size: var(--fs-sm);">Demo gerada por clone-theme — preview offline, sem Shopify envolvido.</p>
      </div>
      <div>
        <h4>Loja</h4>
        <ul><li>Novidades</li><li>Coleções</li><li>Best sellers</li></ul>
      </div>
      <div>
        <h4>Suporte</h4>
        <ul><li>FAQ</li><li>Envios</li><li>Trocas</li></ul>
      </div>
      <div>
        <h4>Newsletter</h4>
        <p style="font-size: var(--fs-sm); color: var(--c-secondary);">Receba ofertas e novidades</p>
        <input type="email" placeholder="seu@email.com">
      </div>
    </div>
    <div class="footer-bottom">© 2026 — Preview gerado por clone-theme</div>
  </div>
</footer>
<style>
  .site-footer { background: var(--c-muted); padding: var(--sp-6) 0 var(--sp-4); margin-top: var(--sp-7); }
  .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: var(--sp-5); }
  .footer-grid h4 { font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: var(--sp-3); }
  .footer-grid ul { list-style: none; }
  .footer-grid li { font-size: var(--fs-sm); color: var(--c-secondary); margin-bottom: var(--sp-1); }
  .footer-grid input { width: 100%; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-sm); margin-top: var(--sp-2); font-family: inherit; }
  .footer-bottom { margin-top: var(--sp-5); padding-top: var(--sp-4); border-top: 1px solid var(--c-border); font-size: var(--fs-xs); color: var(--c-secondary); text-align: center; }
`;
}

function homeHtml(themeName, palette) {
  const swatchUrl = (color, label) => `https://placehold.co/600x800/${encodeURIComponent(color.replace('#', ''))}/${color.toLowerCase().includes('fff') ? '333333' : 'ffffff'}?text=${encodeURIComponent(label)}&font=montserrat`;
  return wrapPage(themeName, 'Home', `
${headerHtml(themeName)}

<section class="hero">
  <div class="hero-content">
    <p class="eyebrow">Coleção 2026</p>
    <h1>Design refinado.<br>Engenharia precisa.</h1>
    <p class="hero-sub">Cada peça pensada do micro ao macro. Minimalismo funcional pra quem vê valor em durabilidade.</p>
    <div class="cta-row">
      <a href="collection.html" class="btn btn-primary">Explorar coleção</a>
      <a href="page.html" class="btn btn-ghost">Sobre nós →</a>
    </div>
  </div>
</section>

<section class="features">
  <div class="container">
    <div class="feature-grid">
      <div class="feature"><div class="feature-icon">◇</div><h3>Materiais selecionados</h3><p>Aço inox 316L, vidro safira, mecanismos Swiss-grade.</p></div>
      <div class="feature"><div class="feature-icon">◆</div><h3>5 anos de garantia</h3><p>Cobertura completa contra defeito de fabricação.</p></div>
      <div class="feature"><div class="feature-icon">◈</div><h3>Frete grátis Brasil</h3><p>Acima de R$ 499. Envio em até 48h.</p></div>
    </div>
  </div>
</section>

<section class="product-grid-section">
  <div class="container">
    <div class="section-head">
      <h2>Best sellers</h2>
      <a href="collection.html">Ver tudo →</a>
    </div>
    <div class="product-grid">
      ${[1, 2, 3, 4].map(i => `
      <article class="product-card">
        <img src="${swatchUrl(palette[i % palette.length] || '#1a1a1a', 'Demo ' + i)}" alt="">
        <h4>Produto Demo ${i}</h4>
        <p class="price">R$ ${(599 + i * 100).toLocaleString('pt-BR')},00</p>
      </article>`).join('')}
    </div>
  </div>
</section>

${footerHtml(themeName)}

<style>
  .hero { padding: var(--sp-7) 0; background: var(--c-fg); color: var(--c-bg); }
  .hero-content { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-4); text-align: center; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: var(--fs-xs); opacity: 0.7; margin-bottom: var(--sp-3); }
  .hero h1 { font-size: var(--fs-4xl); letter-spacing: -0.03em; margin-bottom: var(--sp-4); }
  .hero-sub { font-size: var(--fs-lg); max-width: 540px; margin: 0 auto var(--sp-5); opacity: 0.85; }
  .cta-row { display: flex; gap: var(--sp-3); justify-content: center; }
  .btn { padding: var(--sp-3) var(--sp-5); border-radius: var(--r-md); font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.08em; transition: opacity 0.2s; }
  .btn-primary { background: var(--c-bg); color: var(--c-fg); border: 1px solid var(--c-bg); }
  .btn-ghost { background: transparent; color: var(--c-bg); border: 1px solid rgba(255,255,255,0.3); }
  .btn:hover { opacity: 0.85; }
  .features { padding: var(--sp-7) 0; }
  .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-5); }
  .feature { text-align: center; }
  .feature-icon { font-size: var(--fs-2xl); color: var(--c-primary); margin-bottom: var(--sp-3); }
  .feature h3 { font-size: var(--fs-lg); margin-bottom: var(--sp-2); }
  .feature p { color: var(--c-secondary); font-size: var(--fs-sm); }
  .product-grid-section { padding: var(--sp-6) 0; background: var(--c-muted); }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--sp-5); }
  .section-head h2 { font-size: var(--fs-2xl); }
  .section-head a { font-size: var(--fs-sm); }
  .product-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); }
  .product-card { background: var(--c-bg); padding: var(--sp-3); border-radius: var(--r-md); border: 1px solid var(--c-border); }
  .product-card img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: var(--r-sm); margin-bottom: var(--sp-3); }
  .product-card h4 { font-family: var(--f-body); font-weight: 500; font-size: var(--fs-base); margin-bottom: var(--sp-1); }
  .price { font-size: var(--fs-sm); color: var(--c-primary); font-weight: 600; }
  @media (max-width: 768px) {
    .hero h1 { font-size: var(--fs-2xl); }
    .feature-grid, .product-grid { grid-template-columns: 1fr 1fr; }
    .footer-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
`);
}

function productHtml(themeName, palette) {
  const img = `https://placehold.co/800x1000/${encodeURIComponent((palette[0] || '#1a1a1a').replace('#', ''))}/ffffff?text=Produto+Demo&font=montserrat`;
  return wrapPage(themeName, 'Produto', `
${headerHtml(themeName)}
<div class="container" style="padding-top: var(--sp-5);">
  <div class="breadcrumb">Home / Coleção / <strong>Produto Demo</strong></div>
  <div class="pdp-grid">
    <div class="pdp-gallery">
      <img src="${img}" alt="">
      <div class="pdp-thumbs">
        ${[0, 1, 2, 3].map(i => `<img src="https://placehold.co/200x250/${encodeURIComponent((palette[i] || '#1a1a1a').replace('#', ''))}/ffffff?text=${i+1}" alt="">`).join('')}
      </div>
    </div>
    <div class="pdp-info">
      <p class="eyebrow">Edição Limitada</p>
      <h1>Modelo Caspian Demo</h1>
      <p class="pdp-price">R$ 1.299,00 <span class="compare">R$ 1.599,00</span></p>
      <p class="pdp-desc">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam in tellus consequat, fermentum nisl vitae, accumsan nibh. Demo gerada para preview, conteúdo é placeholder.</p>

      <div class="option-group">
        <label>Cor</label>
        <div class="swatches">
          ${[0, 1, 2].map(i => `<button class="swatch" style="background: ${palette[i] || '#000'};"></button>`).join('')}
        </div>
      </div>
      <div class="option-group">
        <label>Tamanho</label>
        <div class="sizes">
          ${['38mm', '40mm', '42mm'].map(s => `<button class="size">${s}</button>`).join('')}
        </div>
      </div>

      <button class="btn btn-cta">Adicionar ao carrinho</button>

      <div class="pdp-features">
        <div>✓ Frete grátis acima de R$ 499</div>
        <div>✓ 5 anos de garantia</div>
        <div>✓ Troca em até 30 dias</div>
      </div>
    </div>
  </div>
</div>
${footerHtml(themeName)}

<style>
  .breadcrumb { font-size: var(--fs-sm); color: var(--c-secondary); margin-bottom: var(--sp-4); }
  .pdp-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: var(--sp-6); padding-bottom: var(--sp-6); }
  .pdp-gallery img { border-radius: var(--r-md); }
  .pdp-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); margin-top: var(--sp-2); }
  .pdp-info h1 { font-size: var(--fs-3xl); letter-spacing: -0.02em; margin: var(--sp-2) 0 var(--sp-3); }
  .pdp-price { font-size: var(--fs-xl); margin-bottom: var(--sp-4); }
  .compare { color: var(--c-secondary); text-decoration: line-through; font-size: var(--fs-base); margin-left: var(--sp-2); }
  .pdp-desc { color: var(--c-secondary); margin-bottom: var(--sp-5); line-height: 1.7; }
  .option-group { margin-bottom: var(--sp-4); }
  .option-group label { display: block; font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--sp-2); }
  .swatches, .sizes { display: flex; gap: var(--sp-2); }
  .swatch { width: 40px; height: 40px; border-radius: 999px; border: 2px solid var(--c-border); cursor: pointer; }
  .size { padding: var(--sp-2) var(--sp-4); border: 1px solid var(--c-border); background: var(--c-bg); border-radius: var(--r-sm); font-size: var(--fs-sm); }
  .btn-cta { width: 100%; background: var(--c-fg); color: var(--c-bg); padding: var(--sp-4); border: none; border-radius: var(--r-md); font-size: var(--fs-base); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: var(--sp-4); }
  .pdp-features { display: flex; flex-direction: column; gap: var(--sp-2); font-size: var(--fs-sm); color: var(--c-secondary); padding-top: var(--sp-4); border-top: 1px solid var(--c-border); }
  @media (max-width: 768px) { .pdp-grid { grid-template-columns: 1fr; } }
</style>
`);
}

function collectionHtml(themeName, palette) {
  return wrapPage(themeName, 'Coleção', `
${headerHtml(themeName)}
<section class="collection-hero">
  <div class="container">
    <p class="eyebrow">Coleção</p>
    <h1>Mens Watches</h1>
    <p class="sub">12 produtos · Demo gerada por clone-theme</p>
  </div>
</section>
<div class="container">
  <div class="collection-grid">
    ${Array.from({ length: 12 }, (_, i) => `
    <article class="product-card">
      <img src="https://placehold.co/600x750/${encodeURIComponent((palette[i % palette.length] || '#1a1a1a').replace('#', ''))}/ffffff?text=Demo+${i+1}&font=montserrat" alt="">
      <h4>Modelo ${['Caspian', 'Atlas', 'Helix', 'Vega', 'Solis', 'Nova', 'Orion', 'Pulsar', 'Lyra', 'Iris', 'Drift', 'Crest'][i]}</h4>
      <p class="price">R$ ${(799 + i * 60).toLocaleString('pt-BR')},00</p>
    </article>`).join('')}
  </div>
</div>
${footerHtml(themeName)}
<style>
  .collection-hero { padding: var(--sp-7) 0 var(--sp-5); text-align: center; }
  .collection-hero h1 { font-size: var(--fs-3xl); letter-spacing: -0.02em; margin: var(--sp-2) 0; }
  .sub { color: var(--c-secondary); font-size: var(--fs-sm); }
  .collection-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-4); padding-bottom: var(--sp-7); }
  .product-card { background: var(--c-bg); border: 1px solid var(--c-border); border-radius: var(--r-md); padding: var(--sp-3); transition: border-color 0.2s; }
  .product-card:hover { border-color: var(--c-fg); }
  .product-card img { width: 100%; aspect-ratio: 4/5; object-fit: cover; border-radius: var(--r-sm); margin-bottom: var(--sp-3); }
  .product-card h4 { font-family: var(--f-body); font-weight: 500; font-size: var(--fs-base); margin-bottom: var(--sp-1); }
  .price { font-size: var(--fs-sm); color: var(--c-primary); font-weight: 600; }
  @media (max-width: 768px) { .collection-grid { grid-template-columns: 1fr 1fr; } }
</style>
`);
}

function cartHtml(themeName, palette) {
  return wrapPage(themeName, 'Carrinho', `
${headerHtml(themeName)}
<div class="container" style="padding-top: var(--sp-5);">
  <h1 style="font-size: var(--fs-3xl); margin-bottom: var(--sp-5);">Seu carrinho</h1>
  <div class="cart-grid">
    <div class="cart-items">
      ${[1, 2].map(i => `
      <div class="cart-item">
        <img src="https://placehold.co/200x250/${encodeURIComponent((palette[i] || '#1a1a1a').replace('#', ''))}/ffffff?text=Item+${i}&font=montserrat" alt="">
        <div class="cart-item-info">
          <h4>Modelo Demo ${i}</h4>
          <p class="muted">Cor: Preto · Tamanho: 40mm</p>
          <div class="qty"><button>−</button><span>1</span><button>+</button></div>
        </div>
        <div class="cart-item-price">
          <strong>R$ ${(899 + i * 200).toLocaleString('pt-BR')},00</strong>
          <a href="#">Remover</a>
        </div>
      </div>`).join('')}
    </div>
    <aside class="cart-summary">
      <h3>Resumo</h3>
      <div class="summary-row"><span>Subtotal</span><strong>R$ 1.998,00</strong></div>
      <div class="summary-row"><span>Frete</span><span>Grátis</span></div>
      <hr>
      <div class="summary-row total"><span>Total</span><strong>R$ 1.998,00</strong></div>
      <button class="btn btn-cta">Finalizar compra →</button>
      <p class="muted" style="text-align:center;font-size:var(--fs-xs);margin-top:var(--sp-3);">Pagamento seguro · SSL · 12x sem juros</p>
    </aside>
  </div>
</div>
${footerHtml(themeName)}
<style>
  .cart-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: var(--sp-5); padding-bottom: var(--sp-7); }
  .cart-item { display: grid; grid-template-columns: 100px 1fr auto; gap: var(--sp-3); padding: var(--sp-4) 0; border-bottom: 1px solid var(--c-border); }
  .cart-item img { width: 100px; aspect-ratio: 4/5; object-fit: cover; border-radius: var(--r-sm); }
  .cart-item h4 { font-family: var(--f-body); font-weight: 500; margin-bottom: var(--sp-1); }
  .muted { color: var(--c-secondary); font-size: var(--fs-sm); }
  .qty { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-3); border: 1px solid var(--c-border); border-radius: var(--r-sm); padding: var(--sp-1) var(--sp-2); }
  .qty button { background: none; border: none; font-size: var(--fs-lg); cursor: pointer; padding: 0 var(--sp-1); }
  .qty span { min-width: 20px; text-align: center; }
  .cart-item-price { text-align: right; }
  .cart-item-price strong { font-size: var(--fs-base); }
  .cart-item-price a { display: block; margin-top: var(--sp-2); font-size: var(--fs-xs); color: var(--c-secondary); text-decoration: underline; }
  .cart-summary { background: var(--c-muted); padding: var(--sp-5); border-radius: var(--r-md); height: fit-content; position: sticky; top: 100px; }
  .cart-summary h3 { font-size: var(--fs-lg); margin-bottom: var(--sp-4); }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: var(--sp-2); font-size: var(--fs-sm); }
  .summary-row.total { font-size: var(--fs-lg); margin: var(--sp-3) 0; }
  hr { border: none; border-top: 1px solid var(--c-border); margin: var(--sp-3) 0; }
  .btn-cta { width: 100%; background: var(--c-fg); color: var(--c-bg); padding: var(--sp-4); border: none; border-radius: var(--r-md); font-size: var(--fs-base); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
  @media (max-width: 768px) { .cart-grid { grid-template-columns: 1fr; } }
</style>
`);
}

function pageHtml(themeName) {
  return wrapPage(themeName, 'Página', `
${headerHtml(themeName)}
<article class="page-content">
  <div class="container" style="max-width: 720px;">
    <h1>Sobre nós</h1>
    <p class="lead">Demo de página institucional. Conteúdo placeholder pra mostrar tipografia e ritmo vertical.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam in tellus consequat, fermentum nisl vitae, accumsan nibh. Curabitur in convallis ipsum. Mauris sit amet ipsum lectus.</p>
    <h2>Nossa história</h2>
    <p>Donec euismod, lectus quis pharetra placerat, justo magna sodales velit, nec convallis arcu sem ac elit. Suspendisse vel mollis dui, sit amet lacinia tortor.</p>
    <h2>Compromissos</h2>
    <ul>
      <li>Materiais de origem rastreável</li>
      <li>Fabricação ética</li>
      <li>Garantia de longo prazo</li>
      <li>Atendimento direto sem intermediário</li>
    </ul>
    <blockquote>Demo de blockquote — testa contraste entre texto enfatizado e corpo normal.</blockquote>
  </div>
</article>
${footerHtml(themeName)}
<style>
  .page-content { padding: var(--sp-6) 0 var(--sp-7); }
  .page-content h1 { font-size: var(--fs-3xl); letter-spacing: -0.02em; margin-bottom: var(--sp-4); }
  .page-content h2 { font-size: var(--fs-xl); margin: var(--sp-5) 0 var(--sp-3); }
  .lead { font-size: var(--fs-lg); color: var(--c-secondary); margin-bottom: var(--sp-4); line-height: 1.6; }
  .page-content p { margin-bottom: var(--sp-3); color: var(--c-fg); line-height: 1.7; }
  .page-content ul { margin: var(--sp-3) 0 var(--sp-3) var(--sp-4); }
  .page-content li { margin-bottom: var(--sp-2); }
  blockquote { border-left: 3px solid var(--c-primary); padding: var(--sp-3) var(--sp-4); margin: var(--sp-4) 0; color: var(--c-secondary); font-style: italic; font-size: var(--fs-lg); }
</style>
`);
}

function dashboardHtml(meta, tokens, colors, fonts, fontsUrl, pages) {
  const swatch = (color) => `<div class="swatch-card"><div class="swatch-color" style="background: ${color};"></div><code>${escapeHtml(color)}</code></div>`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Clone Preview — ${escapeHtml(meta.theme_name)}</title>
  ${fontsUrl ? `<link rel="stylesheet" href="${fontsUrl}">` : ''}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e8e8e8; line-height: 1.5; }
    .dash-header { padding: 32px; border-bottom: 1px solid #1f1f1f; background: #0f0f0f; }
    .dash-header h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
    .dash-header p { color: #888; font-size: 13px; }
    .dash-header a { color: #6aa3ff; text-decoration: none; }
    .container { max-width: 1400px; margin: 0 auto; padding: 32px; }
    .section { margin-bottom: 48px; }
    .section h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 16px; font-weight: 500; }
    .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
    .swatch-card { background: #151515; border: 1px solid #1f1f1f; border-radius: 8px; padding: 12px; }
    .swatch-color { width: 100%; aspect-ratio: 2/1; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05); }
    .swatch-card code { font-size: 11px; color: #aaa; font-family: 'SF Mono', 'Monaco', monospace; }
    .typography { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .type-card { background: #151515; border: 1px solid #1f1f1f; border-radius: 8px; padding: 20px; }
    .type-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
    .type-card .sample-heading { font-family: '${fonts.heading}', serif; font-size: 32px; line-height: 1.1; margin-bottom: 8px; color: #fff; }
    .type-card .sample-body { font-family: '${fonts.body}', sans-serif; font-size: 14px; color: #ccc; }
    .type-card code { font-size: 11px; color: #6aa3ff; font-family: 'SF Mono', monospace; }
    .pages { display: flex; flex-direction: column; gap: 24px; }
    .page-card { background: #0f0f0f; border: 1px solid #1f1f1f; border-radius: 12px; overflow: hidden; }
    .page-card-header { padding: 16px 20px; border-bottom: 1px solid #1f1f1f; display: flex; justify-content: space-between; align-items: center; }
    .page-card-header h3 { font-size: 16px; font-weight: 600; }
    .page-card-header .meta { font-size: 12px; color: #888; }
    .page-card-header a { color: #6aa3ff; text-decoration: none; font-size: 12px; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #1f1f1f; }
    .comparison-side { background: #0a0a0a; }
    .comparison-side .label { padding: 8px 12px; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #1f1f1f; background: #0f0f0f; }
    .comparison iframe { width: 100%; height: 600px; border: none; background: white; }
    .comparison img { width: 100%; max-height: 600px; object-fit: cover; object-position: top; display: block; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .stat { background: #151515; border: 1px solid #1f1f1f; border-radius: 8px; padding: 16px; }
    .stat .value { font-size: 24px; font-weight: 600; color: #fff; }
    .stat .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
    .note { background: #1a1a0f; border: 1px solid #3a3a1f; border-radius: 8px; padding: 16px; font-size: 13px; color: #d4d4a4; }
  </style>
</head>
<body>
  <div class="dash-header">
    <h1>Clone Preview — ${escapeHtml(meta.theme_name)}</h1>
    <p>Source: <a href="${escapeHtml(meta.url)}" target="_blank">${escapeHtml(meta.url)}</a> · Generated: ${escapeHtml(tokens.extracted_at)}</p>
  </div>
  <div class="container">
    <div class="note">⚠️ Esta é uma <strong>demo gerada com tokens extraídos do alvo</strong>, não uma cópia 1:1. Use o side-by-side abaixo pra avaliar se a paleta/fontes/estrutura básica batem com o site original. Se sim, o pipeline de Fase 2 (conversão Liquid real) pode prosseguir.</div>

    <div class="section">
      <h2>Stats</h2>
      <div class="stats">
        <div class="stat"><div class="value">${tokens.stats.css_files}</div><div class="label">arquivos CSS scrape</div></div>
        <div class="stat"><div class="value">${tokens.stats.total_declarations.toLocaleString('pt-BR')}</div><div class="label">declarations parseadas</div></div>
        <div class="stat"><div class="value">${tokens.colors.length}</div><div class="label">cores únicas</div></div>
        <div class="stat"><div class="value">${tokens.fonts.length}</div><div class="label">font stacks</div></div>
        <div class="stat"><div class="value">${tokens.font_face.total}</div><div class="label">@font-face</div></div>
        <div class="stat"><div class="value" style="color: ${tokens.font_face.paid.length ? '#ff6b6b' : '#4caf50'}">${tokens.font_face.paid.length}</div><div class="label">fontes pagas</div></div>
      </div>
    </div>

    <div class="section">
      <h2>Paleta extraída (top 16)</h2>
      <div class="palette">${colors.palette.map(c => swatch(c)).join('')}</div>
    </div>

    <div class="section">
      <h2>Tipografia detectada</h2>
      <div class="typography">
        <div class="type-card">
          <div class="label">Heading font</div>
          <div class="sample-heading">The quick brown fox</div>
          <div class="sample-heading" style="font-size: 16px;">jumps over the lazy dog</div>
          <code>${escapeHtml(fonts.heading)}</code>
        </div>
        <div class="type-card">
          <div class="label">Body font</div>
          <div class="sample-body">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam in tellus consequat, fermentum nisl vitae, accumsan nibh.</div>
          <div class="sample-body" style="margin-top: 8px; font-weight: 600;">Texto em peso semibold pra comparação.</div>
          <code style="display: block; margin-top: 8px;">${escapeHtml(fonts.body)}</code>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Páginas — render do clone vs screenshot do alvo</h2>
      <div class="pages">
        ${pages.map(p => `
        <div class="page-card">
          <div class="page-card-header">
            <h3>${escapeHtml(p.label)}</h3>
            <div class="meta">${escapeHtml(p.targetUrl || '')}</div>
            <a href="${escapeHtml(p.previewFile)}" target="_blank">Abrir preview ↗</a>
          </div>
          <div class="comparison">
            <div class="comparison-side">
              <div class="label">Preview do clone (demo c/ tokens extraídos)</div>
              <iframe src="${escapeHtml(p.previewFile)}" loading="lazy"></iframe>
            </div>
            <div class="comparison-side">
              <div class="label">Screenshot do alvo</div>
              ${p.screenshotFile ? `<img src="${escapeHtml(p.screenshotFile)}" alt="screenshot do alvo" loading="lazy">` : '<div style="padding: 24px; color: #888;">(sem screenshot)</div>'}
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function wrapPage(themeName, pageLabel, bodyContent) {
  // bodyContent já tem header/footer dentro pra cada page
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(themeName)} — ${escapeHtml(pageLabel)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${bodyContent}
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function main() {
  const args = parseArgs();
  console.log('\n=== clone-preview ===');

  if (!args.slug) {
    console.error('Uso: node clone-preview.mjs <slug> [--serve] [--port=4173]');
    process.exit(1);
  }

  const workspace = path.join(REPO_ROOT, 'themes', 'clones', args.slug);
  const metaPath = path.join(workspace, '.clone-meta.json');
  const tokensPath = path.join(workspace, '_design', 'tokens.json');
  if (!fs.existsSync(tokensPath)) {
    console.error(`Não achei ${tokensPath}. Rode clone-tokens.mjs antes.`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  const scrapeResults = JSON.parse(fs.readFileSync(path.join(workspace, '_raw', 'scrape-results.json'), 'utf8'));

  const colors = pickPrimaryColors(tokens.colors);
  const fonts = pickFonts(tokens.fonts);
  const fontsUrl = googleFontsUrl(fonts.body, fonts.heading);

  console.log(`  Theme:   ${meta.theme_name}`);
  console.log(`  Source:  ${meta.url}`);
  console.log(`  Primary: ${colors.primary}`);
  console.log(`  Fonts:   heading=${fonts.heading}, body=${fonts.body}`);
  console.log(`  Google Fonts URL: ${fontsUrl || '(none — fontes não-Google ou genéricas)'}`);

  // Cria _preview/
  const previewDir = path.join(workspace, '_preview');
  if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
  const screensDir = path.join(previewDir, 'screenshots');
  if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });

  // Salva styles.css base
  fs.writeFileSync(path.join(previewDir, 'styles.css'), baseStyles(tokens, colors, fonts, fontsUrl), 'utf8');

  // Mapeia pages a gerar
  const pageDefs = [
    { type: 'home', label: 'Home', file: 'home.html', html: () => homeHtml(meta.theme_name, colors.palette) },
    { type: 'pdp', label: 'PDP — Produto', file: 'product.html', html: () => productHtml(meta.theme_name, colors.palette) },
    { type: 'plp', label: 'PLP — Coleção', file: 'collection.html', html: () => collectionHtml(meta.theme_name, colors.palette) },
    { type: 'cart', label: 'Cart — Carrinho', file: 'cart.html', html: () => cartHtml(meta.theme_name, colors.palette) },
    { type: 'page', label: 'Page — Institucional', file: 'page.html', html: () => pageHtml(meta.theme_name) },
  ];

  const pageEntries = [];
  for (const def of pageDefs) {
    const html = def.html();
    fs.writeFileSync(path.join(previewDir, def.file), html, 'utf8');

    // Procura screenshot correspondente
    const match = scrapeResults.results.find(r => r.type === def.type || r.type.startsWith(def.type));
    let screenshotFile = null;
    let targetUrl = null;
    if (match) {
      const src = path.join(workspace, '_raw', match.dirName, 'screenshot.png');
      const dst = path.join(screensDir, `${def.type}.png`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        screenshotFile = `screenshots/${def.type}.png`;
      }
      targetUrl = match.url;
    }
    pageEntries.push({ label: def.label, previewFile: def.file, screenshotFile, targetUrl });
    console.log(`  ✓ ${def.file}${screenshotFile ? ` (com screenshot)` : ' (sem screenshot)'}`);
  }

  // Dashboard
  const dashboard = dashboardHtml(meta, tokens, colors, fonts, fontsUrl, pageEntries);
  fs.writeFileSync(path.join(previewDir, 'index.html'), dashboard, 'utf8');

  meta.phase = 'previewed';
  meta.updated_at = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`\n✓ Preview gerado em themes/clones/${args.slug}/_preview/`);
  console.log(`  Abra index.html no browser, ou rode com --serve pra subir localhost:${args.port}`);

  if (args.serve) {
    console.log(`\n  Iniciando npx serve...`);
    const child = spawn('npx', ['serve', previewDir, '-p', String(args.port), '--no-clipboard'], {
      stdio: 'inherit',
      shell: true,
    });
    process.on('SIGINT', () => { child.kill('SIGINT'); process.exit(0); });
  } else {
    console.log(`\n  Pra abrir agora:`);
    console.log(`    node .claude/skills/clone-theme/clone-preview.mjs ${args.slug} --serve`);
    console.log(`    ou abra diretamente: file:///${path.join(previewDir, 'index.html').replace(/\\/g, '/')}`);
  }
}

main().catch(e => { console.error(`\n❌ Erro:`, e.message); process.exit(1); });

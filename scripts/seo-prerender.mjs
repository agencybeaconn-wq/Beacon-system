/**
 * Pré-render de SEO da home (roda depois do `vite build`).
 *
 * PROBLEMA: a home é montada por JavaScript, então o robô recebe <div id="root"></div>
 * — uma página sem uma palavra sequer. O Google até renderiza, mas com atraso e menos
 * confiança; e vários robôs (incluindo os de rede social) não executam JS nenhum.
 *
 * SOLUÇÃO: injetar o conteúdo essencial já pronto dentro do #root. O React substitui
 * esse conteúdo quando monta, então o visitante vê a página normal — e como o texto
 * injetado é o MESMO que aparece na tela, não há discrepância (não é cloaking).
 *
 * Bônus: o título aparece instantaneamente, antes do JS carregar.
 *
 * Por que não usar navegador headless: exigiria baixar o Chromium a cada build na
 * Vercel — lento e quebradiço. Aqui o custo é zero.
 */
import fs from 'fs';
import path from 'path';

// Domínio de produção (confirmado pelo Search Console). Usado em canonical, og:url,
// og:image, sitemap e dados estruturados. Sobrescrevível por SITE_URL.
const DOMINIO = process.env.SITE_URL || 'https://agencynode.site';

const DIST = path.resolve('dist', 'index.html');
if (!fs.existsSync(DIST)) {
    console.error('[seo] dist/index.html não encontrado — rode o build antes.');
    process.exit(1);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Conteúdo estável da home. Se a copy da página mudar, atualizar aqui também.
const H1 = 'Tecnologia que transforma marcas em máquinas de venda';
const SUB = 'A NODE cria sites, landing pages e lojas virtuais sob medida, desenvolve sistemas e IA aplicada para a sua operação, e ensina tudo isso na prática em mentorias com projeto real.';
const SERVICOS = [
    ['Criação de sites e landing pages', 'E-commerce completo em Shopify, WooCommerce, VTEX ou NuvemShop, landing page de campanha e site institucional — com catálogo, frete e checkout configurados e design autoral.'],
    ['Desenvolvimento de sistemas e IA aplicada', 'Painéis com os seus dados, automações que eliminam trabalho manual, agentes de IA que atendem 24h e integração com Shopify, WhatsApp, ERP e CRM.'],
    ['Mentoria de desenvolvimento e IA', 'Formação prática: sites e LPs do zero ao deploy, construção de sistemas, geração de imagem com IA e uso de agentes de código no dia a dia.'],
];
const OPERACOES = [
    ['Pace Run', 'https://lojapacerun.com.br/'],
    ['TH Imports', 'https://thimportsloja.com.br/'],
    ['Mundo Timão', 'https://mundotimao.com.br/'],
];

const bloco = `<div id="seo-inicial" style="max-width:780px;margin:0 auto;padding:120px 24px 80px;font-family:'Outfit',system-ui,sans-serif;color:#EEF1F7">
<h1 style="font-size:clamp(2rem,5vw,3.4rem);line-height:1.04;letter-spacing:-.035em;font-weight:500;margin:0 0 24px">${esc(H1)}</h1>
<p style="color:#B9C0D0;line-height:1.65;margin:0 0 40px">${esc(SUB)}</p>
${SERVICOS.map(([t, d]) => `<h2 style="font-size:1.25rem;font-weight:500;margin:32px 0 8px">${esc(t)}</h2><p style="color:#8A90A2;line-height:1.6;margin:0">${esc(d)}</p>`).join('\n')}
<h2 style="font-size:1.25rem;font-weight:500;margin:40px 0 8px">Operações no ar</h2>
<p style="color:#8A90A2;line-height:1.6;margin:0">${OPERACOES.map(([n, u]) => `<a href="${u}" style="color:#8B6FE0">${esc(n)}</a>`).join(' · ')}</p>
<p style="color:#8A90A2;margin:40px 0 0">Fale com a NODE pelo WhatsApp (31) 98408-3376 ou por nodedev@gmail.com.</p>
</div>`;

let html = fs.readFileSync(DIST, 'utf8');

if (!html.includes('<div id="root"></div>')) {
    console.warn('[seo] #root vazio não encontrado — nada injetado (o build mudou de formato?).');
    process.exit(0);
}

html = html.replace('<div id="root"></div>', `<div id="root">${bloco}</div>`);

// canonical + og:url com o domínio real
if (!html.includes('rel="canonical"')) {
    html = html.replace('</head>',
        `  <link rel="canonical" href="${DOMINIO}/" />\n  <meta property="og:url" content="${DOMINIO}/" />\n</head>`);
}
html = html.replace(/content="\/og-node\.jpg"/g, `content="${DOMINIO}/og-node.jpg"`);
html = html.replace(/"url": "https:\/\/[^"]*\/"/, `"url": "${DOMINIO}/"`);
html = html.replace(/"image": "https:\/\/[^"]*og-node\.jpg"/, `"image": "${DOMINIO}/og-node.jpg"`);

fs.writeFileSync(DIST, html);

// sitemap com o mesmo domínio
const SITEMAP = path.resolve('dist', 'sitemap.xml');
if (fs.existsSync(SITEMAP)) {
    fs.writeFileSync(SITEMAP, fs.readFileSync(SITEMAP, 'utf8').replace(/<loc>[^<]*<\/loc>/, `<loc>${DOMINIO}/</loc>`));
}
const ROBOTS = path.resolve('dist', 'robots.txt');
if (fs.existsSync(ROBOTS)) {
    fs.writeFileSync(ROBOTS, fs.readFileSync(ROBOTS, 'utf8').replace(/Sitemap: .*/, `Sitemap: ${DOMINIO}/sitemap.xml`));
}

const palavras = bloco.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(`[seo] conteúdo injetado no HTML: ${palavras} palavras legíveis por robô`);
console.log(`[seo] domínio aplicado: ${DOMINIO}`);

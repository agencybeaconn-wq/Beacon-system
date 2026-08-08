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

// Domínio de produção. Precisa ser a URL FINAL: o apex (sem www) responde 308 e
// redireciona pro www, e canonical apontando pra endereço que redireciona é sinal
// contraditório pro Google. Sobrescrevível por SITE_URL.
const DOMINIO = process.env.SITE_URL || 'https://www.agencynode.site';

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

// ── Páginas de serviço ────────────────────────────────────────────────────────
// Cada frente ganha um HTML próprio em dist/<slug>/index.html, com título,
// descrição e canonical dela. A Vercel serve arquivo estático antes de aplicar o
// rewrite da SPA, então esses arquivos é que respondem para o robô; o React assume
// depois e o visitante navega normalmente.
const PAGINAS = [
    {
        slug: 'criacao-de-sites',
        title: 'Criação de Sites e Lojas Virtuais sob medida | NODE',
        descricao: 'Criação de loja virtual, landing page e site institucional sob medida. Shopify, WooCommerce, VTEX e NuvemShop, do catálogo ao checkout, com entrega em dias.',
        h1: 'Criação de sites e lojas virtuais sob medida',
        paragrafos: [
            'A NODE constrói loja virtual, landing page e site institucional partindo do que o seu negócio precisa vender, e não de um layout pronto adaptado às pressas.',
            'Trabalhamos com Shopify, WooCommerce, VTEX e NuvemShop. O código e os acessos ficam com você no final: a loja é sua, não nossa.',
        ],
        h2: [
            ['O que entra no projeto', 'Loja completa com catálogo, variações, frete e pagamento. Checkout transparente quando faz sentido. Landing page de campanha. Site institucional com identidade autoral. Pixel, GA4 e eventos testados antes de publicar. Migração de catálogo de outra plataforma.'],
            ['Como funciona na prática', 'Começamos por produto, margem e público. Definimos a estrutura de páginas antes de desenhar tela. Construímos em ciclos curtos com você acompanhando. Testamos o rastreamento de verdade antes de ir ao ar e seguimos junto na operação depois do lançamento.'],
            ['Para quem é', 'Quem vende no Instagram ou no WhatsApp e precisa de loja de verdade. Quem já tem loja mas ela não converte ou é lenta. Quem vai lançar produto e precisa de landing page pronta para tráfego pago.'],
        ],
        perguntas: [
            ['Em quanto tempo a loja fica pronta?', 'Depende do tamanho do catálogo e do escopo, mas lojas e sites completos costumam sair em dias, não em meses. O prazo fechado você recebe no alinhamento, antes de começar.'],
            ['Em qual plataforma vocês trabalham?', 'Shopify, WooCommerce, VTEX e NuvemShop. A escolha depende do seu volume, da sua operação e de quem vai tocar a loja no dia a dia.'],
            ['O código e a loja ficam comigo?', 'Sim. Você recebe todos os acessos e a documentação no fim do projeto. Não trabalhamos com dependência eterna nem prendemos cliente por falta de acesso.'],
            ['Vocês migram uma loja que já existe?', 'Sim, incluindo catálogo, clientes e histórico quando a plataforma de origem permite. A migração é planejada para não derrubar as vendas durante a troca.'],
        ],
    },
    {
        slug: 'sistemas-e-ia',
        title: 'Desenvolvimento de Sistemas e IA Aplicada | NODE',
        descricao: 'Desenvolvimento de sistema sob medida, automações e agentes de IA que entram na operação. Painéis com dados reais, integração com Shopify, WhatsApp, ERP e CRM.',
        h1: 'Desenvolvimento de sistemas e IA aplicada',
        paragrafos: [
            'A NODE desenvolve software que entra na operação e resolve gargalo real. Antes de escrever código, entendemos como você trabalha hoje e onde o processo trava.',
            'IA aqui não é discurso de palco: é automação e agente rodando dentro da sua operação, medidos por um resultado combinado antes de começar.',
        ],
        h2: [
            ['O que construímos', 'Painéis com os seus dados em tempo real. Automações que eliminam trabalho manual repetido. Agentes de IA que atendem e triam 24 horas. Integração com Shopify, WhatsApp, planilhas, ERP e CRM. Área de cliente com login e permissão por perfil. Banco próprio com isolamento de dados.'],
            ['Como funciona na prática', 'Mapeamos a operação e achamos onde o tempo vaza. Definimos em número o resultado esperado. Entregamos em ciclos curtos com você usando desde cedo. Você recebe o repositório e pode trocar de fornecedor quando quiser.'],
            ['Para quem é', 'Operação que se sustenta em planilha e grupo de WhatsApp. Quem gasta horas copiando informação de um sistema para outro. Quem precisa de painel confiável para decidir e hoje decide no achismo.'],
        ],
        perguntas: [
            ['Preciso trocar os sistemas que já uso?', 'Não. Na maioria dos casos a gente integra ao que já existe. Trocar tudo só faz sentido quando a ferramenta atual é o próprio gargalo, e nesse caso a gente mostra a conta antes.'],
            ['Como vocês cobram um sistema sob medida?', 'Por escopo fechado no alinhamento, com o resultado esperado definido antes. Sem contrato aberto que cresce sozinho durante o projeto.'],
            ['Quem cuida do sistema depois de pronto?', 'A gente segue junto na operação, com manutenção e novas funcionalidades combinadas por sprint. Mas o código é seu: se quiser levar para outro time, leva.'],
            ['Dá para começar pequeno?', 'Sim, e costuma ser o melhor caminho. Começamos pelo gargalo que mais dói, colocamos no ar, e só então decidimos o próximo passo com dado na mão.'],
        ],
    },
    {
        slug: 'mentoria-de-ia',
        title: 'Mentoria de Desenvolvimento com IA na Prática | NODE',
        descricao: 'Mentoria prática de desenvolvimento com IA: sites, sistemas, agentes de código e geração de imagem. Você constrói um projeto real do zero até o ar, com acompanhamento direto.',
        h1: 'Mentoria de desenvolvimento com IA, na prática',
        paragrafos: [
            'A mentoria da NODE é formação 100% prática. Você não assiste aula e vai embora com anotação: constrói um projeto real, do zero até o ar, com acompanhamento direto.',
            'O conteúdo é o que usamos no dia a dia para entregar projeto de cliente, sem teoria que não sobrevive ao primeiro problema de verdade.',
        ],
        h2: [
            ['O que você aprende', 'IA aplicada de verdade, sabendo onde ela entra e onde atrapalha. Desenvolvimento de sites e landing pages do zero ao deploy. Construção de sistemas com banco, login, painel e automação. Geração de imagem e criativo com IA. Uso de agentes de código no dia a dia. Precificação e escopo do que você aprendeu.'],
            ['Como é o ensino', 'Cada encontro termina com uma coisa funcionando, não com lista de tarefas. O projeto é seu, é real e vai para o ar no final. Revisão do seu código e das suas decisões, uma a uma. Acompanhamento direto, sem turma gigante.'],
            ['Para quem é', 'Quem já mexe com código e quer usar IA com método. Quem quer entrar em desenvolvimento aprendendo construindo. Freelancer que quer entregar mais rápido e cobrar melhor.'],
        ],
        perguntas: [
            ['Preciso já saber programar?', 'Ajuda, mas não é obrigatório. O ritmo acompanha o seu ponto de partida, e o projeto é escolhido junto com você para caber no seu nível sem virar passeio.'],
            ['É gravado ou ao vivo?', 'O acompanhamento é direto, em cima do seu projeto. Isso é o oposto de curso gravado: o conteúdo se ajusta ao que o seu caso exige.'],
            ['Que projeto eu construo?', 'Um projeto real, escolhido com você no início. Pode ser uma loja, um sistema interno ou uma ferramenta que resolva algo da sua rotina. O importante é que vá para o ar.'],
            ['Serve para eu vender esse serviço depois?', 'Serve, e faz parte do conteúdo. Uma parte da mentoria é sobre escopo e precificação, porque saber construir e não saber vender deixa metade do valor na mesa.'],
        ],
    },
];

const estiloPag = "max-width:820px;margin:0 auto;padding:110px 24px 80px;font-family:'Outfit',system-ui,sans-serif;color:#EEF1F7";

for (const p of PAGINAS) {
    const corpo = `<div id="seo-inicial" style="${estiloPag}">
<h1 style="font-size:clamp(2rem,5vw,3.2rem);line-height:1.05;letter-spacing:-.035em;font-weight:500;margin:0 0 24px">${esc(p.h1)}</h1>
${p.paragrafos.map(t => `<p style="color:#B9C0D0;line-height:1.68;margin:0 0 18px">${esc(t)}</p>`).join('\n')}
${p.h2.map(([t, d]) => `<h2 style="font-size:1.3rem;font-weight:500;margin:34px 0 10px">${esc(t)}</h2><p style="color:#8A90A2;line-height:1.62;margin:0">${esc(d)}</p>`).join('\n')}
<p style="color:#8A90A2;margin:38px 0 0">Fale com a NODE pelo WhatsApp (31) 98408-3376 ou por nodedev@gmail.com. Sete Lagoas, MG, atendemos todo o Brasil.</p>
<p style="margin:26px 0 0"><a href="/" style="color:#8B6FE0">Voltar para a home da NODE</a></p>
</div>`;

    let pag = html
        // título e descrição próprios da página
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(p.descricao)}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(p.title)}$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(p.descricao)}$2`)
        .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(p.title)}$2`)
        .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(p.descricao)}$2`)
        // canonical e og:url apontando para a própria página
        .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${DOMINIO}/${p.slug}$2`)
        .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${DOMINIO}/${p.slug}$2`)
        // Conteúdo da página no lugar do da home. Troca LITERAL do bloco que acabamos
        // de injetar: tentar casar por regex até o próximo <script> não funciona,
        // porque o Vite coloca o script no <head>, não depois do #root.
        .replace(bloco, corpo);

    if (pag.includes(bloco)) {
        console.error(`[seo] FALHA: nao consegui trocar o conteudo em /${p.slug}`);
        process.exit(1);
    }

    // O FAQ marcado da home seria informação errada aqui. Trocamos pelo FAQ desta
    // frente, que é o que a página realmente mostra (e pode render resultado expandido).
    const faqPagina = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: p.perguntas.map(([q, a]) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
        })),
    };
    pag = pag.replace(
        /<script type="application\/ld\+json">\s*\{\s*"@context"[^]*?"@type": "FAQPage"[^]*?<\/script>/,
        `<script type="application/ld+json">\n${JSON.stringify(faqPagina, null, 2)}\n</script>`
    );

    const dir = path.resolve('dist', p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pag);
    const n = corpo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`[seo] /${p.slug}: ${n} palavras legíveis por robô`);
}

// robots.txt e sitemap.xml não podem sair com BOM: os 3 bytes invisíveis do começo
// atrapalham robôs que não os ignoram, e em XML são erro de verdade. Editores e
// PowerShell inserem BOM sem avisar, então limpamos aqui em toda build.
const semBom = (s) => s.replace(/^﻿/, '');

const SITEMAP = path.resolve('dist', 'sitemap.xml');
if (fs.existsSync(SITEMAP)) {
    // troca o domínio de TODAS as urls (antes só a primeira era ajustada, o que
    // deixava as páginas de serviço apontando para o domínio errado se SITE_URL mudasse)
    const xml = semBom(fs.readFileSync(SITEMAP, 'utf8'))
        .replace(/<loc>https?:\/\/[^/]+/g, `<loc>${DOMINIO}`);
    fs.writeFileSync(SITEMAP, xml);
    console.log(`[seo] sitemap: ${(xml.match(/<loc>/g) || []).length} urls`);
}
const ROBOTS = path.resolve('dist', 'robots.txt');
if (fs.existsSync(ROBOTS)) {
    fs.writeFileSync(ROBOTS, semBom(fs.readFileSync(ROBOTS, 'utf8')).replace(/Sitemap: .*/, `Sitemap: ${DOMINIO}/sitemap.xml`));
}

const palavras = bloco.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(`[seo] conteúdo injetado no HTML: ${palavras} palavras legíveis por robô`);
console.log(`[seo] domínio aplicado: ${DOMINIO}`);

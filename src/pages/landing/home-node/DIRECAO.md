# DIREÇÃO — Home NODE (rota "/" pública de agencybeacon.site)

## Estilo nomeado
**Dark Immersive/Cinematic + Terminal/Dev-Tool** (2 combinados). Startup de tecnologia avançada que constrói sistemas, sites e aplicações de IA. Marca NODE é preto e branco — a direção abraça o monocromático: luz, contraste e tipografia mono como assinatura tech. Nada de gradiente colorido.

## Paleta (roles) — herda o dark do app pra coesão total
- `bg-base` #050505 (mesmo do app — a landing É o produto)
- `bg-elevated` #0e0e10 (cards) / `bg-glass` rgba(255,255,255,.03) com border
- `text-primary` #fafafa · `text-muted` #a1a1aa
- `accent` = **branco** (#fafafa) — CTA branco com texto preto, igual ao botão Entrar do login (coesão)
- `border` rgba(255,255,255,.08) · glow sutil rgba(255,255,255,.06) em hovers
- Nunca #000 puro em texto/fundo de card.

## Tipografia
- Display: **Inter Tight** 700/800 tracking -0.03em (já é a fonte do sistema — a home precisa parecer o mesmo produto do login). Hero clamp(2.6rem→5rem).
- Detalhes tech: **Geist Mono** (labels uppercase ls .18em, números, chips de stack).
- Body max-width 62ch.

## Motion
- UMA duração: **0.7s** · UMA curva: **cubic-bezier(.22,1,.36,1)**.
- Lib: **CSS + IntersectionObserver** (zero dependência nova — bundle já é pesado; GSAP não entra). Canvas vanilla no hero (rede de nós/linhas = "node graph", referência direta ao nome) com movimento lento; para com `prefers-reduced-motion`.
- Hover em card: translateY(-4px) + border acesa. Números: contador animado no reveal.

## Wireframe (ordem das seções)
1. **Navbar fixa** translúcida (backdrop-blur): wordmark NODE (node-logo.png h-5) · links âncora Soluções / Resultados / Processo / FAQ · botão **Entrar** (branco → `/login`).
2. **Hero**: label mono "SISTEMAS · E-COMMERCE · IA APLICADA" · H1 "Tecnologia que transforma marcas em máquinas de venda" · sub 1 linha · CTAs: "Falar com a NODE" (branco, WhatsApp 45 99100-9653) + "Acessar o sistema" (ghost → /login) · fundo: canvas node-graph + vinheta. Strip de stats mono: R$575M+ faturamento gerado · 5654+ projetos entregues · 2523+ marcas atendidas · 4800+ clientes ativos.
3. **Soluções** (bento 3 cards): Sistemas & Aplicações de IA (dashboards, automações, agentes) · E-commerce de alta conversão (Shopify e além — "não criamos vitrines bonitas, criamos lojas que vendem") · Sites & Landing pages de alto padrão. Ícones em stroke fino, detalhe mono no rodapé do card.
4. **Resultados** (4 cards tipográficos, número gigante): Mantos do PH +180% vendas · TrybuteHA ROAS 7x · Vargard & Co +320% leads · TrackSoul +150% conversão. Sem imagens (peso zero, cara tech) — contador anima no scroll.
5. **Processo** (4 passos numerados mono 01–04): Alinhamento estratégico → Arquitetura & identidade → Build acelerado por IA → Lançamento & operação.
6. **Stack** (marquee mono infinito, pausa no hover): Shopify · Supabase · Vercel · Stripe · Meta Ads · Klaviyo · WooCommerce · VTEX · NuvemShop · Yampi · OpenAI · Claude.
7. **Manifesto** (split): "Não construímos vitrines. Construímos tecnologia que vende." + parágrafo curto sobre IA aplicada a operação real.
8. **FAQ** (accordion, 5 itens adaptados da LP: como começa um projeto, prazo, suporte, tema/licença, tecnologias).
9. **CTA final**: headline + botão WhatsApp. **Footer**: wordmark + Seg à Dom 9h–23h · (31) 98408-3376 · nodedev@gmail.com · @noode.dev · © 2026 NODE.

## Integração
- Componente React: `src/pages/landing/home-node/page.tsx` (self-contained, CSS em `<style>` escopado por classe `.nlp-`, sem tocar no Tailwind global).
- Rota `/` pública em App.tsx (lazy import). `LandingRedirect` continua existindo; usuário logado também vê a home (botão Entrar leva ao app).
- Placeholders: nenhum — todo conteúdo vem da LP Lever adaptada. Imagens de case ficam pra v2 se o usuário quiser.

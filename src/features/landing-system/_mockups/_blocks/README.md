# Lever Blocks Library

Biblioteca de blocos visuais Lever pra **compor LPs por copy-paste**. Cada bloco é HTML autocontido testável no navegador.

## Estrutura

```
_blocks/
├── _theme.html           Tailwind config + paleta Lever + texturas + utilities (importar em TODO bloco novo)
├── _index.html           Browser visual (abre no navegador, scrolla todos blocos)
├── README.md
├── hero/
│   ├── hero-A-centered-dark.html
│   ├── hero-B-split-light.html
│   └── ...
├── pricing/
│   ├── pricing-A-3tiers-dark.html
│   └── ...
├── faq/
│   └── faq-A-accordion-dark.html
├── cta-banner/
│   └── cta-A-image-bleed.html
├── feature-grid/
│   └── feature-grid-A-3cards.html
├── manifesto/
│   └── manifesto-A-split.html
├── process/
│   └── process-A-4steps.html
├── cases/
│   └── cases-A-3cards.html
└── nav-footer/
    ├── nav-A-sticky.html
    └── footer-A-4cols.html
```

## Convenção de nomes

`<category>-<letra>-<descritor>-<tema>.html`

- **category**: hero, pricing, faq, cta-banner, feature-grid, manifesto, process, cases, nav-footer
- **letra**: A, B, C... (variante)
- **descritor**: 1-3 palavras (centered, split, fullbleed, 3tiers, accordion, image-bleed, 4steps)
- **tema**: `dark` | `light` | `accent` (fundo da seção)

Exemplos válidos:
- `hero-A-centered-dark.html` (hero versão A, layout centered, fundo dark)
- `pricing-B-comparison-light.html` (pricing versão B, comparação lado a lado, fundo light)
- `cta-A-image-bleed.html` (CTA versão A, imagem full-bleed — tema implícito dark)

## Como usar (workflow João)

1. **Browse**: abre `_index.html` no navegador → vê todos blocos lado a lado
2. **Compõe**: pega o bloco que quer → copia `<section>...</section>` → cola no mockup da LP (`sites-shopify/v1.html` ou `scale-criativos/v3.html`)
3. **Itera**: ajusta copy/cores/spacing direto no HTML
4. **Valida cross-LP**: usa o mesmo bloco em 2 LPs diferentes pra ver se a consistência segura
5. **Promove a canon**: quando bloco amadurece, vira componente React (Pedro) + entra como preset Higgsfield (Campanhã, banners de loja)

## Regras de consistência visual (deve aplicar em TODOS blocos)

Os 10 princípios visuais Lever (memory `feedback_lever_lp_visual_principles`):

1. **Espaçamento generoso**: `py-20 md:py-28 lg:py-32`
2. **Arredondamento consistente**: `rounded-2xl` cards / `rounded-full` badges-CTAs
3. **Intercalação de fundo**: alternar dark / light / accent entre seções
4. **Ícones lucide via SVG inline**: NUNCA emoji
5. **CTAs intercalados**: a cada ~3 seções
6. **Tipografia peso contrastado**: H1 `font-black`, body `font-light`
7. **Animações sutis**: `transition`, `hover:scale-[1.02]`, fade-in
8. **Texturas no fundo**: nunca chapado liso (grid, noise, radial-gradient)
9. **Mobile-first**: toda decisão visual testada em mobile primeiro
10. **Eyebrow consistente**: `text-xs uppercase tracking-wider text-red-500` acima de cada H2

## Paleta canon

Definida em `_theme.html`. **NÃO inventar cor nova sem amarrar à paleta**.

- **Accent**: red-500 `#EF4444`, red-600 `#DC2626`
- **Dark**: black `#000000`, neutral-950 `#0A0A0A`, neutral-900 `#171717`
- **Light**: white `#FFFFFF`, neutral-50 `#FAFAFA`, neutral-100 `#F5F5F5`
- **Texto**: neutral-100 (em dark) / neutral-900 (em light)
- **Borda sutil**: rgba(255,255,255,0.10) (dark) / rgba(0,0,0,0.08) (light)

## Tipografia

**Inter Tight** (Google Fonts), pesos: 300, 400, 500, 600, 700, 800, 900.
- H1: `text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95]`
- H2: `text-3xl md:text-5xl font-black tracking-tight`
- H3: `text-xl md:text-2xl font-extrabold`
- Body: `text-base md:text-lg font-light leading-relaxed`
- Eyebrow: `text-xs uppercase tracking-[0.18em] font-semibold`

## Pra que serve no fim

João valida visual cross-LP → vira preset Higgsfield (Campanhã usa em banners de loja cliente) → vira componente React (Pedro implementa em Lever-LP). **1 padrão, 3 destinos.**

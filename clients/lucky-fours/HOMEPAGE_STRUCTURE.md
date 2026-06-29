# Lucky Fours — Homepage Structure (scrape 2026-04-25)

Análise da home `https://luckyfours.com/` pra replicar no MontRoyal usando blocos do tema Nord.

## Sequência de seções (live)

| # | Seção | Coleção/Conteúdo | Título visível |
|---|---|---|---|
| 1-3 | Hero (3 versões empilhadas, B/C/D) | `products` | — (image only) |
| 4 | Collection List (overview) | múltiplas | — |
| 5 | Product Filter Slide | `watches` | "Best Sellers" |
| 6 | Featured Collection | (filhos) | "Best-Sellers" |
| 7 | Custom (1776532506d0f80ce8) | — | "Baretta Restock" |
| 8 | Image Banner | — | — |
| 9-17 | Featured Collection × Image Banner alternando (5×) | várias | — |
| 18-20 | Custom blocks (footer-ish: Policies/extras) | — | "Policies" |

## Padrão observado

- **Hero triplo** no topo (com versions B/C/D) — provavelmente carrossel ou variantes responsivas.
- **Filtro de produtos** logo abaixo (slide) com Best Sellers.
- **Loop de "Featured Collection → Image Banner"** repetido 5-6 vezes (cada coleção principal ganha sua "vitrine" com banner promocional separando).

## Mapeamento provável (collection list overview)

Pelo CSV de coleções importado:
- `automatic-watches` (Automatic Watches)
- `mens-watches` (Men's Watches)
- `womens-watches` (Women's Watches)
- `quartz-watches` (Quartz Watches)
- `sport-watches` (Sport Watches)
- `watch-accessories` (Watch Accessories)
- `watches` (BUY 1 GET 1 FREE / Best Sellers)
- `bogo-watches` (BOGO WATCHES)
- `grealy-collection` (Grealy Collection)
- `poedagar-collection` (Old Money Collection)
- `new-watches` (NEW WATCHES)

## Adaptação pro tema Nord

A Nord não tem necessariamente o mesmo set de seções (nomes diferentes). Plano:

1. Identificar seções equivalentes na Nord (hero, featured collection, image banner, collection list).
2. Montar `templates/index.json` no draft do MontRoyal usando essas seções na **mesma ordem** do Lucky Fours.
3. Atribuir coleções reais (já importadas no MontRoyal) em cada `featured_collection`.
4. Imagens: usar placeholders OU baixar as imagens dos hero/banners do scrape pra subir como assets.

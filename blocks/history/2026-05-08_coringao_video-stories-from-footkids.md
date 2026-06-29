# Bloco: Video Stories (Galeria de Vídeos estilo Instagram)

## Operação
- **Data:** 2026-05-08
- **Origem:** foot kids (`5edf96.myshopify.com`) — `Tema Lever 07/04` (185067766040)
- **Destino:** Coringão Shop (`nbdxec-gx.myshopify.com`) — `Lever 17/03 - Copy` (188239249481, publicado)
- **Idioma:** BR → BR (sem tradução)
- **Validação:** 100% (validateAll clean nos 3 arquivos)
- **Status:** Aplicado
- **Modo de cópia:** Full file (assets novos, sem conflito) + injeção em templates JSON

## Arquivos tocados
| Arquivo | Antes | Depois | Diff |
|---|---|---|---|
| `sections/video-stories.liquid` | (não existia) | 13484b | NOVO |
| `assets/section-video-stories.css` | (não existia) | 7590b | NOVO |
| `assets/video-stories.js` | (não existia) | 5161b | NOVO |
| `templates/index.json` | 46232b | 47069b | +837b (1 section adicionada na pos 11) |
| `templates/product.json` | 28643b | 29540b | +897b (1 section adicionada na pos 2) |

## Features adicionadas
- Section `video-stories` (Galeria de Vídeos) com schema completo:
  - Cabeçalho configurável (título, descrição, alinhamento, estilo padrão/com-linha)
  - 4 formatos de vídeo: Stories 9:16, Retrato 4:5, Quadrado 1:1, Paisagem 16:9
  - Colunas no desktop ajustáveis (2-6)
  - Color scheme + padding configuráveis
- Block `story` com 3 fontes de vídeo:
  - Upload Shopify (com som, autoplay no modal)
  - URL externa YouTube/Vimeo (iframe)
  - URL MP4 direto custom
  - Imagem de capa opcional (se setada, vídeo fica estático)
- Modal full-screen com:
  - Botão fechar + backdrop click + tecla Escape
  - Botão mute/unmute (apenas para vídeos nativos MP4/Shopify)
  - Fallback de autoplay com som bloqueado → tenta mute
- Auto-thumbnail com play overlay quando há cover image
- Auto-play inline mutado (preview) quando NÃO tem cover image

## Posicionamento aplicado

### Home (`templates/index.json`)
- Section ID: `video_stories_blo728`
- Title: "Nossos Clientes"
- Description: "Faça parte da nossa família!"
- Posição: `[11]` — entre `featured-collection (jogadores)` [10] e `featured-collection (colecao-inverno-1)` [12]
- 4 blocks `story` vazios (preencher via theme editor)
- 5 colunas no desktop, formato 9:16

### PDP (`templates/product.json` — default)
- Section ID: `video_stories_rzmzmg`
- Title: "Qualidade e Confiança"
- Description: "Veja nossos clientes recebendo seus produtos."
- Posição: `[2]` — logo após `main-product` [1], antes de `apps` [3]
- 4 blocks `story` vazios
- 4 colunas no desktop, formato 9:16
- **Nota:** Os tabs "Qualidade do Produto / Características / Instruções de Lavagem" são `tab_html` blocks DENTRO de `main-product`, não sections separadas. Não foi possível inserir literalmente entre os badges (Garantia/Entrega/Segurança) e os tabs sem mexer na estrutura interna do `main-product`. Posição [2] (logo após main-product) é o lugar mais central possível sem refatorar.

## Templates de produto NÃO tocados (5)
A Coringão tem múltiplos templates de produto. **Só apliquei no `product.json` default.** Se quiser propagar pros outros, é só pedir:
- `templates/product.timao.json`
- `templates/product.galo.json`
- `templates/product.santos.json`
- `templates/product.fogooo.json`
- `templates/product.options-customizer.json`
- `templates/product.a-configs.json`
- `templates/product.complementary-products.json`

## Pontos de atenção / dependências
- **Default video URL no schema:** `https://www.youtube.com/watch?v=_9VUPq3SxOc` (placeholder do schema da foot kids — substituir ao configurar)
- **JS usa event delegation** — funciona bem com sections dinâmicas e re-renders do theme editor
- **`window.videoStoriesInitialized` guard** — evita double-init se o JS for carregado 2x
- **Aria-labels e SVGs inline** — sem dependência de snippet `icon-*` externo
- **Sem hardcoded BRL ou strings que precisariam tradução pra EN** (caso futuro deploy em loja EN)

## Erros encontrados durante execução
Nenhum. Operação fluiu limpa.

## Arquivos de sandbox
`scripts/theme_dump/coringao-video-stories/`:
- `foot-kids-LIVE/` — pull dos 3 assets + index/product.json da foot kids
- `coringao-LIVE/` — pull do index/product.json da Coringão antes
- `coringao-PATCHED/` — proposta aplicada
- `coringao-APPLIED/` — re-fetch pós-PUT (bate com PATCHED)
- `coringao-BACKUP/` — backup .bak dos templates antes do PUT (revertível via restoreAsset)

## Lições / candidato?
- **Section 100% self-contained** (sem deps externas, schema completo, JS isolado) → forte candidato a Template Lever.
- **Compatível com qualquer template** (não tem `enabled_on`/`disabled_on`).
- Pra virar candidato, perguntar pro Pedro se ficou bom em produção.

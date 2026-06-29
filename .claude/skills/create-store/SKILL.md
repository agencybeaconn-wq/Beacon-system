---
name: create-store
description: >
  Playbook-mestre pra criar uma loja Shopify Lever do zero a partir de uma loja-base
  (blueprint Nord/Kron), de forma cada vez mais automatizada. Cobre o pipeline inteiro:
  base/clone → catálogo → identidade → conteúdo → ofertas/preço → LAPIDAÇÃO/refino →
  tracking/launch. Use quando for clonar/montar uma loja nova de relógios (ou adaptar
  o blueprint pra outro nicho). Cada fase referencia skills-bloco específicas. A fase
  de refino codifica a "percepção visual" num checklist concreto.
---

# create-store — pipeline de criação de loja Lever

Filosofia (João, 2026-05-29): **transformar criação de loja num processo de modelagem repetível e autogerenciável.** Cada coisa feita na mão na Matignon (case-semente) vira bloco reutilizável. Tem uma etapa que normalmente falta: **lapidação/refino** — os toques finais que dependem de percepção. Este playbook transforma essa percepção em checklist.

Ver [[project_lever_store_automation_roadmap_2026_05_29]] (roadmap + donos por processo) e [[project_nord_to_matignon_clone_2026_05_29]] (o case real, passo a passo).

## Princípios
- **MCP-first** (`lever-shopify`): graphql_query/mutation, clone_theme, publish_to_channels, fileCreate, productSet, productVariantsBulkUpdate, themeFilesUpsert.
- **Idempotência**: clone_theme mesma origem=destino + `include_only` é o canivete pra editar tema sem reescrever arquivo inline (e sobrevive a 504 do gateway — só reenviar).
- **Cada entrega = bloco**, não one-off. Documentar gotcha na skill correspondente.

## Fases

### Fase 0 — Base / clone
- Escolher blueprint (loja-base já lapidada). `clone_theme` cross-shop com `text_replacements` (brand swap), `entity_remap` (GIDs de produto/collection/página/menu por handle), `color_replacements`. `skip_binary:true` pula theme.css/js (URL-body) — transferir à parte se preciso.
- Criar produtos/collections/páginas/menus no destino. Markets + moeda (⚠️ "unified markets" bloqueia troca de moeda-base via API → passo manual no admin).
- Tema clonado → publicar MAIN; manter o antigo unpublished (rollback).

### Fase 1 — Catálogo
- `productSet` (synchronous) por produto: title, handle ÚNICO (colisão = erro; pra atualizar existente passar `id`), vendor, productType, tags, descriptionHtml limpo, productOptions, files (1 imagem/cor), variants (price, compareAtPrice, inventoryPolicy CONTINUE p/ dropship).
- `publish_to_channels` (Online Store/POS/Shop) — productSet deixa status ACTIVE mas NÃO publicado.
- Collections manuais: `collectionAddProducts` é atômico (passar produto já membro = falha o batch; mandar só os novos). `productsCount` é eventualmente consistente.

### Fase 2 — Identidade visual
- **Cor/fontes/headings**: paleta via color_schemes (settings_data.json) + fontes + text-transform. Re-skin via clone_theme color_replacements.
- **Logo (2 slots no Horizon)**: `transparent_logo` = versão BRANCA (aparece sobre hero escuro quando a 1ª seção tem `allow_transparent_header:true`); `logo` = versão ESCURA/navy (header de fundo claro). Subir via fileCreate (originalSource = URL pública; Drive `uc?export=download&id=` funciona se o arquivo estiver público). Trocar TODAS as refs do logo antigo (header-group + faixas scrolling-content + favicon).
- Ver [[feedback_store_footer_standard]] (rodapé padrão) e a skill `configure-theme`.

### Fase 3 — Conteúdo / copy
- Reescrever TODO texto pra voz da marca + idioma do mercado + moeda (numérico, ex £69→€69). Zero resíduo da marca-base (nome, domínio, emails, "Father's Day"/promos antigas).

### Fase 4 — Ofertas / preço
- Definir UMA coleção-âncora em **promoção** (compareAtPrice > price) e o restante a **preço cheio redondo sem promo** (compareAt removido) como âncora de comparação. (Matignon: Meridian €69 de €112.95; resto €99–229.)
- Bundle/B1G1, descontos automáticos, frete.

### Fase 5 — 🔬 LAPIDAÇÃO / REFINO (a etapa que faltava)
O mais difícil de automatizar = **percepção**. Solução: virar percepção em REGRAS verificáveis. Checklist obrigatório antes do launch:

1. **Resíduo de cor da paleta antiga** — varrer TODOS os arquivos de texto. CRÍTICO: procurar a cor em **hex E `rgb()`/`rgba()` E named colors E `hsl()`** (a mesma cor se esconde em formatos diferentes — `#321e1e`=`rgb(50,30,30)`; bug real do contador Matignon). Ver [[feedback_theme_color_identity_audit]]. Esconderijos: settings_data schemes, settings de bloco em templates/*.json, defaults de schema + CSS em sections/snippets.
2. **Logo** — 2 slots do header certos (branca transparente / escura sólida), favicon, faixas de logo (scrolling-content), zero ref ao logo antigo quebrado.
3. **Distribuição de texto (text-with-media etc.)** — blocos NÃO presos em `top_center`/`bottom_center` (título gigante no topo + descrição solta embaixo). Agrupar e centralizar (`middle_center`). Título não pode ficar "gritante" desproporcional vs o corpo.
4. **Badges/tags** — sem lógica leftover (ex: custom_badge `best-seller`→"SOLD OUT" marcando o catálogo como esgotado). Limpar tags que disparam badge indevido.
5. **Refs cross-shop** — nenhuma imagem apontando pro CDN de OUTRA loja (`/files/1/<outra-conta>/`). Tudo no CDN da própria loja.
6. **QA visual desktop + mobile** por template (home/PDP/coleção/cart/checkout): hierarquia, espaçamento, alinhamento, overlays, legibilidade. Screenshot quando a loja não estiver com senha.
7. **Consistência**: heading transform, border-radius, botões, espaçamento entre seções.

> Como automatizar a percepção: (a) checklist acima como regras determinísticas; (b) screenshot via Playwright + comparação visual; (c) "completeness critic" que pergunta "o que está fora do grid/paleta/escala?". É o foco de melhoria contínua dessa fase.

### Fase 6 — Tracking / launch
- Pixel próprio + catálogo (feed) no domínio. CAPI/WeTracked se aplicável.
- Bloqueios de launch: trocar moeda-base (admin), tirar senha "Opening Soon", ativar Shopify Payments (cliente).

## Skills-bloco referenciadas
- `configure-theme` (+ `footer-standard.md`, `color-identity-audit.md`)
- `brand-image-gen` (heros/banners/lifestyle via Higgsfield a partir de referência de marca)
- `client-onboarder` (onboarding Shopify: briefing→collab→token)

## Donos (refino contínuo de cada vertente)
Pedro=manutenção+criação · Campanha=imagem+e-mail · Wesley=tráfego · João=gestão/custo · Matheus=comercial.

---
name: brand-image-gen
description: >
  Gerar/melhorar imagens de loja (heros, banners, lifestyle, PDP) SEMPRE partindo
  das referências de marca do cliente + logo, via Higgsfield, e subir o resultado
  de volta pro Shopify trocando no tema. Use quando for criar/trocar imagens de
  qualquer loja Lever (Matignon, Kron, clientes). Resolve o caso "créditos zerados"
  (toggle Unlimited do plano Ultimate) e o caso "referência > prompt do zero".
---

# brand-image-gen — pipeline de imagem com referência de marca

Regra de ouro: **nunca gerar imagem de loja "do zero" no chute.** Sempre puxar as
referências reais da marca (imagens que já estão no Shopify Files do cliente + a
logo) e usar como **reference image** no Higgsfield pra MELHORAR, não inventar.
Resultado fica on-brand e consistente. Depois sobe pro Shopify e troca no tema.

## 0. Antes de gerar — montar o "reference pack"
Baixar pra `matignon-brand-assets/references/` (ou `<cliente>-brand-assets/`):
1. **Imagens de referência** que já estão no Shopify Files do cliente (heros,
   lifestyle, PDP atuais). Pegar URLs via:
   `mcp__lever-shopify__graphql_query` →
   `files(first:40, query:"media_type:IMAGE", sortKey:CREATED_AT, reverse:true){edges{node{... on MediaImage{image{url}}}}}`
   Baixar com `curl -sL -o nome.jpg "<cdn-url>"`. Validar com `file *` (se vier
   "HTML document" = URL errada/404).
2. **Logo do cliente**. ATENÇÃO: confirmar que a logo EXISTE no Files
   (`files(query:"logo OR <marca>")`). Em lojas clonadas o ref do tema
   (`shopify://shop_images/X.png`) pode estar QUEBRADO (arquivo não existe) —
   nesse caso pedir a logo pro dono. Não assumir que existe só porque o tema referencia.

## 1. Geração no Higgsfield
- **MCP** (`mcp__claude_ai_Higgsfield__generate_image`) é metered (cobra créditos;
  ~2/imagem). Bom quando há saldo.
- **Créditos zerados ("All credits used") NÃO é bloqueio** no plano **Ultimate**:
  ir pela UI via Playwright e **ativar o toggle "Unlimited"** (fila standard, grátis).
  Ver [[feedback_higgsfield_unlimited_toggle]] na auto-memory.
- Fluxo UI (Playwright): `browser_navigate` → `https://higgsfield.ai/ai/image?model=nano-banana-pro`
  → remover referência antiga se houver → anexar a referência de marca (upload do
  arquivo baixado) + a logo → ligar toggle Unlimited → limpar prompt (click + Ctrl+A
  + Delete) → escrever prompt → setar aspect ratio (heros = 16:9) → Generate.
- **Modelo**: Nano Banana Pro = top quality 4K + aceita referência (melhora/regenera,
  não edita cirurgicamente). Seedream 4.0 Unlimited / Reve = melhor pra EDIT/cleanup
  cirúrgico (remover elemento sem regenerar). Ver [[reference_higgsfield_model_selection_for_edit]].
- Baixar o resultado da CloudFront (botão download na UI, ou pegar o src da imagem
  gerada via `browser_evaluate`).

## 2. Prompt — manter on-brand
- Descrever a estética da marca (ex: Matignon = luxo navy minimalista, fundo navy
  escuro #14213d, luz cinematográfica, espaço negativo p/ texto nos heros).
- Heros precisam de espaço vazio pra overlay de texto.
- Para PDP/produto: usar a foto real do produto como referência (consistência).

## 3. Subir pro Shopify + trocar no tema
1. `mcp__lever-shopify__graphql_mutation` `fileCreate` com `originalSource` (URL ou
   upload), `filename` explícito, `duplicateResolutionMode: REPLACE` pra preservar nome.
2. Referência no tema é `shopify://shop_images/<filename>` — se subir com o MESMO
   nome do arquivo antigo, o tema já aponta certo (sem editar JSON).
3. Se nome novo: editar `templates/index.json` / `settings_data.json` / `*-group.json`
   trocando o `shopify://shop_images/...`. Pegar o arquivo, editar, push via
   `themeFilesUpsert` (body TEXT) ou via `clone-theme` com `text_replacements`.
4. Tema em produção = mudança ao vivo. Validar em preview/screenshot quando possível.

## Notas de marca — Matignon (matignonwatch.com)
- Identidade: **navy escuro #14213d**, fonte Inter, headings UPPERCASE.
- Reference pack: `Workspace/matignon-brand-assets/references/` (heros Nord 1920×800,
  lifestyle, PDP steel). Heros originais herdados da Nord — base pra melhorar.
- ⚠️ Logo: NÃO existe arquivo de logo no Files (ref `kron.png` do tema é quebrado).
  Pedir a logo pro João antes de marcar imagens.

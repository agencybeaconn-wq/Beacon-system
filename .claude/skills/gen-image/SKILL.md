---
name: gen-image
description: Gera imagens pra LPs e materiais de marca usando Higgsfield MCP (Nano Banana Pro = GPT Image Pro 2). 6 presets cobrem 90% dos casos. Baixa local em _assets/<projeto>/ e abre no Chrome pra revisão.
argument-hint: <preset> "<descrição>" [--slug nome] [--projeto scale-criativos]
---

# Skill: gen-image

Gera imagens via **Higgsfield MCP** (`nano_banana_2` — Nano Banana Pro, equivalente ao GPT Image Pro 2) seguindo presets padronizados de LP. Reduz prompt-engineering pra cada caso, mantém consistência visual entre LPs.

## Quando usar

- Hero banners de LP
- Cards de funcionalidade / features
- Thumbnails de case study
- Backgrounds de seção CTA
- OG images pra preview social
- Banners de marketing genéricos no padrão Lever/cliente

## Executor

Esta skill **não tem script Node**. O Claude (eu) é o executor — leio este SKILL.md, monto o prompt completo combinando o preset + descrição do usuário, chamo o MCP `mcp__claude_ai_Higgsfield__generate_image`, baixo o resultado e abro no Chrome.

## Os 6 presets

### 1. `hero-banner-dark`
**Quando**: hero de LP B2B/tech/premium, fundo escuro com glow accents.
**Aspect**: 16:9 · **Resolution**: 2k

Prompt template (anexar a descrição do user no `[CONCEITO]`):
```
Editorial hero banner for a brand. [CONCEITO]. Dark navy/blue background with subtle grid pattern and glow accents in the brand's primary cyan/blue tones. Composition: cinematic 3D render with depth of field, soft volumetric lighting from upper right, glass morphism, slight glow halos. Style: Modern minimalist editorial, premium tech aesthetic, ultra-detailed 4K photorealistic 3D render. Inspired by Stripe, Linear, and Apple product hero imagery. No people, no text overlays in the banner itself.
```

### 2. `hero-banner-light`
**Quando**: hero de LP DTC/lifestyle/consumer, fundo claro editorial.
**Aspect**: 16:9 · **Resolution**: 2k

```
Editorial hero banner for a brand. [CONCEITO]. Bright, airy background with subtle texture and brand accent color highlights. Composition: minimal editorial product/concept photography, soft natural lighting, shallow depth of field, premium magazine aesthetic. Style: clean, refined, like Apple, Aesop, or Hermès campaign imagery. 4K photorealistic, no people unless explicitly requested, no text overlays.
```

### 3. `feature-card`
**Quando**: card quadrado pra grid de funcionalidades (3-6 cards por LP).
**Aspect**: 1:1 · **Resolution**: 1k (suficiente, custa menos)

```
Square illustrative concept icon for a feature card. [CONCEITO]. Abstract minimalist 3D render with the brand's primary accent color as dominant hue, secondary accents from the brand palette. Clean composition centered in frame, soft glow, premium tech aesthetic. Style: dimensional, modern, like Stripe or Linear feature illustrations. No text, no people.
```

### 4. `case-thumbnail`
**Quando**: thumbnail de case study / portfólio.
**Aspect**: 3:2 · **Resolution**: 2k

```
Editorial case study thumbnail. [CONCEITO]. Lifestyle or product photography in editorial style, natural lighting, brand-aligned color grading, slight cinematic mood. Composition: rule-of-thirds, breathing room for overlay text. Style: like a high-end agency portfolio card or magazine feature. 4K photorealistic, refined.
```

### 5. `cta-background`
**Quando**: fundo ultrawide pra seção CTA final / banner full-bleed.
**Aspect**: 21:9 · **Resolution**: 2k

```
Ultrawide cinematic background for a CTA section. [CONCEITO]. Strong directional gradient using the brand's primary and secondary colors, subtle abstract texture or pattern, dramatic depth. Composition: empty center for overlaid text and CTA button, no busy details in the middle third. Style: like a Vercel, Linear, or premium SaaS hero gradient with depth. No people, no text overlays.
```

### 6. `og-image`
**Quando**: imagem de preview social (Twitter card, OG image).
**Aspect**: 1.91:1 (use 16:9 ou 3:2 mais próximo) · **Resolution**: 1k

```
Social preview card image. [CONCEITO]. Brand color palette, bold simple composition that reads at small sizes, strong focal point in the left third with breathing room on the right for overlaid title text. Style: high-contrast, scroll-stopping, optimized for thumbnail viewing in feeds. No text overlays (added separately in code), no busy details.
```

## Convenção de paleta

Quando o user mencionar projeto/cliente, eu (Claude) consulto a paleta canônica e injeto no prompt **explicitamente** com hex codes. Paletas conhecidas:

- **Scale Criativos**: Azul Principal `#159BFF`, Azul Escuro `#061A2E`, Ciano Glow `#19E6FF`, Azul Claro `#DDF3FF`, Branco Gelo `#F7FBFF`, Grafite `#07111F`
- **Lever Site**: Vermelho `hsl(0 72% 51%)` (#E11D48 aprox), neutros base
- **Kron**: a confirmar conforme aparecer

Se o cliente é novo, o user me passa a paleta na hora ou eu deduzo do brand doc.

## Workflow de execução (eu, Claude, faço)

1. Identifico o **preset** (do argumento do user)
2. Identifico o **projeto/cliente** (default = `scale-criativos` no contexto atual)
3. Crio **slug** descritivo do user input (ex: `hero-dashboard-wall`)
4. Monto o **prompt final** = template do preset + `[CONCEITO]` substituído pela descrição livre do user + paleta hex explícita
5. Chamo `mcp__claude_ai_Higgsfield__generate_image` com:
   ```json
   { "model": "nano_banana_2", "prompt": "<prompt final>", "aspect_ratio": "<do preset>", "resolution": "<do preset>", "count": 1 }
   ```
6. Pego `jobId` retornado, chamo `mcp__claude_ai_Higgsfield__job_status` com `sync: true`
7. Recebo `rawUrl` da CDN do Higgsfield
8. Baixo com `curl -sL "<rawUrl>" -o "lever/src/features/landing-system/_assets/<projeto>/<preset>-<slug>.png"`
9. Abro no Chrome via PowerShell: `Start-Process chrome ([System.Uri]$path).AbsoluteUri`
10. Reporto pro user: arquivo + tamanho + custo aproximado

## Storage convention

```
lever/src/features/landing-system/_assets/
  <projeto>/
    hero-banner-<slug>.png
    feature-card-<slug>.png
    case-thumb-<slug>.png
    ...
```

Nunca sobrescrever automaticamente — se já existe, sufixar `-v2`, `-v3` etc.

## Custos aproximados (Higgsfield ultimate plan)

- 1k resolution: ~3 créditos
- 2k resolution: ~5 créditos
- 4k resolution: ~10 créditos

Balance atual: consultar com `mcp__claude_ai_Higgsfield__balance`.

## Limitações conhecidas (Nano Banana Pro)

- **Texto renderiza bem em inglês, mais frágil em português** — evitar texto crítico na imagem, sobrepor via CSS
- **Pessoas/rostos**: razoável mas tende ao "Adobe stock" — pra UGC realista, considerar Soul Character no futuro (não nesta skill)
- **Refs visuais**: aceita até 1 imagem como ref via `medias[]` — útil pra "matching" estilo de marca

## Quando NÃO usar essa skill

- **Vídeo**: usar `generate_video` direto do Higgsfield MCP (escopo maior, fica fora dessa skill)
- **Edição de produto Shopify**: existe skill `estudio-ia` que sobe direto pro Supabase Storage do Lever — usar quando o destino é o painel da app
- **Personagem reutilizável** (mesma pessoa em várias imagens): usar `mcp__claude_ai_Higgsfield__show_characters action=train` direto — não esta skill

## Exemplos de invocação

```
/lever:gen-image hero-banner-dark "wall of vertical video ads floating in 3D isometric grid, glass morphism phones"
/lever:gen-image feature-card "abstract concept of A/B testing — two diverging paths with metrics"
/lever:gen-image case-thumbnail "fashion brand campaign photography, model holding shopping bag in modern boutique"
/lever:gen-image cta-background "abstract upward growth motion blur with brand color gradient"
```

## Conexões com memória

- [[feedback-no-emojis-ever]] — imagens substituem emojis nas LPs
- [[feedback-lever-backgrounds-always-textured]] — banners gerados servem como camada de textura natural sobre fundos
- [[feedback-lp-color-intercalation-rhythm]] — imagens reforçam variação cromática entre seções
- [[feedback-kron-image-generation-workflow]] — Higgsfield é o caminho canônico, fallback estudio-ia

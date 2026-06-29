---
name: estudio-ia
description: Gera imagens com IA via Estúdio IA (Nano Banana Pro/Gemini) e sobe pro bucket Supabase. Útil pra capas de curso, criativos, banners, thumbnails.
argument-hint: <prompt | --batch arquivo.json>
---

# Estúdio IA — geração de imagens

Gera imagens via edge function `gemini-image-gen` (modelos Nano Banana / Nano Banana Pro do Gemini) e sobe direto pro Supabase Storage. Retorna URL pública.

## Pré-requisitos

Arquivo `.env.local` na raiz do projeto (gitignored) com:

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx      # novo formato, pra edge function
SUPABASE_SERVICE_ROLE_JWT=eyJhbGc...         # JWT legacy, pra storage API
```

Se não tiver: pega em **Supabase Dashboard → Project Settings → API Keys**.

## Uso

### 1 prompt → 1 imagem
```bash
node .claude/skills/estudio-ia/generate.mjs \
  --prompt "A red futuristic car in a dark street, neon lights" \
  --slug "red-car" --bucket academy-covers --folder catalog --aspect 3:4
```
Retorna: `→ https://<project>.supabase.co/storage/v1/object/public/academy-covers/catalog/red-car-<ts>.jpeg`

### Batch (vários prompts) via JSON

Cria `prompts.json`:
```json
[
  { "slug": "card-1", "prompt": "first prompt here...", "aspect": "3:4" },
  { "slug": "card-2", "prompt": "second prompt here...", "aspect": "16:9" }
]
```

Rode:
```bash
node .claude/skills/estudio-ia/generate.mjs --batch prompts.json --bucket academy-covers --folder catalog
```

## Argumentos

| Flag | Default | Descrição |
|---|---|---|
| `--prompt <texto>` | — | Prompt único (ignora --batch) |
| `--slug <nome>` | `image` | Nome do arquivo (sem extensão) |
| `--batch <arquivo.json>` | — | Array de `{slug, prompt, aspect?}` pra batch |
| `--bucket <nome>` | `academy-covers` | Bucket do Supabase Storage |
| `--folder <path>` | `generated` | Pasta dentro do bucket |
| `--aspect <ratio>` | `1:1` | Aspect ratio: `1:1`, `16:9`, `9:16`, `4:3`, `3:4` |
| `--model <id>` | `gemini-3-pro-image-preview` | `gemini-2.5-flash-image` (Nano Banana), `gemini-3.1-flash-image-preview` (NB2), `gemini-3-pro-image-preview` (NB Pro) |

## Identidade visual Lever (cola no prompt)

Quando for gerar imagens pra Lever (cursos, criativos, banners), adiciona ao prompt:

```
Deep black background #0A0A0A with radial crimson red #E11D2E glow. Brutalist sports-brand minimalism, premium Apple-meets-OffWhite aesthetic, cinematic depth, ultra-sharp focus. No text, no logos, no watermarks.
```

Isso garante consistência com a identidade Lever (preto + vermelho, brutalista, sem texto).

## Padrões de uso

| Tipo | Aspect | Folder | Slug exemplo |
|---|---|---|---|
| Capa de curso (vertical) | `3:4` | `catalog` | `curso-claude-code` |
| Banner hero (horizontal) | `16:9` | `heroes` | `hero-banner` |
| Story Instagram | `9:16` | `social` | `story-launch` |
| Thumbnail quadrado | `1:1` | `thumbs` | `thumb-x` |

Exemplo capa de curso 3:4:
```bash
node .claude/skills/estudio-ia/generate.mjs \
  --prompt "Glowing holographic terminal window floating in dark space, red prompt cursor blinking. Deep black #0A0A0A with red #E11D2E glow. Brutalist premium aesthetic. No text." \
  --slug curso-claude-code --bucket academy-covers --folder catalog --aspect 3:4
```

## Output

- Console: URL(s) pública(s)
- Arquivo salvo em `.claude/skills/estudio-ia/.tmp_result.json` com todos os resultados

## Modelos disponíveis

| ID | Alias | Qualidade | Velocidade | Uso |
|---|---|---|---|---|
| `gemini-2.5-flash-image` | Nano Banana | média | rápida | testes, iteração |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | boa | média | dia-a-dia |
| `gemini-3-pro-image-preview` | Nano Banana Pro | alta | lenta | final, produção |

## Limites

- Max prompt: ~10.000 chars
- Timeout por imagem: ~60s (Nano Banana Pro pode demorar)
- Batch: serial (não paralelo) pra não bater rate limit do Gemini

## Troubleshooting

| Erro | Causa | Fix |
|---|---|---|
| `Invalid or expired token` | `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` tá errada/vazia | Copia novamente do Supabase Dashboard |
| `Invalid Compact JWS` | Storage precisa do JWT legacy, não do `sb_secret_` | Garante que `SUPABASE_SERVICE_ROLE_JWT` tá setado |
| `Gemini não retornou imagem` | Prompt bloqueado por safety OU conteúdo vago | Reformula prompt mais específico |
| `GEMINI_API_KEY not configured` | Secret faltando no Supabase | Supabase Dashboard → Edge Functions → Secrets |

## Referências no código

- Edge function: `supabase/functions/gemini-image-gen/index.ts`
- Componente UI equivalente: `src/components/estudio-ia/EstudioIA.tsx` (acessível em `/estudio-ia`)
- Buckets disponíveis: `academy-covers`, `academy-videos`, etc (ver `supabase/migrations/`)

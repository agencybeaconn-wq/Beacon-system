# pagespeed — Análise de Core Web Vitals e gargalos de performance

Roda **Google PageSpeed Insights API** em uma loja (ou todas) e gera relatório com scores, Core Web Vitals e diagnósticos focados em **imagens, vídeos e JS** — os 3 gargalos típicos de Shopify.

## Quando usar

- "loja tá lenta", "score do PageSpeed", "Core Web Vitals", "performance ruim"
- "rodar PageSpeed em todas as lojas"
- "comparar performance das lojas"
- "achar gargalos de imagens/vídeos"
- "ranking das lojas por velocidade"
- "loja X tá com 40 de desempenho, descobre o que é"

## Triggers (linguagem natural)

- "pagespeed da loja X"
- "core web vitals"
- "checar performance"
- "loja tá lenta"
- "ranking de velocidade"
- "gargalos das lojas"
- "imagens grandes na loja"

## Modos

### 1. Loja única
```bash
node .claude/skills/pagespeed/pagespeed.mjs "JGS Sports"
```

### 2. Top N lojas mais ativas (recente)
```bash
node .claude/skills/pagespeed/pagespeed.mjs --top-recent=10
```
Ordena por atividade (`client_tasks` + `client_quality_runs` recentes).

### 3. Todas as lojas ativas
```bash
node .claude/skills/pagespeed/pagespeed.mjs --all
```
Cuidado: 50+ lojas = ~30 min e pode bater rate limit sem `PAGESPEED_API_KEY`.

### 4. Páginas analisadas (default: home)
```bash
# home + 1 PDP sample + 1 collection sample
node .claude/skills/pagespeed/pagespeed.mjs "JGS Sports" --pages=home,pdp,collection
```

### 5. Estratégia (mobile/desktop)
```bash
# Default: mobile (Google ranking principal)
node .claude/skills/pagespeed/pagespeed.mjs "JGS Sports" --strategy=both
```

### 6. Paralelização (default 4)
```bash
# Roda 4 lojas simultâneas (PSI permite até 240/min com key)
node .claude/skills/pagespeed/pagespeed.mjs --all --parallel=4
```
PSI demora ~90s por URL. Pool 4 → top 10 lojas em ~3 min, todas as 50+ em ~12 min.

### 7. Blacklist auto-skip
Lojas que crasham o Lighthouse (`Lighthouse returned error: Something went wrong`) entram numa blacklist em `out/pagespeed/_lighthouse-blacklist.json`. Após 2 falhas consecutivas, são puladas por 7 dias.

```bash
# Forçar análise mesmo em blacklistadas
node .claude/skills/pagespeed/pagespeed.mjs --all --retry-failed
```

## Output

1. **Console:** ranking das lojas por score mobile + tabela de gargalos
2. **JSON local:** `out/pagespeed/<YYYY-MM-DD>.json` (histórico)
3. **Markdown:** `out/pagespeed/<YYYY-MM-DD>-report.md` (relatório legível)

Output prioriza diagnósticos de:
- **Imagens:** unsized, oversized, modern formats (webp/avif), lazy load
- **Vídeos:** poster ausente, formato não otimizado, autoplay
- **JS:** unused JS, render-blocking, third-party scripts (apps Shopify)
- **Fontes:** font-display swap, preload
- **CLS:** elementos sem dimensão fixa

## API Key (opcional mas recomendado)

Sem chave: ~25 req/dia (rate limit duro do Google).
Com chave: 25.000 req/dia.

Pra setar:
1. Criar em https://console.cloud.google.com → "PageSpeed Insights API"
2. Adicionar no `.env`:
   ```
   PAGESPEED_API_KEY="AIza..."
   ```

## Limitações

- PSI não roda em URLs com bloqueio de bot (raro em Shopify)
- Lojas em `*.myshopify.com` redirecionam pra primary_domain — usar primary_domain dá score real
- PSI demora 20-40s por URL (lab data + field data via CrUX)
- Field data (CrUX) só existe pra URLs com tráfego suficiente — sem isso, só lab data

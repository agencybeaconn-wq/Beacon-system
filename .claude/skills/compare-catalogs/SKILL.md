---
name: compare-catalogs
description: Compara catálogos de 2 lojas (ou uma loja vs CSV exportado) por atributos estruturais — extrai team, year, kit, version, feminina/infantil/player de cada título e usa chave canônica pra match preciso. Evita falsos positivos do matching fuzzy. Suporta filtro por ano (ex 2026/27). Read-only — só gera relatório, não importa nada.
argument-hint: [cliente A] [--csv=path | --client=cliente B] [--year-filter=2026/27] [--markdown=out.md] [--out=out.json]
---

# compare-catalogs — Comparação estrutural de catálogos

Gera relatório detalhado comparando produtos entre 2 catálogos Shopify (ou um catálogo + CSV de export), usando **matching estrutural por atributos** ao invés de fuzzy de keywords.

## Quando usar

- **Gap analysis** — descobrir quais produtos outra loja tem que a sua não tem
- **Pré-deploy cliente novo** — ver o diff entre catálogo do template e catálogo atual do cliente antes de rodar `/import-missing`
- **Pós-scrape** — analisar um CSV de loja concorrente/referência contra BR dev
- **Validação cruzada** — confirmar que BR dev e EN dev estão sincronizados

## Triggers (linguagem natural)

- "comparar catálogos", "diff entre lojas"
- "o que a loja X tem que a Y não tem"
- "gap analysis de produtos"
- "quais produtos 2026/27 estão faltando"
- "quantos Flamengo 2026 tem em cada loja"

## Como funciona

Ao invés de comparar títulos por palavras-chave (que gera falsos positivos — ex: "Portugal I Jogador" = "Flamengo I Jogador" porque compartilham "I Jogador"), extrai **atributos estruturais** de cada título:

```js
extractAttributes("Camisa Feminina Fluminense 2026/27 I Torcedor") = {
  team: 'fluminense',
  year: '2026/27',
  kit: 'I',
  version: 'torcedor',
  feminina: true,
  infantil: false,
  player: null,
}
```

E gera uma **chave canônica** `team|year|kit|version|feminina|infantil|player` que é comparada entre os 2 catálogos.

Isso resolve os dois problemas do fuzzy:
1. **Falso positivo**: Portugal ≠ Flamengo porque `team` é diferente
2. **Falso negativo**: "Camisa Flamengo 2026/27 II Torcedor" (BR) = "Camisa Flamengo 2026/27 II" (Space) porque version default é `torcedor`

## Uso

```bash
# Comparar BR dev com CSV exportado, só 2026/27
node .claude/skills/compare-catalogs/compare-catalogs.mjs \
  "Loja de Desenvolvimento - BR" \
  --csv=shopify-store-spacesportsfut-com-br/produtos.csv \
  --year-filter=2026/27 \
  --markdown=.tmp_compare_2026.md

# Comparar 2 clientes (pre-deploy)
node .claude/skills/compare-catalogs/compare-catalogs.mjs \
  "Cliente Novo" \
  --client="Loja de Desenvolvimento - BR"

# Filtrar só 2026 (aceita 2026 OU 2026/27)
node .claude/skills/compare-catalogs/compare-catalogs.mjs \
  "De Boleiro" \
  --client="Loja de Desenvolvimento - BR" \
  --year-filter=2026

# Sem filtro (todos os produtos)
node .claude/skills/compare-catalogs/compare-catalogs.mjs \
  "Cliente" --client="Outro Cliente"
```

## Flags

| Flag | Descrição | Default |
|---|---|---|
| `--csv=path` | CSV em formato Shopify export (groupa por handle) | — |
| `--client=nome` | Cliente B pra comparar (em vez de CSV) | — |
| `--year-filter=X` | `2026/27` (exato) ou `2026` (qualquer 2026*) | sem filtro |
| `--markdown=path` | Output markdown legível | `.tmp_compare_<A>_vs_<B>.md` |
| `--out=path` | Output JSON detalhado | `.tmp_compare_<A>_vs_<B>.json` |
| `--json` | Só imprime JSON no stdout (silencioso) | — |

## Classificação

Pra cada produto (com year-filter ativo se usado):

- **`BOTH`** — chave canônica existe em A e B (produto em ambos)
- **`ONLY_A`** — existe em A mas não em B
- **`ONLY_B`** — existe em B mas não em A (**candidato a import**)
- **`AMBIGUOUS`** — atributos incompletos (team ou year null)

Produtos com `team=null` viram `AMBIGUOUS` em vez de serem forçados pro match — evita criar match errado em produtos que a lista canônica não reconhece.

## Lista canônica de times

~45 times em `TEAM_ALIASES`:
- **Brasileirão**: Flamengo, Palmeiras, São Paulo, Corinthians, Santos, Vasco, Botafogo, Fluminense, Cruzeiro, Atlético MG, Grêmio, Internacional, Bahia, etc
- **Champions League**: Real Madrid, Barcelona, Man Utd, Man City, Liverpool, Chelsea, Arsenal, PSG, Juventus, Milan, Inter, Bayern, Ajax, Tottenham
- **Seleções Copa do Mundo 2026**: Brasil, Argentina, França, Inglaterra, Alemanha, Espanha, Portugal, Itália, Holanda, Bélgica, Croácia, Uruguai, México, Canadá, Japão, Coreia do Sul, Marrocos, Senegal, Arábia Saudita

Cada time tem aliases (Mengão = Flamengo, Galo = Atlético MG, Timão = Corinthians, etc). Times fora da lista caem em `AMBIGUOUS` — expandir a lista via PR quando caso repetido aparecer.

## Relatórios gerados

### Markdown (humano)

```markdown
# Comparação: BR dev vs Space Sports — filtro 2026/27

## Totais
- BR dev (A): 1151 produtos (32 com 2026/27)
- Space (B):  1458 produtos (336 com 2026/27)

## Match estrutural
- BOTH (ambos têm):     120
- ONLY_A (só BR dev):    12
- ONLY_B (só Space):    204 → candidatos a import
- AMBIGUOUS:              0

## Gap do BR por time (só Space tem)
| Time | Qtd | Versões faltando |
|---|---|---|
| Flamengo | 5 | II (feminina+torcedor), player versions |
| Portugal | 8 | I+II em torcedor/jogador/feminina |
...

## ONLY_B — lista completa (204)
1. Camisa Portugal 2026/27 I Jogador [portugal|2026/27|I|jogador|f|f|null]
2. Camisa Grêmio 2026/27 I [gremio|2026/27|I|torcedor|f|f|null]
...
```

### JSON (máquina)

```json
{
  "sourceA": { "name": "Loja de Desenvolvimento - BR", "total": 1151, "filtered": 32 },
  "sourceB": { "name": "Space Sports (CSV)", "total": 1458, "filtered": 336 },
  "yearFilter": "2026/27",
  "counts": { "both": 120, "onlyA": 12, "onlyB": 204, "ambiguous": 0 },
  "byTeam": { ... },
  "both": [ { "key": "...", "a": {...}, "b": {...} } ],
  "onlyA": [ ... ],
  "onlyB": [ ... ],
  "ambiguous": [ ... ]
}
```

## Protocolo

VALIDATE → LOAD A → LOAD B → EXTRACT ATTRS → CLASSIFY → REPORT → LOG

**Read-only**: a skill NÃO importa, NÃO modifica produtos. Só gera relatório. Pra importar baseado no resultado, use `/import-missing` depois.

## Limitações conhecidas

1. **Times fora da lista canônica** (TEAM_ALIASES) caem em `AMBIGUOUS`. Revisar após primeiro run e expandir.
2. **Players com nome no título** (ex: "MEMPHIS N° 10") entram na chave, então a mesma camisa sem player vs com player é tratada como produto diferente — correto, mas infla ONLY_B se BR dev não tiver player versions.
3. **Bonés, acessórios, bolas** não têm kit/version — caem em bucket separado se detectados, não participam do matcher principal.
4. **Versão default = torcedor** quando título não especifica. Convenção pra catálogos onde "Torcedor" é omitido.

## Próximos passos após rodar

1. Revisar 10-20 amostras de `BOTH` pra confirmar que matcher não tá criando falsos positivos
2. Revisar 10-20 amostras de `ONLY_B` pra confirmar que realmente não estão no catálogo A
3. Se matcher tiver bom, rodar `/import-missing` com os handles do `ONLY_B` selecionados

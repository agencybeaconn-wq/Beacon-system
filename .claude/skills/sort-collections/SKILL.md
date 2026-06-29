---
name: sort-collections
description: Ordena produtos dentro das coleções de uma loja Shopify. Modo default ordena pela regra canônica (Ano/Tipo/Número) e suporta --priority-br (seleção Brasil + clubes BR primeiro) + --only-handles=X,Y (filtra coleções específicas). Modo --home-plan aplica estratégias de vitrine por handle — ideal pra reorganizar a Home com inteligência interpretativa (1 camisa por time, Brasil sempre primeiro, goleiro no fim, etc).
argument-hint: "[nome do cliente] [--home-plan plan.json | --priority-br --only-handles=a,b]"
---

# Sort Collections

Ordena produtos em coleções (smart + custom). Dois modos:

## Flags

- `--apply` — aplica o reorder (sem ele é DRY-RUN)
- `--priority-br` — ordena seleção Brasil + clubes brasileiros primeiro, depois sort key canônico. **Auto-bloqueado em lojas EN** (Brasileirissimo, GM Sports, MatchWear) — clientela internacional não casa com Brasil-primeiro. Use `--force-br --priority-br` se realmente quiser forçar.
- `--force-br` / `--force-en` — força o locale detectado (override da auto-detecção via shop info)
- `--only-handles=a,b,c` — ordena apenas coleções cujo handle casa (comma-separated). Ex: `--only-handles=lancamentos,feminina,infantil` pra mexer só nas tabs de Lançamentos.
- `--home-plan <plan.json>` — aplica estratégias de vitrine por handle (ver seção "Modo --home-plan" abaixo).
- `--resume` — retoma de um checkpoint anterior
- `--status` — mostra status de checkpoint salvo

### Detecção BR vs EN (auto)

A skill detecta o locale da loja no início via `shop.json` (currency BRL/country BR/locale pt-* → BR; senão EN). Isso afeta:
- `--priority-br` é **ignorado em lojas EN** — não faz sentido priorizar Flamengo/Palmeiras numa loja que vende pra mercado europeu/americano. Pra lojas EN, a regra canônica de TEAM_POPULARITY já prioriza top mundiais (Real Madrid, Barça, Bayern, Inter Miami) sem precisar de flag específico.
- Em lojas BR (Voltz, Boutique do Boleiro, Mantos do PH, etc): aplicar `--priority-br` e/ou `--home-plan` com estratégias de Brasil seleção.

Memórias relacionadas: `project_brasileirissimo_english`, `project_gm_sports_english`, `project_matchwear_english`.

### Exemplos

```bash
# Ordenação canônica em todas as coleções
node .claude/skills/sort-collections/sort-collections.mjs "JGS Sports" --apply

# Brasil primeiro nas 3 coleções de Lançamentos BR
node .claude/skills/sort-collections/sort-collections.mjs "JGS Sports" \
  --only-handles=lancamentos,feminina,infantil --priority-br --apply
```

### Lista BR_PRIORITY (hardcoded no .mjs)

`Brasil` (seleção) → `Flamengo` → `Palmeiras` → `Corinthians` → `São Paulo` → `Santos` → `Cruzeiro` → `Atlético Mineiro` → `Botafogo` → `Fluminense` → `Internacional` → `Grêmio` → `Vasco` → resto.

**Modo default** (sem `--home-plan`): ordena TODAS as coleções pela regra canônica **Ano desc → Tipo desc → Número desc** + round-robin em handles tipo `lancamentos|mais-vendidos|destaques|home|featured`.

**Modo `--home-plan`**: recebe JSON mapeando `handle → { strategy, gender, opts }` e aplica **estratégias de vitrine** inteligentes nas coleções da Home. Fora do plano, cai no default.

Script: `.claude/skills/sort-collections/sort-collections.mjs`.

## Fluxo (modo default)

IDENTIFY cliente → ANALYZE (dry-run) → PREVIEW count → CONFIRM → EXECUTE → REPORT.

1. `agency_clients` por nome (fuzzy, `shopify_status=connected`)
2. `node sort-collections.mjs <cliente>` (dry-run default)
3. Confirmar → rodar com `--apply`
4. Report: ordenadas / já corretas / erros / vazias

## Fluxo (modo --home-plan, "vitrine da Home")

Usa quando o colaborador pede **"reorganiza a Home da loja X"** ou equivalente.

1. Ler `templates/index.json` da loja (via lever-theme ou API) → extrair seções `featured-collection-tabs` e suas tabs → listar todas as coleções referenciadas na Home.
2. Pra CADA coleção, **interpretar o título+handle** (ex: "Rumo ao Hexa - Masculino" → Brasil seleção só; "Lançamentos" → clubes sem seleção; "Conjuntos Infantis Internacionais" → round-robin sem BR clubs; "Camisas Retrô" → por importância icônica).
3. Montar `/tmp/home-plan.json` mapeando cada handle pra `{ strategy, gender, opts }`.
4. Rodar `node sort-collections.mjs <cliente> --home-plan /tmp/home-plan.json` (dry-run).
5. Mostrar preview (top 10 de cada coleção com estratégia customizada) pro colaborador.
6. Aprovação → rodar com `--apply`.

### Estratégias disponíveis

| strategy | Quando usar | Comportamento |
|---|---|---|
| `brasil-selecao-only` | Rumo ao Hexa, Seleção Brasileira | Só produtos Brasil seleção. TIPO domina ANO (Torcedor > Jogador > Treino). Goleiro no fim. Retrô filtrado. |
| `lancamentos-clubes` | Lançamentos (se existe aba Seleções separada) | Clubes só (seleções filtradas). Round-robin por time (1 camisa/time na rodada 1). Ano desc dentro do time. Retrô + não-camisas (boné/blusa/jaqueta) filtrados. Goleiro no fim. |
| `conjuntos-infantis` | Conjuntos Infantis Nacional/Internacional | Round-robin por time, sem retrô. Opt `onlyInternational: true` filtra BR clubs fora. |
| `retros-iconicos` | Camisas Retrô | Brasil 2002 (penta) > Brasil 1970 (Pelé) > outros Brasil Copa > outros icônicos mundiais. Goleiro no fim. |

### Formato do home-plan.json

```json
{
  "masculino-brasil": { "strategy": "brasil-selecao-only", "gender": "masculino" },
  "feminina-brasil": { "strategy": "brasil-selecao-only", "gender": "feminino" },
  "infantil-selecao": { "strategy": "brasil-selecao-only", "gender": "infantil" },
  "lancamentos": { "strategy": "lancamentos-clubes", "gender": "masculino" },
  "feminina": { "strategy": "lancamentos-clubes", "gender": "feminino" },
  "infantil": { "strategy": "lancamentos-clubes", "gender": "infantil" },
  "conjuntos-infantis-internacionais": { "strategy": "conjuntos-infantis", "gender": "infantil", "onlyInternational": true },
  "retro": { "strategy": "retros-iconicos", "gender": "masculino" }
}
```

`gender`: `"masculino"` | `"feminino"` | `"infantil"`. Filtra produtos pra garantir que só os do gênero certo entrem (robusto contra smart rules amplas da loja).

## Mentalidade de vitrine (pra modo --home-plan)

**A Home é vitrine de açougue** — não pode ter 5 camisas do Flamengo seguidas, tem que mostrar variedade. Princípios que guiam a interpretação do Claude ao montar o home-plan:

1. **1 camisa por time na rodada 1.** Só depois que TODOS apareceram é que abre rodada 2 com Away/Jogador. Brasil seleção é exceção (2 slots: Home + Away).
2. **Gatilho emocional** domina popularidade absoluta. Inter Miami (Messi) vende mais que Atlético de Madrid. CR7 no Al-Nassr vende. Corinthians (Yuri Alberto/mídia) > Santos (Neymar/Memphis).
3. **Sem overlap entre vitrines da Home.** Se tem aba "Seleções", tira seleções de "Lançamentos". Se tem aba "Conjuntos Infantis", evita duplicação com "Lançamentos Infantil".
4. **Corte retrô = 4 anos.** Camisa 22/23 ou mais antiga = retrô, fora de Lançamentos/Seleções.
5. **Goleiro sempre no fim.** Ignora ano, ignora popularidade. Nicho pequeno — quem quer busca pela aba de pesquisa.
6. **Não-camisas fora.** Boné, blusa, jaqueta, casaco, moletom — fora de vitrines de camisa. (Conjuntos infantis mantém conjuntos, óbvio.)

Memory relacionado: `project_lever_modo_ativo`, `feedback_reorder_active_only`, `feedback_read_section_titles`.

## Algoritmo de sort (`getSortKey` — modo default)

Bucket `year * 10000 + type * 100 + num` (maior = primeiro). Regex mais específica primeiro.

**Year:**
- 26/27 ou 2026/27 → 100
- `\b2026\b` sem `/` (Copa do Mundo) → 95
- 25/26 ou 2025/26 → 90
- `\b2025\b` → 85
- 24/25 ou 2024/25 → 80
- retrô → 10, default → 50

**Type:**
- jogador/authentic/player → 95
- feminina/woman (não infantil) → 85
- infantil/kids → 80
- manga longa/longsleeve → 75
- regata/tank → 70
- conjunto treino/training set → 60
- treino/training → 55
- goleiro/goalkeeper → 45
- short → 40
- retrô → 30
- camisa/jersey → 100 · default → 50

**Number:** `\bI\b` (sem II/III) → 3, `\bII\b` (sem III) → 2, `\bIII\b` → 1

**Popularidade de time** (TEAM_POPULARITY no .mjs): Flamengo > Palmeiras > SP > Corinthians > Vasco > Santos > Cruzeiro > resto BR > Argentina > Portugal > Espanha > ... > Real Madrid > Barça > Manchester U > Bayern > Liverpool > PSG > resto EU.

**País** (BR_SELECAO_RE / BR_CLUBS_RE): Brasil seleção = 3, clubes BR = 2, resto = 1.

Aliases EN já suportados: Brazil, Germany, Spain, Italy, England, France, Mexico, Netherlands, Uruguay, Colombia, Japan, Belgium.

Prefixos EN no PREFIX_RE: Jersey, Shirt, Set, Kids Kit, training kit (além dos PT).

## Pitfalls

1. **`sort_order = manual` não propaga na hora** — Shopify precisa até 2.5s. Se `collectionReorderProducts` der "Can't reorder unless manually sorted", retry com `delay(2500)` após re-enviar `sort_order=manual`. Em run de 229 coleções, ~4 precisam retry.

2. **Rate limit concorrente** — NUNCA rodar 2+ scripts escrevendo no mesmo shop (sort + clear + price update). Shopify retorna 429 e ~2% falham. Serialize.

3. **Edição Especial vai pro fim** — `edi[çc][ãa]o especial` / `special edition` tem type < torcedor padrão (type=20 vs 100) pra não ocupar primeiros slots da home.

4. **Bonés fora** — `bon[ée]|caps?|hats?` → year=1 (último de tudo). Cliente não quer na home.

5. **Retrôs icônicos Brasil** — anos de Copa (1958, 1962, 1970, 1994, 2002) sobem dentro da faixa retrô (year=18 vs 10/15).

## Rate limit

`delay(400)` entre calls. Paginação products: 250 por página via `page_info`. Smart collection deleted+recreated = manter rules/disjunctive/sort_order/body_html/image/published.

## Semantic check (ANTES de re-ordenar)

Memory `feedback_read_section_titles` flagou: rule restrita demais resulta em coleção subpopulada (ex: "2026-27-jerseys" tinha 19 produtos quando deveria ter 1000+). Antes de re-ordenar, comparar count atual com **range esperado** por handle:

```js
import { checkAll } from '../../lib/collection-expectations.mjs';

const issues = checkAll(collections.map(c => ({ handle: c.handle, count: c.products_count, title: c.title })));
if (issues.length) {
  console.log(`\n⚠️  Semantic warnings (${issues.length}):`);
  for (const i of issues) console.log(`   ${i.handle}: ${i.message}`);
  console.log(`   → Considere rodar audit-smart-collections antes do re-sort.`);
}
```

Não bloqueia (warn-only). Operador decide se corrige rule antes de re-ordenar.

## Output

`/tmp/sort-collections-report.json` com `{ sorted, alreadyCorrect, errors, semantic_warnings[], results[] }`.

---

## Aprendizados Puskas 2026-05-21 — Reorganização end-to-end

Aplicado em loja com 5181 produtos, 261 smart collections. Operação combinou auditoria → fragment-fix → re-sort.

### Modo LIGA round-robin (NOVO)

Quando a coleção é uma **LIGA** (Brasileirão, Premier League, Bundesliga, etc), aplicar **round-robin entre times** em vez de "1 por time no topo + resto sequencial":

```
Round 1: Flamengo 26/27 Torcedor → Internacional 26/27 Torcedor → Cruzeiro 26/27 Torcedor → ... (1 por time, próximo da fila ordenada de cada)
Round 2: Flamengo 25/26 Torcedor → Internacional 25/26 Torcedor → ... (continua próximo de cada)
Round N: quando esgota Torcedor de um time, ele entra com Jogador → Feminina → Infantil → Agasalho (sequência LEVER), sempre 1 por iteração.
```

Implementação: `while (added > 0) { for (team of teams) if (groups[team].length) result.push(groups[team].shift()) }`

Garante: **1 produto de cada time aparece o quanto antes**. Não acumula 5 Flamengo seguidos.

### Modo TIME (sequência LEVER refinada)

Dentro de coleção de UM time:
**Torcedor (Fan) → Jogador (Player) → Feminina (Woman) → Infantil (Kids) → Agasalho (Jacket/Hoodie/Tracksuit/Pants/Polo)**, dentro de cada categoria: **ano DESC**.

Detecção (ordem dos regex importa — mais específico primeiro):
```js
if (/(jacket|hoodie|tracksuit|sweater|sweatpants|pants|polo|jaqueta|agasalho|corta\s*vento|treino)/i.test(t)) return 5; // Agasalho
if (/(kids|kid|infantil)/i.test(t)) return 4;
if (/(woman|women|feminin)/i.test(t)) return 3;
if (/(player|jogador)/i.test(t)) return 2;
return 1; // Torcedor (default)
```

### Detecção de TIME via lista hardcoded (NOVO)

Regex fuzzy (split palavras + clean) falha em casos como "Pre-Order Flamengo 2026/27" → detecta como time "pre order flamengo" (falso). Solução: **lista hardcoded** de 70+ times conhecidos com regex específica de cada.

```js
const KNOWN_TEAMS = [
  ['atletico mineiro', /atl[eé]tico\s*mineiro|atl[eé]tico\s*mg/i],
  ['sao paulo', /s[aã]o\s*paulo/i],
  ['bayern munich', /bayern\s*munich|bayern\s*munchen|bayern\s*de?\s*m[uü]nique/i],
  // ... +70 entries
];
```

Resultado: prefixos "Pre-Order", "Jersey", "Camisa", "Set", "Regata", "Training" deixam de criar "times" falsos.

### Fragmento único pra rule de smart collection (NOVO — feedback_search_fragments)

**Problema descoberto:** rule `TITLE CONTAINS "Atletico Mineiro"` retornava 50 produtos. Mas catálogo tinha 111 com "Atlético Mineiro" (acento). Shopify smart collection é case-insensitive mas **acento-sensitive**.

**Solução:** fragmento único que pega tudo (typos, acentos, variações):
- `"Mineiro"` → pega só Atlético Mineiro (111 produtos, +122% vs antes)
- `"Paulo"` → pega só São Paulo (sem acento problema)
- `"corin"` → pega só Corinthians (typos incluídos)
- `"Nassr"` → pega só Al Nassr
- `"Leverkusen"` → pega só Bayer 04

Cuidados:
- `"Inter"` é AMBÍGUO (Inter Milan, Inter Miami, Internacional). Use `"Internacional"` ou `"Inter Milan"` específico.
- `"Sport"` genérico demais. Use `"Sport Recife"`.
- `"Real"` pega Real Madrid + Real Sociedad + Real Salt Lake. Use `"Real Madrid"` específico.

**Algoritmo automático:**
1. Pega `title` da coleção, tira parênteses e palavras genéricas (FC, CF, jersey, kit, fan, etc).
2. Pega a palavra mais longa restante (geralmente o nome distintivo).
3. Testa via `products(query: "title:*<frag>*")` — se retorna ≥1 produto, usa.
4. Aplica como rule disjunctive (variantes com e sem acento).

Manual overrides hardcoded pra times que precisam combinação específica.

### sortOrder=MANUAL via GraphQL (PRE-REQUISITO)

`collectionReorderProducts` exige `sortOrder=MANUAL`. Setar via GraphQL `collectionUpdate(input: { id, sortOrder: MANUAL })` ANTES do reorder. REST PUT `/collections/{id}.json` com `sort_order: 'manual'` **retorna 406** (Shopify rejeita pra smart collections via REST). Sempre usar GraphQL.

### Diagnóstico antes de publicar tudo

**Pitfall**: `published_at=null` em produtos pode parecer "coleção vazia" mas é só problema de publicação no Online Store. Antes de assumir falta de produto:
1. Contar via REST `products.json?fields=published_at`
2. Se muitos `null`, ver SE foram duplicados (dedupe deletou os publicados, sobraram os antigos unpublished).
3. NÃO publicar em massa sem confirmação — pode ressuscitar lixo.

Na Puskas: 1606 de 5181 produtos (31%) estavam `published_at=null` — eram cópias antigas dos duplicados deletados. **Não publicar.**

### Pipeline completo Puskas

```
1. audit-smart-collections (descobre handles faltantes + WARN)
2. fragment-fix em todas (rule disjunctive com fragmentos únicos + variantes acento)
3. Aguardar reindex Shopify (~5min — sem isso productsCount fica stale)
4. sort-collections em todas (LIGA round-robin + TIME categoria/ano)
5. publish theme draft → main
```

Resultado: 220 coleções repopuladas, 208 ordenadas, 0 fail.

### Cross-references

- Memory: [[feedback_search_fragments]] — base teórica do fragmento único
- Memory: [[feedback_team_competitions_membership]] — cada time aparece nas competições corretas
- Memory: [[feedback_filtro_titulo_nao_tag]] — priorizar TITLE sobre tag
- Memory: [[feedback_sao_paulo_catchall_pattern]] — armadilha de handle ambíguo
- Skill: [[audit-smart-collections]] — roda antes do sort pra detectar handles fora do range

# Skills — Hub Central

Este é o hub de referência de todas as skills do **Lever System**. Organizadas por família funcional, cada uma tem exemplo em linguagem natural pra invocação automática.

> 💡 **Você NÃO precisa digitar `/nome-da-skill`**. O Claude invoca automaticamente baseado na "Regra Zero" do [CLAUDE.md](../../CLAUDE.md).

## 📊 Inventário por família

### 🚀 Deploy & Setup

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/plan`](plan/SKILL.md) | Planejamento socrático com passos mapeados pras skills | *"o que fazer com o cliente X?"* |
| [`/deploy-store`](deploy-store/SKILL.md) | Deploy completo de loja nova em 1 comando | *"subir loja nova pro cliente Y"* |
| [`/implement`](implement/SKILL.md) | Executa tasks do kanban automaticamente | *"rodar as demandas do cliente X"* |

### 💰 Preços

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/update-prices`](update-prices/SKILL.md) | Parse tabela do WhatsApp + salva banco + aplica | *"atualiza preços: Torcedor R$209 Jogador R$249..."* |
| [`/bulk-fix-prices`](bulk-fix-prices/SKILL.md) | Audita banco vs Shopify e corrige divergências | *"corrigir preços do cliente X"* |

### 🎨 Tema

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/lever-theme`](lever-theme/SKILL.md) | Pull/duplicate/preview/publish workflow dev-first | *"o preço na página do produto tá estranho"* |
| [`/configure-theme`](configure-theme/SKILL.md) | Settings do tema via briefing (header, frete, milestones) | *"configurar tema do cliente X"* |

### 📦 Produtos

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/import-missing`](import-missing/SKILL.md) | Lista produtos do template faltando no cliente | *"quais produtos faltam na loja X"* |
| [`/clean-titles`](clean-titles/SKILL.md) | Remove marcas (Nike/Adidas) + corrige Feminino→Feminina + **collision detection** | *"limpar títulos do cliente X"* |
| [`/bulk-descriptions`](bulk-descriptions/SKILL.md) | Altera descrições em massa: find/replace, append/prepend, template por categoria | *"padronizar descrições"* |
| [`/dedupe-products`](dedupe-products/SKILL.md) | Detecta + remove produtos duplicados (handle ou título) — background-safe | *"remover produtos duplicados"* |
| [`/fix-options`](fix-options/SKILL.md) | Padroniza Tamanho/Personalizar + escassez PP/5GG | *"padronizar tamanhos do cliente"* |
| [`/fix-handles`](fix-handles/SKILL.md) | Corrige handles PT→EN em lojas EN | *"URLs em português na loja EN"* |
| [`/sort-collections`](sort-collections/SKILL.md) | Reordena produtos por Ano → Tipo → Número | *"2026/27 tem que vir primeiro"* |

### 🧹 Limpeza estrutural (Fase 7)

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/create-standard-pages`](create-standard-pages/SKILL.md) | Cria as 6 páginas legais BR (ou 3 EN) a partir de templates | *"criar aviso legal, política de privacidade"* |
| [`/fix-broken-menus`](fix-broken-menus/SKILL.md) | Remove menu items apontando pra entidades inexistentes | *"menu com links quebrados"* |
| [`/fix-empty-collections`](fix-empty-collections/SKILL.md) | Classifica + corrige smart collections vazias (delete / typo fix / relax) | *"coleção vazia", "smart collection não popula"* |

### 🎁 Promoções

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/create-discount`](create-discount/SKILL.md) | Cupons BXGY (Pague 2 Leve 3, etc) com presets | *"criar pague 2 leve 3 no cliente X"* |

### 🔍 Auditoria

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/audit-store`](audit-store/SKILL.md) | 11 checks profundos, 2-5 min, relatório completo | *"auditoria completa do cliente X"* |
| [`/quality-gate`](quality-gate/SKILL.md) | **17 checks** rápidos, ~90s, score 0-100, salva DB | *"rodar quality-gate"* |

### 🤖 AI / MCP (Fase 6)

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/lever-agent`](lever-agent/SKILL.md) | Agente que busca produtos via Storefront MCP (AI Toolkit Shopify) | *"procura camisa flamengo na loja X"* |
| [`/shopify-docs`](shopify-docs/SKILL.md) | Busca rápida na doc Shopify espelhada (7.8k páginas) | *"como funciona productSet mutation?"* |

### 🔧 Genéricas

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/shopify`](shopify/SKILL.md) | Fallback pra operações ad-hoc não cobertas | *"listar pedidos de ontem do cliente X"* |
| [`/code-blocks`](code-blocks/SKILL.md) | Copia features Liquid entre lojas | *"copiar seção X do cliente A pro B"* |

### 🏗️ Dev Interno

| Skill | Descrição | Exemplo em linguagem natural |
|---|---|---|
| [`/component`](component/SKILL.md) | Cria componente React com shadcn/ui | *"criar componente de dashboard"* |
| [`/edge-function`](edge-function/SKILL.md) | Cria edge function Supabase | *"criar edge function pra X"* |

---

## 🎯 Fluxos típicos

### Cliente novo (do zero)
```
/plan pro cliente novo
  ↓
/deploy-store (coleções + menus + páginas + tema + produtos)
  ↓
/configure-theme (settings a partir do briefing)
  ↓
/update-prices (tabela do cliente)
  ↓
/fix-options (tamanhos/escassez)
  ↓
/sort-collections (ordenar)
  ↓
/quality-gate (validar tudo OK)
```

### Cliente manda tabela de preços nova
```
Cola no chat: "atualiza preços do cliente X: Torcedor R$209..."
  → Claude invoca /update-prices automaticamente
  → VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG
```

### Bug no tema ("preço não aparece")
```
"o preço no produto do cliente X tá errado"
  → Claude consulta themes/KNOWLEDGE_BASE.md
  → Identifica tópico "Preço na página de produto"
  → Lista arquivos: snippets/price.liquid, product-installments.liquid
  → Confirma com user antes de abrir
  → /lever-theme pull-client X
  → /lever-theme duplicate X (cria draft)
  → Edita localmente
  → /lever-theme draft-sync X --apply
  → /lever-theme preview X (browser)
  → User aprova
  → /lever-theme publish X --apply --yes
```

### Cliente reclama "tem algo estranho"
```
"checar saúde do cliente X"
  → /quality-gate X
  → 14 checks em ~90s
  → Score 0-100 + breakdown
  → Se houver FAIL crítico, Claude sugere skills pra corrigir
```

### Manutenção semanal
```
node .claude/skills/quality-gate/run-weekly.mjs
  → Roda em TODOS clientes conectados (paralelo)
  → Salva em client_quality_runs
  → Gera relatório em .claude/logs/weekly-{date}.md
  → Dashboard "Quality" do ShopifyManager mostra scores + tendências
```

---

## 📜 Protocolo de execução

**Toda skill destrutiva segue [PROTOCOL.md](../PROTOCOL.md):**

```
VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG
```

- **VALIDATE**: assert cliente existe, Shopify conectada, entidades alvo existem
- **DRY-RUN**: calcula sem aplicar, gera plano completo
- **PREVIEW**: mostra resumo + amostra ao user
- **CONFIRM**: aguarda "sim" explícito
- **EXECUTE**: aplica respeitando rate limit
- **LOG**: append em `.claude/logs/execution.jsonl`

Ver visualização no ShopifyManager → tab "Protocolo".

---

## 🧩 Lib compartilhada

Todas as skills reusam helpers de [.claude/lib/](../lib/):

- **[`shopify-pricing.mjs`](../lib/shopify-pricing.mjs)** — `categorize()`, `calcExpectedPrice()` (fonte única de verdade)
- **[`shopify-api.mjs`](../lib/shopify-api.mjs)** — `shReq`, `shopifyGraphQL`, `paginate`, `getCreds`, `delay`
- **[`supabase-rest.mjs`](../lib/supabase-rest.mjs)** — `fetchClient`, `fetchPricing`, `upsertPricing`
- **[`validate.mjs`](../lib/validate.mjs)** — `assertClientExists`, `assertShopifyConnected`, `appendExecutionLog`
- **[`theme-knowledge.mjs`](../lib/theme-knowledge.mjs)** — parser do KNOWLEDGE_BASE.md + matcher NL→arquivos

**Regra importante:** Nunca duplique código da lib. Se precisar de uma função nova, adicione na lib e importe.

---

## 🎨 Tema Lever

- **Templates versionados**: [themes/lever-br/](../../themes/lever-br/) (408 arquivos) + [themes/lever-en/](../../themes/lever-en/) (398)
- **Knowledge base**: [themes/KNOWLEDGE_BASE.md](../../themes/KNOWLEDGE_BASE.md) — 25 tópicos NL → arquivos
- **Arquitetura**: [themes/ARCHITECTURE.md](../../themes/ARCHITECTURE.md) — doc completa (color schemes, customizações Lever, BR vs EN)

---

## 🚦 Regras de paralelismo (importante!)

| Cenário | Seguro? |
|---|---|
| Read-only + múltiplas lojas | ✅ Paralelo OK |
| Writes + lojas diferentes | ✅ Paralelo até ~5 |
| Writes + mesma loja | ❌ **Sempre serializar** |
| Qualquer write: delay mínimo | 500ms entre requests |

Shopify REST rate limit: ~2 req/s no bucket por loja. Violar = 429.

---

## 📝 Onde estão as coisas

```
Lever-System/
├── CLAUDE.md                    ← Regra Zero + regras globais
├── .claude/
│   ├── PROTOCOL.md              ← Protocolo único
│   ├── skills/<nome>/SKILL.md   ← docs de cada skill
│   ├── skills/<nome>/*.mjs      ← scripts executáveis
│   ├── lib/                     ← helpers compartilhados
│   ├── logs/execution.jsonl     ← log de execuções (gitignored)
│   └── tests/skill-matrix.md    ← matriz de testes
├── themes/
│   ├── KNOWLEDGE_BASE.md        ← NL → arquivos do tema
│   ├── ARCHITECTURE.md          ← doc estrutural do tema
│   ├── lever-br/                ← tema BR versionado
│   ├── lever-en/                ← tema EN versionado
│   └── client-<id>/             ← temas de clientes (gitignored)
└── WORKFLOW.md                  ← manual cenário-a-cenário
```

---

## 📈 Status das skills

Última atualização: **2026-04-11** (Fase 7 concluída — Reliability & Consolidation)

- **27 skills** totais (24 Shopify/AI + 3 dev interno)
- **17 checks** no quality-gate — com correção Fase 7 no checkBrokenMenus (agora via GraphQL, evita 403 do REST)
- **Background-safe pattern** em update-prices, bulk-fix-prices, dedupe-products (checkpoint + SIGINT + --resume + --status)
- **Reliability**: collision detection em clean-titles, rollback em theme-publish, assertEnv em create-discount, rollback hint em theme-propagate
- **5 skills novas Fase 7**: dedupe-products, create-standard-pages, fix-broken-menus, fix-empty-collections, lever-theme/theme-watch (hot reload)
- **categorize() expandido** cobre chuteira, meia, bone, acessório, baby body, etc
- **Bulk operations** nas skills de volume (update-prices, bulk-fix-prices, clean-titles, import-missing)
- **MCP integration** com Storefront MCP + lever-agent skill
- **7.837 páginas** de shopify-docs indexadas + consultáveis via `/shopify-docs`
- **API version 2026-04**
- **Webhooks reativos** via edge function + shopify-watch.mjs

Ver test matrix em [.claude/tests/skill-matrix.md](../tests/skill-matrix.md).

## 📚 Reference cheatsheets (Fase 6h)

| Reference | Descrição |
|---|---|
| [shopify-mutations.md](../reference/shopify-mutations.md) | Mutations essenciais por categoria (Products, Collections, Bulk, Menus, Metaobjects, Webhooks) |
| [shopify-webhooks.md](../reference/shopify-webhooks.md) | Topics úteis, payloads, HMAC, infra Lever |
| [shopify-mcp.md](../reference/shopify-mcp.md) | 3 MCP servers (Storefront, Catalog, Checkout), tools, UCP shape |
| [shopify-liquid.md](../reference/shopify-liquid.md) | Filters/tags modernos (image_tag, metaobjects, section groups, app blocks) |

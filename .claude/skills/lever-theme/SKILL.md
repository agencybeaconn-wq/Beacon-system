---
name: lever-theme
description: Edita o tema Lever (Shopify) com workflow local — pull dos temas de desenvolvimento, edit, preview, push-dev, e propagação controlada pros clientes. Evita edições diretas nas lojas de produção.
argument-hint: [pull|dev|push-dev|propagate|diff|diff-br-en] [br|en|<cliente>]
---

# Lever Theme — Workflow Local

Gerencia o tema Lever (`Tema Lever Atualizado 18/03`) com workflow **"dev-first"**: edições começam nas lojas de desenvolvimento (Template BR + Template EN), só depois propagadas pros clientes com `diff` + `confirm` + `allowlist`.

## 🔄 Workflow Recomendado: "Draft no próprio shop do cliente"

**NOVO (Fase 5b):** Em vez de editar o tema template BR/EN pra depois propagar, o workflow correto é **duplicar o tema do cliente dentro do próprio shop dele**, editar no draft, testar via preview, e publicar quando aprovado. Isso resolve o problema de cada cliente ter customizações únicas (templates per-team, settings próprios).

### Fluxo completo pra edição de tema em 1 cliente

```
1. Pull do tema do cliente pra pasta local temporária (gitignored)
   node .claude/skills/lever-theme/theme-pull-client.mjs "Nome Cliente"
   → themes/client-<id-prefix>/ (400 arquivos)

2. Criar DRAFT theme dentro do shop do cliente (cópia unpublished do main)
   node .claude/skills/lever-theme/theme-duplicate.mjs "Nome Cliente"
   → retorna draftThemeId + previewUrl, salva em .theme-draft.json

3. Claude edita arquivos locais em themes/client-<id-prefix>/

4. Subir diferenças pro draft (allowlist rígida + dry-run + confirm)
   node .claude/skills/lever-theme/theme-draft-sync.mjs "Nome Cliente"              # DRY-RUN
   node .claude/skills/lever-theme/theme-draft-sync.mjs "Nome Cliente" --apply      # APLICA

5. Testar no preview URL (abre na storefront do cliente com draft)
   node .claude/skills/lever-theme/theme-preview.mjs "Nome Cliente" --open

6. User aprova → publicar draft como main
   node .claude/skills/lever-theme/theme-publish.mjs "Nome Cliente" --apply --yes
   → draft vira main, main anterior fica unpublished (rollback possível)
```

**Allowlist de sync:** `sections/*.liquid`, `snippets/*.liquid`, `assets/*.{js,css,liquid}`, `layout/*.liquid`, `config/settings_schema.json`

**Blocklist (nunca sobrescreve):** `templates/*.json`, `config/settings_data.json`, `locales/*.json`

### Comandos legados (ainda úteis)

- `/lever-theme pull br|en` — pull dos temas template (versionados no git)
- `/lever-theme push-dev br|en` — sobe melhorias no template (Fase 3, não cliente)
- `/lever-theme propagate <cliente>` — pega dev template e propaga pra cliente (**legado**: use o draft workflow acima pra edições do cliente)
- `/lever-theme diff-br-en` — detectar drift entre templates BR e EN

## ⭐ Identificação via Linguagem Natural — SEMPRE COMEÇAR AQUI

Quando o user descreve um problema de tema em linguagem natural (ex: "o preço tá estranho", "barra de progresso quebrada", "menu mobile sumiu"), **Claude NÃO deve adivinhar** quais arquivos olhar. Sempre consulte o knowledge base:

**1. Consultar [`themes/KNOWLEDGE_BASE.md`](../../../themes/KNOWLEDGE_BASE.md):**

```bash
# Usa o matcher pra achar o tópico mais relevante
node .claude/lib/theme-knowledge.mjs "descrição do problema aqui"
```

Ou importa direto no script:
```js
import { loadKnowledge, findTopic } from '../../lib/theme-knowledge.mjs';
const topics = await loadKnowledge();
const matches = findTopic(topics, userDescription, 3);
// matches[0].topic tem { name, files, settings, commonBugs }
```

**2. Confirmar com o user antes de abrir arquivos:**

> "Você está falando sobre o **[nome do tópico]**? Vou investigar os arquivos:
> - `snippets/X.liquid`
> - `assets/Y.css`
> - `config/settings_schema.json` (seção Z)
>
> Tudo bem prosseguir?"

**3. Só abre os arquivos DEPOIS do OK do user.** Evita alucinação e mostra transparência.

**Atualização do knowledge base:** Sempre que adicionar um snippet/section novo importante ao tema, atualize o `KNOWLEDGE_BASE.md` com um novo grouping.

Segue [PROTOCOL.md](../../PROTOCOL.md): VALIDATE → DRY-RUN → PREVIEW → CONFIRM → EXECUTE → LOG.

## Por que "dev-first"

Editar o tema de um cliente direto via API:
- ❌ Sem preview
- ❌ Sem rollback fácil
- ❌ Claude pode alucinar e quebrar a loja em produção
- ❌ Cada cliente tem customizações (templates per-team) que podem ser sobrescritas

Com workflow "dev-first":
- ✓ Pull → edit local → preview (`shopify theme dev`) → push pra DEV → teste
- ✓ Propaga pro cliente só depois de aprovado, com **allowlist explícita** de arquivos
- ✓ Templates per-team (`collection.flamengo.json`, `collection.corinthians.json`) **nunca** são sobrescritos
- ✓ Settings do cliente (`config/settings_data.json`) preservados

## Temas-alvo

| Sigla | Loja | Tema | ID | Idioma |
|---|---|---|---|---|
| `br` | testeloja-9899.myshopify.com | Tema Lever Atualizado 18/03 | 160282804466 | pt-BR |
| `en` | loja-de-estruturacao-e-desenvolvimento-en.myshopify.com | Tema Lever EN | (descobrir no 1º pull) | en-US |

## Pré-requisitos

Scripts em `.claude/skills/lever-theme/`: `theme-pull.mjs`, `theme-push.mjs`, `theme-diff.mjs`, `theme-propagate.mjs`. Shopify CLI opcional pra `theme dev` live preview (`npx shopify auth login` 1× por máquina). Pastas `themes/lever-br/` e `themes/lever-en/` criadas no primeiro pull.

## Subcomandos

### `/lever-theme pull <br|en>` — Baixa tema da loja DEV

```bash
npx shopify theme pull --store=testeloja-9899.myshopify.com --theme=160282804466 --path=themes/lever-br
npx shopify theme pull --store=loja-de-estruturacao-e-desenvolvimento-en.myshopify.com --path=themes/lever-en
```

Resultado: 400 assets em cada pasta (sections, snippets, assets, locales, templates, config, layout).

**Quando usar:** pra sincronizar a cópia local com alterações feitas direto no admin da Shopify (ex: um designer mexeu no customizer).

### `/lever-theme dev <br|en>` — Preview local em `localhost:9292`

```bash
cd themes/lever-br
npx shopify theme dev
```

Abre o tema local com hot-reload conectado ao shop dev. Edições nos arquivos locais refletem instantâneamente no browser.

**Quando usar:** iterar rápido em mudanças de tema (CSS, Liquid, schemas).

### `/lever-theme push-dev <br|en>` — Sobe edições pra loja DEV (nunca cliente)

```bash
cd themes/lever-br
npx shopify theme push --theme=160282804466
```

**Importante:** só aceita `--theme=<id da loja DEV>`. Nunca passa theme de cliente.

### `/lever-theme propagate <cliente>` — Aplica tema dev em cliente específico

Este é o subcomando mais delicado. Fluxo:

1. **Identifica o cliente** via `fetchClient()`
2. **Detecta idioma** do tema do cliente (`shopify_domain` com `-en` ou `.com` → EN, senão BR)
3. **Lê o tema dev local correspondente** (`themes/lever-br/` ou `themes/lever-en/`)
4. **Gera diff** entre local e o tema do cliente (via `get_asset` pra cada arquivo da allowlist)
5. **Mostra PREVIEW** ao user: lista arquivos a atualizar (com diff de linhas) + arquivos IGNORADOS (blocklist)
6. **Aguarda confirmação** do user
7. **Aplica via `put_asset`** um arquivo por vez (delay 400ms pra evitar rate limit)
8. **Log** em `execution.jsonl`

### `/lever-theme diff <cliente>` — Compara cliente com dev sem aplicar

Mesmo que `propagate` mas para na etapa 5 (PREVIEW). Útil pra checar se um cliente tá desatualizado antes de decidir propagar.

### `/lever-theme diff-br-en` — Compara BR vs EN pra detectar drift

Checa se os dois temas dev divergiram em arquivos que deveriam ser idênticos (sections, snippets, schemas). Arquivos esperadamente diferentes (`locales/*.json`) são ignorados.

## Allowlist (propagate)

**Copia do dev pro cliente:**
- `sections/*.liquid`
- `snippets/*.liquid`
- `assets/*.{js,css,liquid}` (exceto assets gerados)
- `layout/*.liquid`
- `config/settings_schema.json` (apenas schema, não data)

**NUNCA copia (blocklist):**
- `templates/*.json` — customizações per-team (collection.flamengo.json, etc)
- `config/settings_data.json` — settings específicos do cliente (cores, licença, milestones)
- `locales/*.json` — i18n próprio do cliente

## BR vs EN

Os dois temas têm **mesma estrutura** mas `locales/` divergem. Regras:

1. **Edição em `sections/*.liquid`, `snippets/*.liquid`, `assets/*`**: a mesma edição vale pra BR e EN. Depois de push-dev BR, ofereça propagar pro EN (Claude pergunta).
2. **Edição em `locales/*.json`**: NUNCA propaga entre BR e EN (idiomas diferentes).
3. **Edição em `config/settings_schema.json`**: deve propagar (schema é igual).

## Como Claude acessa os arquivos

Depois do `pull` inicial, Claude lê **direto do filesystem** via Read/Grep (`themes/lever-br/sections/...`). Mais rápido que API e dá contexto cross-file (grep por snippet name em templates).

## Arquivos-chave do tema Lever

| Arquivo | Propósito |
|---|---|
| `sections/collection-list-tabs.liquid` | Case statement com mapeamento handle → logo do time |
| `sections/collection-player-tabs.liquid` | Mapeamento handle → foto do jogador |
| `sections/custom-patch-rules.liquid` | Configurador de patches no produto |
| `sections/custom-player-rules.liquid` | Configurador de nome/número no produto |
| `sections/featured-collection-tabs.liquid` | Tabs da home (Masculino/Feminino/Infantil) |
| `sections/header-group.json` | Header config (suporte, telefone, email) |
| `sections/footer-group.json` | Footer config |
| `config/settings_data.json` | Milestones, frete, social, cores, licença |
| `config/settings_schema.json` | Definição dos campos editáveis |
| `templates/collection.flamengo.json` | Customização específica Flamengo |
| `templates/cart.json` | Progress bar + milestones + frete |

## Regras de ouro

1. **Nunca edite direto no tema de um cliente** — sempre pull dev → edit → push-dev → propagate
2. **Templates per-team são sagrados** — blocklist garante que não serão sobrescritos
3. **Antes de propagate**, rode `diff` pra confirmar o que muda
4. **Lojas dev são a source of truth** — se alguém alterou via admin, sempre faça `pull` antes de editar
5. **BR e EN devem estar sincronizados** em sections/snippets (rode `diff-br-en` antes de propagates grandes)

Processe $ARGUMENTS conforme os passos acima.

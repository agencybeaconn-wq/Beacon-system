# Agentes Claude Code da Lever

Subagentes especializados que vivem em `.claude/agents/`. Cada um cobre uma fatia operacional da Lever Shopify. **Pra invocar:** use o tool `Agent` com `subagent_type: <nome>`.

> Detalhes operacionais ricos (cicatrizes, condecorações, feitos): vault Obsidian Lever QI → `07-team/05-pedro-dev/projetos/01-agentes-claude-code/galeria-de-herois.md`.

---

## 🪖 lever-catalogo — "O Calculista"
**Arquivo:** [`lever-catalogo.md`](lever-catalogo.md)

**O que faz:** Operações de catálogo — preços, produtos, variants, coleções, cupons, BxGy, dedupe. Cada centavo da loja passa por ele.

**Skills que invoca:** `update-prices`, `bulk-fix-prices`, `import-missing`, `sort-collections`, `audit-smart-collections`, `create-discount`, `dedupe-products`.

**Quando usar:**
- "Atualizar preços tabela", "corrigir preços", "compare_at fora do padrão"
- "Importar produtos faltantes" do template
- "Criar BxGy / cupom"
- "Auditar smart collections"

**Conhece:**
- Personalização sempre +R$30 (memory `feedback_personalizacao_minimo_30`)
- Compare_at 2x na criação, não inflar em updates
- BR vs EN sizes (P/M/G/GG vs S/M/L/XL)
- Filtro cascata anti-duplicatas

---

## 🪖 lever-tema — "O Cirurgião"
**Arquivo:** [`lever-tema.md`](lever-tema.md)

**O que faz:** Customização visual do tema — PDP, cart-drawer, kit-casal, patches, milestones, hero, banners. Toda pixel da storefront passa por ele.

**Skills que invoca:** `lever-theme`, `code-blocks` (cópia E inspiração), `inline-customization`, `pagespeed`, `template-lint/parity`.

**Quando usar:**
- "Editar tema da loja X" (PDP, cart drawer, hero, banner)
- "Replicar feature da loja A pra loja B" (mode CÓPIA ou INSPIRAÇÃO)
- "Personalização inline na PDP"
- "Loja tá lenta" (pagespeed)
- "Drift entre tema BR e EN"

**Conhece malícia de 24+ sessões em `blocks/history/`.** Cuidados ativos:
- NUNCA MutationObserver no cart (Loja da Torcida 2026-05-14 quebrou prod)
- NUNCA CSS global no PDP
- NUNCA empilhar 2 mudanças visuais sem confirmação

---

## 🪖 lever-deploy — "O Estrategista"
**Arquivo:** [`lever-deploy.md`](lever-deploy.md)

**O que faz:** Subir loja nova do briefing ao live. Orquestra deploy completo: theme, coleções, menus, produtos, páginas, licença, polish. Coordena os outros 3 agentes em combos multi-agente.

**Skills que invoca:** `preflight-deploy`, `deploy-complete`, `configure-theme`, `create-standard-pages`, `clone-store`.

**Quando usar:**
- "Subir loja nova pro Cliente X"
- "Checar pré-requisitos pra deploy" (preflight)
- "Clonar JGS pro Cliente Y"
- "Configurar tema da loja" (contato, milestones, frete)

**Conhece:**
- Diferença Template BR (R$, PT) vs Template EN (USD/$, EN, sizes universais)
- Checklist 13 categorias + 12 erros comuns
- Triple-source: Shopify Admin + Supabase + tema Lever

---

## 🪖 lever-qa — "O Sentinela"
**Arquivo:** [`lever-qa.md`](lever-qa.md)

**O que faz:** Saúde da loja, drift BR vs EN, watchdog diário, auditorias gerais. **Read-only por padrão** — só corrige com aval explícito do Pedro.

**Skills que invoca:** `quality-gate`, `audit-store`, `audit-smart-collections`, `dev-watchdog`, `template-lint/parity`, `pagespeed`.

**Quando usar:**
- "Auditoria da loja X" (read-only)
- "Comparar tema BR vs EN"
- "Saúde da loja, gargalos"
- "Watchdog diário Template BR + EN"

**Filosofia:** detectar antes de quebrar. Reportar, não consertar (a menos que peça).

---

## 🤖 obsidian-curator — "O Fiscal"
**Arquivo:** [`obsidian-curator.md`](obsidian-curator.md)

**O que faz:** FUNIL/FILTRO entre Claude e Obsidian (estilo branch protection do GitHub). Audita TODA escrita proposta no Obsidian — verifica duplicação, contexto, scope, MVP, cross-link. Bloqueia lixo, sugere merge/extend/replace antes de criar.

**Modelo:** Haiku 4.5 (rápido + barato pra audit volumoso).

**Quando ativa:**
- Hook `UserPromptSubmit` detecta gatilho "obsidian" no prompt do usuário
- Antes de qualquer Write/Edit em `Lever QI/`, o sistema lembra de invocar este agente
- Modo soft-flag: passa com warnings em vez de bloquear (warnings vão pra `07-team/05-pedro-dev/sub-agentes-pedro/obsidian-curator/curator-decisions-<date>.md`)

**Vereditos:**
- `PASS` — Tá clean, escreve
- `SOFT-FLAG` — Passa com warnings (anotar e seguir)
- `HARD-FLAG` — Bloqueia (problema sério, refazer)

---

## Como invocar

```js
// No Claude Code, dentro de uma sessão:
Agent({
  subagent_type: "lever-catalogo",
  description: "Atualizar preços Mantos do PH",
  prompt: "Cliente Mantos do PH mandou nova tabela de preços via WhatsApp [colar tabela]. Audita primeiro com bulk-fix-prices dry-run, depois aplica."
})
```

Cada agente tem o próprio `.md` com regras inquebráveis, skills permitidas, escopo, exemplos. Lê antes de invocar pra entender o escopo.

## Treinamento

Pasta `campo-de-treinamento/` tem demandas fake sandbox onde Pedro treinou os 4 agentes (4 fases). Diários de cada agente em `<agent-name>/diario.md`. Sistema 5 estrelas — cada erro/insight custa/dá pontos.

## Pra mais contexto

- Vault Obsidian Lever QI: `07-team/05-pedro-dev/projetos/01-agentes-claude-code/`
- Galeria de heróis: cicatrizes + feitos cronológicos
- Ficha do Pedro: estilo de trabalho, regras inquebráveis, contexto pessoal (agentes leem antes de cada demanda)

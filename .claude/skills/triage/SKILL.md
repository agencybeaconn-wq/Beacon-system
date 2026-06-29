---
name: triage
description: Classifica demand_requests pendentes (tipo, complexidade, skill sugerida, pode auto-executar, role recomendado) pra acelerar aprovação do gerente e direcionar demandas ao dev certo.
argument-hint: [--id=UUID] [--status=pending|approved] [--apply]
---

# Triage — Classificador de Demandas

Ao invés do gerente ler cada demanda do zero pra decidir se aprova e pra quem designa, o Claude pré-classifica tudo. O gerente vê a sugestão (cor + role + skill), aprova em segundos ou sobrescreve.

## Output por demanda

- **type**: `pricing | discount | theme-fix | theme-config | new-section | product-import | product-edit | collection | page | image | qa | deploy | integration | other`
- **complexity**: `trivial | medium | complex | unknown`
- **suggestedSkill**: nome de uma das 31 skills existentes (ou `null` se gap)
- **canAutoExecute**: `true` se o Claude pode executar sozinho sem risco (só pricing, clean-titles, dedupe, sort, etc)
- **suggestedRole**: `claude | junior | senior | lead`
  - **claude** = auto-exec seguro
  - **junior** (Pedro em treinamento) = demandas simples com skill clara
  - **senior** (Felipe/você) = theme-fix, bulk-descriptions, investigação
  - **lead** (você) = deploy nova loja, integrações complexas, estratégico
- **confidence**: 0-1 (heurística = 0.7, LLM-powered vai chegar a 0.9 em V2)

## Uso

```bash
# Classifica todas pending (dry-run default)
node .claude/skills/triage/triage.mjs

# Uma específica
node .claude/skills/triage/triage.mjs --id=d0473654-bfac-4f73-94fe-9bbfa271891b

# Inclui approved (pra analisar histórico)
node .claude/skills/triage/triage.mjs --status=approved

# Grava triage_result na tabela (precisa migration primeiro)
node .claude/skills/triage/triage.mjs --apply
```

## Migration necessária pra `--apply`

Adicionar coluna JSONB `triage_result` em `demand_requests`:

```sql
ALTER TABLE demand_requests ADD COLUMN IF NOT EXISTS triage_result JSONB;
CREATE INDEX IF NOT EXISTS idx_demand_requests_triage_type
  ON demand_requests ((triage_result->>'type'));
CREATE INDEX IF NOT EXISTS idx_demand_requests_triage_role
  ON demand_requests ((triage_result->>'suggestedRole'));
```

Salvar em `supabase/migrations/YYYYMMDD_demand_triage.sql`.

## Integração frontend

Depois da migration, o componente `TasksView` / `AgencyNewDemand` pode:
- Ler `triage_result` e renderizar badge colorido antes do título
- Ordenar/filtrar por `suggestedRole`
- Mostrar botão "Aprovar + Atribuir ao [role]" que cria client_task já com assignee

## Roadmap

### V1 (atual) — Heurística keyword-based
- Regras em [rules.mjs](rules.mjs) — fácil de expandir
- Confidence 0.7 (vira 0 em "other")

### V2 — LLM-powered (via gemini-ai edge function)
- Chamar Gemini com contexto do repo (skills, knowledge base) pra classificação semântica
- Confidence ~0.9 + justificativa textual
- Fallback pra V1 quando LLM falha/lento

### V3 — Load balancing por membro do time
- Contar tasks ativas de cada workspace_member no role
- Redirecionar pro menos carregado
- Função `balanceLoad()` já existe em [rules.mjs](rules.mjs)

### V4 — Auto-execução (trigger pós-aprovação)
- Quando gerente aprova demanda com `canAutoExecute=true` + `confidence ≥ 0.8`:
  - Cria client_task
  - Spawna processo Claude Code rodando a skill sugerida com args extraídos da descrição
  - Atualiza status pra "in_progress" → "completed" automaticamente

## Arquivos

- [triage.mjs](triage.mjs) — runner principal
- [rules.mjs](rules.mjs) — classificador heurístico (editável sem tocar runner)

## Regras de expansão

Ao achar uma demanda em produção que caiu em `other`:
1. Identifica o padrão (palavras-chave)
2. Adiciona regra no [rules.mjs](rules.mjs) antes de `other`
3. Roda `node triage.mjs --status=approved` pra reclassificar histórico
4. Valida que acurácia subiu

## Anti-patterns

- **Não marcar demandas vagas como `trivial`** — se confidence < 0.6, deixa em `other` e pede `lead` revisar
- **Não incluir no auto-execute**: deploys, integrações, theme-fix (alto custo de rollback)
- **Não substituir aprovação humana** — triage é sugestão, gerente sempre decide

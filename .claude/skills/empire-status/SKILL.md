---
name: empire-status
description: Raio-X completo da Lever Group em 1 doc auto-gerado. Puxa clientes + GMV + ads health + edge fns + skills + PRs + tabelas Supabase. Output em Lever QI/00-operating-brain/empire-status.md. João Victor (COO) consumidor primário, squad inteiro consulta.
argument-hint: (sem args — roda tudo)
---

# Skill: empire-status

O dashboard executivo da Lever Group em 1 arquivo Markdown auto-atualizável. Pensado pro **João Victor** rodar diariamente (idealmente cron 9h BRT) e o squad inteiro consultar antes de qualquer reunião estratégica.

## Quando usar

- **Início de dia** (João Victor abre + dá olhada)
- **Antes de reunião com sócio** (você + Matheus checam estado)
- **Antes de call cliente Tier 1** (estrategista olha trend + ads health do cliente)
- **Toda segunda 8h** (input pra reunião squad)
- **Em decisão estratégica** (números reais > opinião)

## Uso

```bash
node lever/scripts/lever-mcp/empire-status.mjs
```

~10-15s execução. Reusa `analysis-*.json` se já tem dados do dia (rodou portfolio-analysis), senão usa último disponível. Reusa último `ads-health-*.json` se rodou ads-health-daily.

## O que retorna no doc

1. **Topline** — GMV cross-cliente, MRR fee fixo, AOV, fee/GMV ratio
2. **Clientes** — counts + Top 5 + Bottom 3 + Trend winners/losers
3. **Ads Health** — último report Meta (red/yellow/green + alertas críticos)
4. **Infraestrutura** — tabelas Supabase, edge functions, Vercel summary
5. **Skills** — count + lista
6. **GitHub PRs abertos** — bloqueios potenciais do squad
7. **Conhecimento estratégico** — atalhos pros docs canon do Lever QI
8. **Ações auto-detectadas** — alertas RED, clientes zerados, PRs acumulados

## Dependências (opcional mas recomendado)

Rodar essas skills ANTES pra dados serem do dia, não estimativa:
- `portfolio-analysis` — gera GMV completo cross-cliente
- `ads-health-daily` — gera alertas Meta atuais

Se não rodar antes, empire-status pega o mais recente disponível.

## Output

`Lever QI/00-operating-brain/empire-status.md` — **sobrescreve toda execução** (não acumula histórico). Pra histórico, copiar manual antes ou implementar cron com timestamp futuro.

## Coisas que dá pra ver de cara

- **Cliente fixo zerou 30d**: aparece em "Bottom 3" + flag de ação automática
- **Trend negativo -30%+**: aparece em "Trend losers"
- **PRs acumulando**: aparece em GitHub section se > 5 abertos
- **Cliente novo entrando**: aparece em count "fixos vs avulsos"
- **DW Meta crescendo**: tabela `dw_meta_insights_daily` count sobe

## Quando NÃO usar

- Pra drill-down de 1 cliente → `client-snapshot`
- Pra análise comparativa cross-cliente profunda → `portfolio-analysis` direto + olhar JSON
- Pra verificar SAÚDE de Meta accounts → `ads-health-daily` direto

## Próxima evolução roadmap

- **v1.1**: incluir custos (folha squad + tools) → calcula burn rate + margem real
- **v1.2**: incluir comissão pipeline (5% × spend) → não só fee fixo
- **v2**: cron diário automático + WhatsApp executive summary (3 linhas) pro squad
- **v3**: histórico — versionar empire-status-YYYY-MM-DD.md, gerar trend gráfico semanal

## Conexões

- Script: `lever/scripts/lever-mcp/empire-status.mjs`
- Output: `Lever QI/00-operating-brain/empire-status.md`
- Skills dependentes: `portfolio-analysis`, `ads-health-daily`
- Memory: `reference_lever_real_client_taxonomy` (taxonomia oficial)
- Memory: `reference_lever_squad_realtime_2026_05_19` (squad atual)
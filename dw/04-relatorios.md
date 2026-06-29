---
title: Beacon DW — Relatórios prontos
tags: [dw, reports, scripts]
---

# 📈 Relatórios

> Scripts Node prontos pra rodar. Tudo idempotente — pode rodar à vontade.

**Localização:** `lever/scripts/dw-*.mjs`

---

## ⚡ Comandos rápidos

```powershell
cd "C:\Users\João Vithor\Documents\João Workspace\lever"
$env:SUPABASE_SERVICE_ROLE_KEY = "<key>"  # 1x por session

# Relatório de UMA loja (tudo: top times, categorias, RFM, geo, ticket, canais, etc)
node scripts/dw-report-client.mjs --client="Mantos do PH"

# Relatório CROSS-LOJA Shopify (mix por loja, top times, clientes cross-loja)
node scripts/dw-report-cross.mjs

# Relatório Meta × Shopify (ROAS real vs Meta-reported, top ads, ads queimando dinheiro)
node scripts/dw-report-meta.mjs
```

---

## Scripts de manutenção

```powershell
# Backfill incremental de 1 loja (use só se precisar — daily sync já faz)
node scripts/dw-backfill-shopify.mjs --client="Mantos do PH" --months=24

# Backfill em batch (12 lojas)
node scripts/dw-backfill-batch.mjs

# Sync Meta manual (já roda diário automático)
node scripts/dw-sync-meta.mjs --days=60

# Renomear contas Meta (já rodado 1x)
node scripts/dw-meta-rename.mjs

# Auditoria de mapeamento cliente × Meta
node scripts/dw-meta-audit.mjs
```

---

## O que cada relatório responde

### `dw-report-client.mjs`
Relatório vertical de uma loja específica:
- Resumo (pedidos pagos, receita, ticket médio)
- Top 15 times por receita
- Categorias — share da receita
- Personalização — vale o upsell?
- Patches — % das camisas
- Faixas de ticket (histograma)
- Top 10 UFs
- Top 10 clientes (RFM)
- Recorrência (% recompra)
- Canal de origem

**Quando usar:** preparar reunião de cliente, brief mensal.

---

### `dw-report-cross.mjs`
Relatório horizontal — todas as lojas comparadas:
- Resumo por loja (ticket médio, top time)
- Top times cross-loja (Brasil, Corinthians, Flamengo, etc)
- Deep-dive Corinthians (lojas vendendo + top SKUs)
- Mix de categorias por loja (% receita)
- Clientes cross-loja
- Top 10 UFs combinado
- Personalização + patches benchmark cross-loja

**Quando usar:** semanal — descobrir replicação cross-cliente, padrão de produto.

---

### `dw-report-meta.mjs`
Cruzamento Meta × Shopify:
- ROAS Meta-reported vs ROAS real Shopify por loja
- Top 15 ads por ROAS Meta (30d, gasto >R$50)
- Ads queimando dinheiro (ROAS<0.5, gasto>R$100)
- Totalizadores Beacon 60d

**Quando usar:** semanal — pra mídia decidir o que pausar e replicar.

---

## Quer um relatório novo?

Estrutura — qualquer query SQL custom roda no Supabase Studio. Cole exemplos comuns:

```sql
-- Top 20 produtos vendidos cross-loja
SELECT title, team, category, season,
       SUM(quantity) AS units, SUM(line_total) AS revenue,
       COUNT(DISTINCT client_id) AS stores
FROM dw_order_items
GROUP BY title, team, category, season
ORDER BY revenue DESC
LIMIT 20;

-- Heatmap time × UF
SELECT o.ship_province_code AS uf, i.team,
       COUNT(*) AS pedidos, SUM(i.line_total) AS receita
FROM dw_order_items i
JOIN dw_orders o ON o.id = i.order_id
WHERE o.ship_country_code = 'BR' AND i.team IS NOT NULL
GROUP BY uf, i.team
ORDER BY receita DESC;

-- Clientes mais recentes que gastaram mais de R$500
SELECT first_name, last_name, city, total_orders, total_spent, last_order_at
FROM dw_customers
WHERE total_spent > 500
ORDER BY last_order_at DESC
LIMIT 50;
```

Salvar query útil? Cole em `lever/dw/queries/` (criar pasta quando precisar).

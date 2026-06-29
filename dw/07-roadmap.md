---
title: Beacon DW — Roadmap
tags: [dw, roadmap, futuro]
---

# 🛣️ Roadmap DW Beacon

> O que tá faltando construir, ordenado por impacto.

---

## ✅ Fase 1 (concluída em 2026-05-13)

- Schema Shopify (orders, items enriquecidos, customers, cross-loja identity)
- Enriquecedor automático (time / categoria / temporada / personalização / patches)
- Schema Meta (accounts, campaigns, adsets, ads, insights diários)
- Sync diário automático (edge function + pg_cron)
- 3 relatórios canônicos (cliente, cross-loja, Meta)
- Mapeamento completo Meta × cliente
- Documentação Lever-System vault

---

## 🟡 Fase 2 — Próximas 2-4 semanas

### Quick wins (alto valor, baixo esforço)

1. **Cross-loja replicação automática** — quando um SKU sobe ROAS numa loja, alertar quais outras lojas que vendem mesmo time/categoria devem subir o produto também.

2. **RFM segmentação** — gerar tags `Campeão / Em risco / Novo / Hibernando` em `dw_customers`. Liberta lista pra email marketing/whatsapp targeted.

3. **Top criativo replication report** — pegar peça vencedora (texto + imagem + CTA) de uma loja e propor lookalike pras outras.

4. **Cleanup KRON/Nord do DW** — esses foram sincados por erro de classify. Remover.

5. **3 lojas faltando backfill Shopify** — Diário Stores, O Colecionador, Jhon Atacado (já tem Meta, falta Shopify).

### Operacional

6. **Sync diário com recompute identity** — hoje o sync diário não atualiza `dw_customer_identity`. Adicionar.

7. **Webhook processor** — Shopify webhook events já entram em `webhook_events`. Falta processor que normaliza pra `dw_orders` em real-time (substituiria backfill diário).

8. **Renovar token Meta** — expira **2026-07-12**. Trocar pra **System User token** (não expira).

---

## 🟠 Fase 3 — 1-3 meses

### Camadas de dado novas

1. **Google Ads** (zero conexões hoje) — só Kron tem PMax rodando. Quando clientes começarem a anunciar Google, criar `dw_google_*`.

2. **GA4 / Analytics web** — pageviews por PDP × conversão. Permite identificar "produtos com tráfego mas sem venda" (= problema de copy/foto).

3. **Custo do produto / margem** — depende planilha do João/fornecedor. Permite calcular margem real por SKU, não só receita.

4. **Microsoft Clarity** — heatmaps de PDP por SKU. Cruzar com performance ads.

### Análise avançada

5. **Predictive ops** — modelo simples de previsão de demanda por SKU/loja (Copa do Mundo, BF, finais estaduais).

6. **Persona inferida** — combinar geo + categoria + ticket pra inferir persona-tipo de cada loja sem pesquisa qualitativa.

7. **Cross-store recommendation engine** — "esse cliente comprou X aqui, recomendar Y na outra loja Beacon via email"

---

## 🔵 Fase 4 — Visão de longo prazo

### Bot operacional

1. **Triagem automática Wesley** — bot diário que lê `dw_meta_insights_daily`, identifica ads queimando dinheiro, gera relatório de "pausar essa lista", envia pro Wesley/cliente

2. **Ideias de criativo briefadas** — dado vencedor cross-loja vira input pra IA generativa criar peças. Lever-Estúdio-IA + DW = criativo informado por padrão.

3. **Alertas em tempo real** — Slack/WhatsApp quando: ROAS de campanha cai >30% num dia, novo SKU explode em outra loja, cliente do tier S compra novamente.

4. **Self-service pros clientes Tier S** — Mantos/Coringão/Diario têm dashboard próprio pra ver vendas + ads em 1 lugar.

---

## ❓ Decisões pendentes

- Quando a Beacon vai virar agência só de **inteligência** vs **inteligência + execução**? Pivot operacional formal pra quando?
- Como cobrar pela inteligência? Comissão sobre faturamento (Tier S atual) ou fee fixo de assinatura do DW?
- Quem é o "guardião" do DW? João monitora? Pedro acompanha? Wesley puxa relatório semanal?
- Migrar dev workflow GitHub → Obsidian Sync — quando, como?

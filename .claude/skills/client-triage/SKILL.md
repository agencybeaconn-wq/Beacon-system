---
name: client-triage
description: Triagem cirúrgica de clientes zerados ou com sinais de churn. Classifica em PRE_LAUNCH, NEVER_SOLD, RECENT_SALES_BUT_30D_ZERO, DORMANT. Cruza shop info + products count + last orders + theme info + Supabase project fields pra dar veredito acionável.
argument-hint: (sem args, roda em zerados padrão) | --client <nome|domain> (1 cliente específico) | --list "nome1,nome2,..."
---

# Skill: client-triage

Quando portfolio-analysis aponta "0 pedidos em 30d", essa skill diagnostica POR QUÊ. Classifica em 4 buckets acionáveis.

## Pré-requisitos

- `.env.local` Lever
- Cliente com `shopify_access_token` válido
- Node 18+

## Quando usar

- Depois de `portfolio-analysis` revelar zerados
- Cliente reclama "minha loja não vende" — separar bug técnico de problema de mercado
- Decidir entre "salvar" e "aceitar churn" mensal
- Antes de reunião comercial dura ("vamos relançar ou encerrar?")

## Classificações que a skill produz

- **`PRE_LAUNCH`** — Loja em senha (não pública) ou 0 produtos. Cliente novo em setup. NÃO É CHURN.
- **`NEVER_SOLD`** — Tem produtos, é pública, mas zero pedido histórico. Lançamento que não saiu OU loja teste.
- **`RECENT_SALES_BUT_30D_ZERO`** — Vendeu há < 60 dias mas parou. Pausa recente, problema fresco. Pode ter bug técnico (ver pedidos pending).
- **`DORMANT`** — Último pedido > 60 dias. Cliente parou de vender há tempo. Diagnóstico longo prazo.
- **`UNCLEAR`** — Dados conflitantes. Investigação manual necessária.

## Uso

```bash
# Triagem dos 6 zerados padrão (encontrados na sessão 2026-05-19)
node lever/scripts/lever-mcp/triage-zerados.mjs

# 1 cliente específico (edite o array ZERADOS no script ou wrapper)
node lever/scripts/lever-mcp/triage-zerados.mjs --client "Mega Mantos"

# Lista custom
node lever/scripts/lever-mcp/triage-zerados.mjs --list "Mega Mantos,Puskas,Jhon Atacado"
```

## O que cada caso pede de ação

- **PRE_LAUNCH**: nada. Aguardar publicação. Acompanhar onboarding type (mrr_growth = launch iminente).
- **NEVER_SOLD com tema atualizado recente**: cliente trabalhando, lançamento próximo. Preparar plano captura.
- **NEVER_SOLD com tema parado**: cliente travado. Contato comercial pra entender bloqueio (tráfego, oferta, pricing).
- **RECENT_SALES_BUT_30D_ZERO com pedidos pending**: BUG TÉCNICO. Fix checkout/gateway. ~30min de Pedro/Wesley.
- **RECENT_SALES_BUT_30D_ZERO sem pending**: gargalo súbito. Olhar Meta spend, criativo cansado, sazonalidade.
- **DORMANT longo (>90 dias)**: cliente real parou. Conversa franca — recovery plan vs churn aceito.

## O que a skill puxa por cliente

1. **Shopify shop info**: created_at, currency, country, plan, password_enabled
2. **Products count**: 0 vs 100s
3. **Orders count + last 3 orders**: histórico + frescor + financial_status
4. **Main theme + updated_at**: cliente trabalhando ou loja parada?
5. **Supabase fields**: project_name, onboarding_type, project_deadline

## Sinais críticos a procurar

- **Multiplos pedidos `pending`** = gateway quebrado (Yampi/CartPanda). Fix técnico urgente.
- **`shop_password_enabled: true`** = loja em senha = pre-launch. Não é problema.
- **`products_count = 0`** = nada setup. Cliente esqueceu / atrasou.
- **`onboarding_type = mrr_growth`** = cliente em sprint de crescimento, lançamento próximo.
- **`shop.created_at` < 30 dias** = loja nova, gracinha pra cobrar venda.

## Output

```
▌ Mega Mantos (loja-mega-manto.myshopify.com)
  Classificação:        DORMANT
  Razão:                189 dias loja, 86 dias Lever, 0 pedidos 30d, tema atualizado 14/05
  Veredito:             CHURN-RISK ALTO — contato comercial urgente
  ...
```

Plus JSON salvo pra acompanhamento longitudinal.

## Conexões

- `portfolio-analysis` — input (lista de zerados)
- `client-snapshot` — drill-down após triagem
- `Lever QI/00-operating-brain/setor-marketing/04-triage-zerados-2026-05-19.md` — exemplo de aplicação
- Memory: `reference_lever_real_client_taxonomy` — taxonomia fixo/avulso
# Inventário de clientes Lever — 2026-05-13

Snapshot inicial do `agency_clients` (62 lojas). Atualiza via robôzinho depois.

## Colunas-chave já existentes (boa notícia — não preciso refazer)

- `fee_fixed` — fee fixo mensal
- `commission_rate` — % de comissão
- `calculation_base` — base de cálculo (faturamento? lucro?) — só Furia, Coringão e algum outro têm preenchido
- `shopify_domain` + `shopify_access_token` + `shopify_status` — credencial completa
- `cartpanda_*` — credenciais CartPanda
- `selected_ad_accounts` — Meta accounts vinculadas
- `google_ads_customer_ids` — Google Ads
- `clarity_*` — Clarity já integrado (✨ não sabia!)
- `product_unit_cost`, `gateway_fee_*`, `tax_percent` — campos de margem (só relevantes pra Kron)

## Tier S (comissão prioritária)

| Cliente | Shopify | Ads | Obs |
|---|---|---|---|
| **Mantos do PH** | ✓ | ✓ | Brasileiríssimo, Copa-crítico |
| **Coringão Shop** | ✓ | ✓ | Tem `calculation_base` preenchido |
| **Diario Stores** | ✓ | ✓ | |
| **MontRoyal** | ✓ | ✓ | **Já tá na carteira!** Relógios |

## Próprios (tier OWN)

| Cliente | Shopify | Ads |
|---|---|---|
| Kron Watches | ✓ | ✓ |
| Nord | ✓ | ✓ |

*(Respeita Esportes ainda não cadastrado em agency_clients — confirmar com João)*

## Tier A (resto da carteira — 56 lojas)

Sportswear BR predominante. Lista completa salva no Supabase, pode listar via:

```bash
node -e "fetch('https://pxhmzpwvxvlwngjbjkrg.supabase.co/rest/v1/agency_clients?select=name,shopify_domain&is_archived=eq.false',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}}).then(r=>r.json()).then(d=>console.table(d))"
```

## Achados extra

1. **Clarity já integrado** no Lever System (`clarity_project_id`, `clarity_api_token`) — significa que João já resolveu metade do problema "Clarity em todas as lojas". Posso puxar Clarity API direto pro DW no V3 sem trabalho de instalação.
2. **62 clientes ativos** — DW vai ter volume sério (estimativa ~50k pedidos/mês cross-carteira).
3. **Coringão tem `calculation_base`** preenchido = regra de comissão custom. Quando rodar D2, importar isso direto pra `dim_store.commission_rule`.

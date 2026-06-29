---
name: fix-theme-license
description: Diagnostica e corrige problemas de licença do tema Lever em uma loja Shopify — detecta divergência entre o que o HTML serve, o que o settings_data.json tem, e o que o Supabase externo tem. Corrige automaticamente fazendo UPDATE no Supabase pra casar com o HTML servido (workaround pro Shopify compiled cache). Opcionalmente tenta themePublish + verificação.
---

# fix-theme-license

Diagnostica e corrige o erro "Licença inválida, expirada ou domínio não autorizado" que aparece na storefront de uma loja com tema Lever quando tema e Supabase estão divergentes.

## Quando usar

- Storefront mostra overlay "Licença inválida" mas editor de tema está normal
- Depois de deploy de loja nova via `store-deployment` edge function
- Depois de trocar licença manualmente via Customize UI
- Periodicamente em lojas ativas pra garantir que a licença casa

## O que faz

1. Lê o HTML público da storefront da loja (`shop.myshopify.com` → redirect pro domínio primary)
2. Extrai o `licenseKey` e `currentShop` que o Liquid renderizou no snippet `lever-protection.liquid`
3. Lê o `lever_license_key` do `settings_data.json` via Admin API
4. Lê o registro na tabela `licenses` do Supabase externo (`ykctllrqygchllhxnkjh`)
5. Compara as 3 fontes e reporta divergências
6. Se divergente, aplica correção segura no Supabase (UPDATE do `license_key` pra casar com o HTML servido)

## Bug conhecido do Shopify (motivo dessa skill existir)

Shopify tem um **compiled cache do snippet Liquid** que NÃO invalida via:
- REST PUT `/admin/api/.../assets.json`
- GraphQL `themeFilesUpsert`
- `themePublish` mutation

Apenas **Customize UI save** invalida esse cache. Ou seja, se a licença no `settings_data.json` for alterada via API, o HTML servido continua com o valor ANTIGO até alguém salvar pela UI.

**Workaround**: em vez de mudar o tema, essa skill muda o Supabase pra casar com o HTML cached. Zero risco pra storefront, funciona imediatamente.

## Uso

```bash
# Diagnóstico (DRY-RUN, não muda nada)
node .claude/skills/fix-theme-license/fix-theme-license.mjs "JGS Sports"

# Aplicar fix automaticamente (UPDATE no Supabase)
node .claude/skills/fix-theme-license/fix-theme-license.mjs "JGS Sports" --apply

# Opção avançada: tentar forçar rebuild via themePublish primeiro (pode alterar a storefront)
node .claude/skills/fix-theme-license/fix-theme-license.mjs "JGS Sports" --try-republish --apply
```

## Flags

- `--apply` — aplica o fix (sem isso é DRY-RUN)
- `--try-republish` — antes de mudar Supabase, tenta `themePublish` e verifica se o cache invalidou (raramente funciona)

## Saída

Relatório estruturado:
- `html.licenseKey` — o que o snippet renderiza em produção
- `html.currentShop` — o domain que o Liquid usa (deve ser `shop.permanent_domain`)
- `theme.licenseKey` — valor em `config/settings_data.json`
- `supabase.licenseKey` + `supabase.shopUrl` — registro na tabela `licenses`
- `verdict` — um de:
  - `OK` — tudo casa, nada a fazer
  - `THEME_DRIFT_SAFE` — theme diverge mas HTML casa com Supabase (storefront OK, Customize save resolve quando quiser)
  - `SUPABASE_MISMATCH` — HTML não casa com Supabase, overlay aparece (fix via UPDATE)
  - `FIXED_BY_REPUBLISH` — `--try-republish` invalidou o cache e fez as fontes baterem
  - `FIXED_VIA_SUPABASE` — UPDATE aplicado com sucesso
  - `FIX_FAILED` — tentou mas não conseguiu persistir
- `action` — SQL UPDATE ou texto descrevendo o que foi feito

## Reusa

- `.claude/lib/supabase-rest.mjs` — `supaRest` pra query agency_clients
- `.claude/lib/shopify-api.mjs` — `shReq`, `API_VERSION`
- Supabase externo `ykctllrqygchllhxnkjh` com `LEVER_SITE_SERVICE_ROLE_KEY` (env) pra UPDATE

## Requer env var

`LEVER_SITE_SERVICE_ROLE_KEY` no `.env.local` — a skill falha se não tiver, e orienta o user pegar em https://supabase.com/dashboard/project/ykctllrqygchllhxnkjh/settings/api

Se não tiver, skill imprime o SQL pro user rodar manual:
```sql
UPDATE licenses SET license_key = 'X' WHERE shop_url = 'Y';
```

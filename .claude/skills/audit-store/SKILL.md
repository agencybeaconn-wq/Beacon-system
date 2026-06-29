---
name: audit-store
description: Auditoria completa de saude de uma loja Shopify — precos, colecoes, paginas, tema, SEO, estoque.
argument-hint: [nome do cliente]
---

# Auditoria de Loja Shopify

Read-only. Gera PASS/FAIL/WARN por check. Script roda em background, salva resultado em JSON, formata relatório.

## Passos

1. **Identificar cliente** — `supaRest GET /rest/v1/agency_clients?name=ilike.*${nome}*&shopify_status=eq.connected&select=id,name,shopify_domain,shopify_access_token`. >1 resultado → perguntar; 0 → avisar
2. **Buscar referência** — `client_pricing` por `client_id`. Template pra comparar handles: BR=`5e836736-7411-42d8-b99e-bcad1e55919d`, EN=`17089519-4779-41bb-96ca-9791e0677cf8` (decidir por domínio: contém `-en` ou `en.` → EN)
3. **Salvar script** em `tmp-audit.mjs` com env vars (`CLIENT_ID`, `SHOP_DOMAIN`, `SHOP_TOKEN`, `ANON_KEY`, `TEMPLATE_ID`), rodar `node tmp-audit.mjs` em background
4. **Ler** `tmp-audit-result.json`, formatar relatório, deletar temps

## Helpers (importar das libs — NÃO duplicar)
- `shopify-api.mjs` — `shReq`, `shopifyGraphQL`, `paginate`, `getCreds`, `delay`
- `supabase-rest.mjs` — `supaRest`
- Categorização local **simplificada** (4 categorias):
```js
function categorize(title) {
  const t = title.toLowerCase();
  if (/retr[oô]|retro/i.test(t)) return 'retro';
  if (/jogador|authentic|player/i.test(t)) return 'jogador';
  if (/infantil|kids|beb[eê]|baby/i.test(t)) return 'infantil';
  return 'torcedor';
}
```

## Fetch paralelo (início do script)
```js
const [products, customCols, smartCols, pricingRows, templateProds, menusRes, pagesRes, themesRes] = await Promise.all([
  shopifyListAll('products', { fields: 'id,title,handle,variants,options,body_html,metafields_global_title_tag,metafields_global_description_tag' }),
  shopifyListAll('custom_collections'),
  shopifyListAll('smart_collections'),
  supaRest('GET', `/rest/v1/client_pricing?client_id=eq.${CLIENT_ID}&select=*`),
  proxy({ clientId: TEMPLATE_ID, resource: 'products', method: 'list_all' }),
  gql('{ menus(first: 20) { edges { node { id title handle items { title url type items { title url type } } } } } }'),
  gql('{ pages(first: 50) { edges { node { id title handle body isPublished } } } }'),
  shopifyReq('GET', '/themes.json')
]);
const allCollections = [...customCols, ...smartCols];
const mainTheme = themesRes.d.themes.find(t => t.role === 'main');
// Depois ler 4 assets do tema em paralelo:
//   sections/header-group.json, sections/footer-group.json, templates/cart.json, config/settings_data.json
```

## Os 11 checks

`addCheck(name, status, details, suggestions)` — status: `PASS | FAIL | WARN`.

### 1. Preços
- Cada produto: `categorize(title)` → buscar `pricingMap[cat]`
- Cada variante: `|price - expected| > 0.01` → erro
- `client_pricing` vazio: **WARN**, sugerir cadastrar pricing
- Status: `PASS` se 0 erros; `FAIL` senão. Sugerir `/update-prices`
- Detalhe: distribuição por categoria + erros por categoria + 5 exemplos

### 2. Compare At Price
- Conta variantes sem `compare_at_price`
- Status: `PASS` se 0; `WARN` se <10% do total; `FAIL` se ≥10%. 3 exemplos

### 3. Produtos Faltantes (vs template)
- `templateHandles - clientHandles` = faltantes
- Status: `PASS` se 0; `WARN` se ≤5; `FAIL` se >5. Listar até 15 handles. Sugerir `/deploy-store` ou `/import-missing`

### 4. Coleções
- Conta com `products_count === 0` (vazias)
- Status: `PASS` se 0 vazias; senão `WARN`
- Detalhe: total + custom/smart + até 5 vazias por nome

### 5. Menus
- Verifica `main-menu` e `footer` existem e têm `items.length > 0`
- Status: `PASS` se ambos com itens; `FAIL` se faltando ou vazio

### 6. Páginas
- Esperadas: `sobre, contato, faq, politica-de-privacidade, termos-de-servico, politica-de-troca`
- Detectar `body` com `{{...}}` literal (placeholders não substituídos)
- Status: `PASS` se nenhuma faltando + sem placeholders; `FAIL` se faltam >2; senão `WARN`

### 7. Configuração do Tema
Issues a checar:
- `headerSettings.support_phone` E `support_email` ambos ausentes
- `footerBlocks` sem subtext de horário (procurar `'hor'` no heading ou `'seg'` no subtext)
- `headerSections['announcement-bar'].blocks` vazio
- `settingsData.current.milestone_1_quantity` (BR) OU `cartConfig.sections['cart-items'].settings.milestone_1_quantity` (EN) ausente
- `cartConfig.sections['cart-footer'].blocks` sem `shipping_calculator` (`type` ou `option_1_title`)
- Status: `PASS` se 0 issues; `WARN` se ≤2; `FAIL` se >2

### 8. SEO (Meta Tags)
- Conta `metafields_global_title_tag` e `metafields_global_description_tag` vazios/ausentes
- Status: `PASS` se 0; `FAIL` se >50% do total sem; senão `WARN`. Sugerir `/bulk-product-meta`

### 9. Inventory Policy
- Conta variantes com `inventory_policy !== 'continue'`
- Status: `PASS` se 0; `FAIL` senão. Sugerir corrigir todas pra `continue`

### 10. Nomes das Opções
- `Option1` deve ser **"Tamanho"** (BR) ou **"Size"** (EN) — case-insensitive
- `Option2` deve ser **"Personalizar"** (BR) ou **"Customize"** (EN)
- Status: `PASS` se todas corretas; `FAIL` senão. Sugerir GraphQL `productOptionUpdate` (skill `/fix-options`)

### 11. Escassez (PP/5GG)
- Pra cada **camisa** (`/camisa|jersey|shirt/i.test(title)` E **NÃO** `/infantil|kids|short|conjunto/i.test(title)`):
  - Variante PP existe? `inventory_policy === 'deny'`?
  - Variante 5GG existe? `inventory_policy === 'deny'`?
- Cada faltante/policy errada = 1 problema
- Status: `PASS` se 0; `WARN` se ≤5; `FAIL` se >5

**TODO:** Check 12 (menu integrity — handles dos menus apontam pra coleções existentes), Check 13 (broken links — menus → coleções/páginas inexistentes).

## Summary + Output
```js
report.summary = { total: pass+fail+warn, pass, fail, warn };
report.productCount = products.length;
report.collectionCount = allCollections.length;
report.pageCount = pages.length;
fs.writeFileSync('tmp-audit-result.json', JSON.stringify(report, null, 2));
console.log('AUDIT_DONE');
```

## Formato do relatório
```
## Auditoria — [Nome do Cliente]
Loja: [domínio] | Produtos: X | Coleções: Y | Páginas: Z

| # | Verificação | Status | Detalhes |
|---|-------------|--------|----------|
| 1 | Preços | PASS/FAIL/WARN | ... |
| ...                                  |

### Resumo: X PASS | Y FAIL | Z WARN

### Ações sugeridas:
1. [sugestões dos checks que falharam]
```

## Notas técnicas
- API: `2026-01`
- Supabase: `pxhmzpwvxvlwngjbjkrg.supabase.co` · anon key em `.env` (`VITE_SUPABASE_ANON_KEY`)
- Credenciais Shopify: `agency_clients.shopify_domain` + `shopify_access_token`
- Templates: BR `5e836736-7411-42d8-b99e-bcad1e55919d` · EN `17089519-4779-41bb-96ca-9791e0677cf8`
- Background-safe (.mjs, não pesa contexto)
- **Read-only** — só GET/list
- Deletar `tmp-audit.mjs` + `tmp-audit-result.json` ao final

Processe $ARGUMENTS conforme acima.

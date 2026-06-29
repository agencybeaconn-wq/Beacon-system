---
name: deploy-store
description: Implementa uma loja Shopify completa com um comando — coleções, menus, páginas e tema com conteúdo real. Produtos via REST paralelo direto na Shopify API.
argument-hint: "nome do cliente"
---

# Deploy Loja Shopify — One Command

Copia template completo (coleções, páginas, menus, tema) pra cliente. Produtos via skill `bulk-deploy-products`.

## Helpers

`proxy()` (edge function `shopify-admin-proxy`) e `deployStep()` (edge function `store-deployment`) — padrão idêntico ao mostrado em `/shopify` SKILL. `gql(shop, token, query)` GraphQL direto. `delay = ms => new Promise(r => setTimeout(r, ms))`.

## Pré-flight (antes de qualquer deploy)

Verificar saúde do template fonte:
```bash
node .claude/skills/quality-gate/quality-gate.mjs "Loja de Desenvolvimento - BR"
```
Se template tiver FAIL em duplicatas/variantes esgotadas/coleções vazias, **corrigir template PRIMEIRO** — propaga pra todos deploys futuros.

## Processo (10 passos)

### 1. Identificar cliente
```sql
SELECT id, name, shopify_domain, shopify_status FROM agency_clients
WHERE name ILIKE '%NOME%' AND shopify_status = 'connected';
```
Não conectado → parar.

### 2. Escolher template
- **BR** (default): `5e836736-7411-42d8-b99e-bcad1e55919d` (testeloja-9899.myshopify.com)
- **EN**: `17089519-4779-41bb-96ca-9791e0677cf8`

### 3. Coletar dados do cliente

Briefing:
```sql
SELECT id, answers FROM briefings WHERE client_id = 'UUID' ORDER BY created_at DESC LIMIT 1;
```

Sem briefing? perguntar:
- **marca_nome** (obrigatório)
- **contato_email** (obrigatório)
- contato_telefone, contato_instagram
- politica_troca_dias (default 7)
- politica_entrega_prazo (default "7 a 20 dias úteis")
- frete_gratis_valor (default "R$ 199,90")

Pricing:
```sql
SELECT section, key, value FROM client_pricing WHERE client_id = 'UUID';
```

### 4. Extrair template (deduplicado por handle)
```js
const custom = await proxy({clientId: TEMPLATE, resource: "custom_collections", method: "list_all"});
const smart  = await proxy({clientId: TEMPLATE, resource: "smart_collections",  method: "list_all"});

const seen = new Set();
const allCols = [...(custom.data||[]).map(c=>({...c,_type:'custom'})), ...(smart.data||[]).map(c=>({...c,_type:'smart'}))]
  .filter(c => { if (seen.has(c.handle)) return false; seen.add(c.handle); return true; });

const pages = await proxy({clientId: TEMPLATE, resource: "graphql", method: "graphql",
  payload: { query: "{ pages(first: 50) { edges { node { title handle body isPublished } } } }" }});

const menus = await proxy({clientId: TEMPLATE, resource: "graphql", method: "graphql",
  payload: { query: "{ menus(first: 20) { edges { node { title handle items { title url type items { title url type } } } } } }" }});
```

### 5. Deploy coleções (batches 20, dedup automático)

Edge function já verifica duplicatas — seguro rodar múltiplas vezes.

```js
for (let i = 0; i < allCols.length; i += 20) {
  const batch = allCols.slice(i, i + 20).map(c => ({
    _type: c._type, title: c.title, handle: c.handle, body_html: c.body_html,
    rules: c.rules, disjunctive: c.disjunctive,
    image: c.image?.src ? { src: c.image.src, alt: c.image.alt } : null,
    sort_order: c.sort_order
  }));
  await deployStep({ action: "deploy_step", targetClientId: TARGET, step: "collections", data: { collections: batch }});
}
```

**🔴 CRÍTICO — coleções nascem NÃO PUBLICADAS.** SEMPRE rodar publish após deploy:
```js
const [custom, smart] = await Promise.all([
  proxy({clientId: TARGET, resource: "custom_collections", method: "list_all"}),
  proxy({clientId: TARGET, resource: "smart_collections",  method: "list_all"})
]);
for (const c of [...custom.data, ...smart.data].filter(c => !c.published_at)) {
  const type = c.rules ? "smart_collections" : "custom_collections";
  const key  = c.rules ? "smart_collection"  : "custom_collection";
  await proxy({clientId: TARGET, resource: type, method: "update", resourceId: c.id,
    payload: { [key]: { published: true, published_scope: "global" } }});
}
```

### 6. Deploy páginas com conteúdo REAL (substituir placeholders)

NUNCA enviar `{{...}}` literal:
```js
const replacements = {
  '{{marca_nome}}': clientData.marca_nome,
  '{{contato_email}}': clientData.contato_email,
  '{{contato_telefone}}': clientData.contato_telefone || '(00) 00000-0000',
  '{{contato_instagram}}': clientData.contato_instagram || '@loja',
  '{{politica_troca_dias}}': clientData.politica_troca_dias || '7',
  '{{politica_entrega_prazo}}': clientData.politica_entrega_prazo || '7 a 20 dias úteis',
  '{{frete_gratis_valor}}': clientData.frete_gratis_valor || 'R$ 199,90',
  '{{politica_primeira_troca}}': 'A primeira troca é gratuita.',
  '{{politica_reembolso}}': 'Sim, oferecemos reembolso integral em até 7 dias.',
};
const replaceAll = html => Object.entries(replacements).reduce((s,[k,v]) => s.split(k).join(v), html);

for (const page of pageList.filter(p => p.body)) {
  await proxy({clientId: TARGET, resource: "graphql", method: "graphql",
    payload: { query: `mutation pageCreate($page: PageCreateInput!) { pageCreate(page: $page) { page { id } userErrors { message } } }`,
      variables: { page: { title: page.title, handle: page.handle, body: replaceAll(page.body), isPublished: true } }}});
  await delay(300);
}
```

### 7. Deploy menus (GraphQL — usar `menuUpdate` em existentes)

🔴 **Lojas Shopify novas já têm menus padrão.** `menuCreate` cria com sufixo `-1` (ex: `main-menu-1`) e tema continua apontando pro original vazio. **SEMPRE buscar existentes e usar `menuUpdate`.**

Cada item PRECISA `type` (FRONTPAGE/HTTP/COLLECTION/PAGE/SHOP_POLICY/SEARCH).

```js
// 1. Buscar menus do template (fonte) e do destino — gql() direto, NÃO via proxy
const srcMenus = (await gql(SRC_SHOP, SRC_TOKEN, '{ menus(first: 10) { edges { node { title handle items { title url type items { title url type } } } } } }')).data?.menus?.edges?.map(e => e.node) || [];
const dstMenus = (await gql(DST_SHOP, DST_TOKEN, '{ menus(first: 10) { edges { node { id title handle } } } }')).data?.menus?.edges?.map(e => e.node) || [];

// 2. Mapear template → destino (template pode ter sufixo -1)
const menuMapping = {
  'main-menu-1': 'main-menu',           'main-menu': 'main-menu',
  'footer-1': 'footer',                  'footer': 'footer',
  'customer-account-main-menu-1': 'customer-account-main-menu',
  'customer-account-main-menu': 'customer-account-main-menu',
};

function buildItemsGql(items) {
  return (items || []).map(item => {
    let s = '{ title: ' + JSON.stringify(item.title) + ', url: ' + JSON.stringify(item.url) + ', type: ' + (item.type || 'HTTP');
    if (item.items?.length) s += ', items: [' + buildItemsGql(item.items).join(', ') + ']';
    return s + ' }';
  });
}

for (const srcMenu of srcMenus) {
  const targetHandle = menuMapping[srcMenu.handle] || srcMenu.handle;
  const existing = dstMenus.find(m => m.handle === targetHandle);
  const items = buildItemsGql(srcMenu.items).join(', ');
  const mutation = existing
    ? `mutation { menuUpdate(id: "${existing.id}", title: ${JSON.stringify(srcMenu.title)}, items: [${items}]) { menu { id } userErrors { message } } }`
    : `mutation { menuCreate(title: ${JSON.stringify(srcMenu.title)}, handle: ${JSON.stringify(targetHandle)}, items: [${items}]) { menu { id } userErrors { message } } }`;
  await gql(DST_SHOP, DST_TOKEN, mutation);
}
```

**Menus padrão:**
- **main-menu**: Home, Lançamentos, Brasileirão (times A-Z), Ligas europeias (times), Seleções, Inverno, Retrô
- **footer**: Sobre Nós, FAQ, Trocas, Envios, Compra Segura, Rastreio

### 8. Deploy tema (API direta — proxy `get_asset` NÃO retorna conteúdo)

```js
// Identificar temas: src=role:main, dst=tema com "lever" no nome OU role:main
const srcThemes = await shopReq(SRC_SHOP, SRC_TOKEN, 'GET', '/admin/api/2024-01/themes.json');
const srcTheme = srcThemes.themes.find(t => t.role === 'main');
const dstThemes = await shopReq(DST_SHOP, DST_TOKEN, 'GET', '/admin/api/2024-01/themes.json');
const dstTheme = dstThemes.themes.find(t => t.name.toLowerCase().includes('lever')) || dstThemes.themes.find(t => t.role === 'main');

const filesToCopy = [
  'config/settings_data.json',
  'sections/header-group.json', 'sections/footer-group.json',
  'templates/index.json', 'templates/collection.json', 'templates/product.json',
  'templates/cart.json', 'templates/page.json', 'templates/page.contact.json',
  'templates/search.json', 'templates/blog.json', 'templates/article.json',
  'templates/404.json', 'templates/list-collections.json', 'templates/password.json',
  'templates/collection.feminino.json', 'templates/collection.masculino.json',
  'templates/collection.infantil.json', 'templates/collection.retro.json',
  'templates/customers/account.json', 'templates/customers/login.json',
  'templates/customers/register.json', 'templates/customers/order.json',
  'templates/customers/addresses.json', 'templates/customers/activate_account.json',
  'templates/customers/reset_password.json',
];

for (const file of filesToCopy) {
  const src = await shopReq(SRC_SHOP, SRC_TOKEN, 'GET',
    `/admin/api/2024-01/themes/${srcTheme.id}/assets.json?asset[key]=${encodeURIComponent(file)}`);
  if (!src.asset?.value) continue;
  await shopReq(DST_SHOP, DST_TOKEN, 'PUT',
    `/admin/api/2024-01/themes/${dstTheme.id}/assets.json`,
    { asset: { key: file, value: src.asset.value } });
  await delay(500);
}
```

🔴 **Corrigir handles do template nos arquivos copiados** — podem conter sufixo `-1`:
```js
const handleReplacements = [
  ['main-menu-1', 'main-menu'],
  ['footer-1', 'footer'],
  ['customer-account-main-menu-1', 'customer-account-main-menu'],
];
const filesToFix = ['sections/header-group.json', 'sections/footer-group.json', 'config/settings_data.json'];
for (const file of filesToFix) {
  const asset = await shopReq(DST_SHOP, DST_TOKEN, 'GET', `/admin/api/2024-01/themes/${dstTheme.id}/assets.json?asset[key]=${encodeURIComponent(file)}`);
  if (!asset.asset?.value) continue;
  let val = asset.asset.value, changed = false;
  for (const [from, to] of handleReplacements) if (val.includes(from)) { val = val.split(from).join(to); changed = true; }
  if (changed) await shopReq(DST_SHOP, DST_TOKEN, 'PUT', `/admin/api/2024-01/themes/${dstTheme.id}/assets.json`, { asset: { key: file, value: val } });
}
```

### 9. Deploy produtos — usar skill `bulk-deploy-products`

```bash
node .claude/skills/bulk-deploy-products/bulk-deploy-products.mjs "Cliente" --apply
```

Skill faz: dedup por handle, `inventory_policy=CONTINUE`, `tracked=false`, imagens via URL (Shopify baixa server-side). 1.400 produtos em ~5 min vs 2+ horas com REST sequencial.

**Fallback REST** (se bulk não funcionar): paginar destino pra dedup por handle, paginar template pra fontes, criar só os faltantes com `delay(700)`. Re-rodar é seguro (dedup garante). Aplicar pricing por categoria via `categorize(title)` se tabela existir.

### 9b. Dedupe pós-import (OBRIGATÓRIO)
```bash
node .claude/skills/dedupe-products/dedupe-products.mjs "Cliente" --by=title --apply
```
Memory `feedback_import_duplicates` + `project_template_br_duplicates` — toda importação pode criar duplicados.

### 9c. Republish ACTIVE sem publishedAt (OBRIGATÓRIO)
```bash
node .claude/skills/deploy-complete/republish-unpublished.mjs "Cliente" --apply
```
Memory `feedback_active_vs_published` — produtos ACTIVE mas sem publicação no Online Store sales channel = storefront mostra placeholder.

### 10. Quality gate (OBRIGATÓRIO)
```bash
node .claude/skills/quality-gate/quality-gate.mjs "Cliente"
```
Critérios de aceitação (todos PASS ou WARN aceitável):
- ✅ Produtos sem imagem: 0
- ✅ Variantes esgotadas: 0 (`inventory_policy=continue` em todas)
- ✅ Coleções obrigatórias: 0 faltando
- ✅ Menus sem links quebrados: 0
- ✅ Preço zero: 0
- ⚠️ Pricing: WARN se tabela não configurada (preencher depois)
- ⚠️ SEO: WARN aceitável (preencher depois)

## Páginas padrão
| Página | Handle | Conteúdo |
|---|---|---|
| Sobre Nós | sobre-nos | Marca + contato |
| Perguntas Frequentes | perguntas-frequentes | 7 perguntas |
| Trocas e Devoluções | trocas-e-devolucoes | Prazo, condições, reembolso |
| Envios e Prazos | envios-e-prazos | Prazo, frete grátis, rastreio |
| Compra Segura | compra-segura | SSL, pagamentos, garantia |
| Rastreio | rastreio | Widget rastreamento |

## Erros comuns
| Erro | Solução |
|---|---|
| full_deploy retorna 500 | step-by-step (extract + deploy_step) |
| Menus criados mas vazios | falta `type` nos items |
| Páginas sem conteúdo | GraphQL com `body` (NÃO REST `body_html`) |
| Coleções duplicadas | dedup por handle antes de criar (edge function já faz) |
| Timeout em coleções | batches 20 |
| UTF-8 quebrado (ç, ã) | Node.js `https`, NÃO `curl` |
| Edge function timeout (150s) | 500+ produtos via REST direto na Shopify (sem proxy) |
| GraphQL Bulk Ops sem variantes | NÃO usar `bulkOperationRunMutation` pra produtos — `ProductInput` não aceita variants/options |
| Produtos criados mas 0 na loja | verificar JSONL do bulk op — erros silenciosos |
| Licença 409 conflict | loja já tem licença no banco — verificar antes |
| Menus duplicados (`main-menu-1`) | SEMPRE `menuUpdate` em existentes, NUNCA `menuCreate` pra handles padrão |
| Tema header/footer não atualiza | varia: `sections/header-group.json` ou `config/settings_data.json` |
| Proxy `get_asset` vazio | API Shopify direta com `shopReq(shop, token, 'GET', '/admin/api/2024-01/themes/{id}/assets.json?asset[key]=...')` |
| Tema copiado mas menus não aparecem | arquivos contêm sufixo `-1` — substituir pós-cópia (passo 8) |
| Coleções sem imagens/vazias | sem produtos, smart collections ficam vazias e tema não mostra |
| Produtos duplicados (`handle-1`) | buscar handles destino antes, pular existentes |
| Processo morre (ECONNRESET) | retry + dedup garantem re-run seguro. `timeout: 60000`, `delay(700)` |
| Erros silenciosos | sempre checar `status < 300`. Imagens CDN inacessíveis falham silenciosamente — retry sem imagens como fallback |

## Dados
- Template BR: `5e836736-7411-42d8-b99e-bcad1e55919d` (testeloja-9899.myshopify.com)
- Template EN: `17089519-4779-41bb-96ca-9791e0677cf8`
- Supabase: `pxhmzpwvxvlwngjbjkrg.supabase.co`
- `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Processe $ARGUMENTS conforme acima.

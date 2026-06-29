---
name: sort-collections
description: Ordena produtos dentro de todas as coleções de uma loja Shopify por Ano, Tipo e Número.
argument-hint: [nome do cliente]
---

# Ordenar Coleções Shopify

Ordena os produtos dentro de todas as coleções (smart + custom) de um cliente, usando a regra canônica: **Ano** (desc) → **Tipo** (desc) → **Número** (desc).

## Fluxo Socrático

Siga rigorosamente: **IDENTIFY → ANALYZE → PREVIEW → CONFIRM → EXECUTE → REPORT**

### 1. IDENTIFY — Identificar cliente

Buscar pelo nome passado em `$ARGUMENTS` (fuzzy match):

```sql
SELECT id, name, shopify_domain FROM agency_clients
WHERE name ILIKE '%NOME%' AND shopify_status = 'connected';
```

Se houver ambiguidade, perguntar ao usuário qual cliente.

### 2. ANALYZE — Buscar coleções e produtos

Criar e rodar um script Node.js **em background** que:

1. Busca todas as coleções (smart + custom)
2. Para cada coleção com produtos, busca os produtos e calcula se precisa reordenar
3. Gera um relatório JSON com as coleções que precisam de reordenação

### 3. PREVIEW — Mostrar resumo

Mostrar ao usuário: **"X de Y coleções precisam ser reordenadas"** com lista das coleções afetadas.

### 4. CONFIRM — Pedir confirmação

Perguntar: "Deseja prosseguir com a reordenação?"

### 5. EXECUTE — Aplicar reordenação

Rodar script Node.js em background que aplica a reordenação via GraphQL.

### 6. REPORT — Relatório final

Mostrar: **"Ordenadas X coleções, Y já estavam corretas, Z erros"**

---

## Script Completo

Salvar como arquivo `.mjs` temporário e rodar com `node script.mjs` em background. O script abaixo é o padrão canônico — use-o como base.

**IMPORTANTE:** Ler o `VITE_SUPABASE_ANON_KEY` do arquivo `.env` na raiz do projeto.

```javascript
const https = require('https');
const fs = require('fs');

// --- Config ---
const CLIENT_ID = 'UUID_DO_CLIENTE';
const TOKEN = 'ANON_KEY_DO_ENV';
const HOST = 'pxhmzpwvxvlwngjbjkrg.supabase.co';
const API_VERSION = '2026-01';

// --- Helpers ---
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function proxy(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: HOST,
      path: '/functions/v1/shopify-admin-proxy',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${TOKEN}`,
        'apikey': TOKEN
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch (e) { reject(new Error('Parse error: ' + b.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function supaRest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: HOST,
      path: '/rest/v1/' + path,
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${TOKEN}`,
        'apikey': TOKEN
      }
    };
    const req = https.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch { resolve(b); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- Sort Algorithm (canonical) ---
function getSortKey(title) {
  const t = title.toLowerCase();

  // Year scoring (desc) — CRÍTICO: checar mais específico primeiro
  // Ordem: 2026/27 > 2026 (Copa do Mundo) > 2025/26 > 2024/25 > retrô
  let year = 50; // default
  if (/2026\/27|26\/27/.test(t)) year = 100;              // temporada 26/27
  else if (/\b2026\b(?!\s*\/)/.test(t)) year = 95;        // "2026" sozinho (Copa do Mundo), sem barra
  else if (/2025\/26|25\/26/.test(t)) year = 90;
  else if (/\b2025\b(?!\s*\/)/.test(t)) year = 85;
  else if (/2024\/25|24\/25/.test(t)) year = 80;
  else if (/retr[oô]/.test(t)) year = 10;

  // Type scoring (desc)
  let type = 50; // default (camisa/jersey base)
  if (/jogador|authentic|player/i.test(t)) type = 95;
  else if ((/feminina|woman/i.test(t)) && !(/infantil|kids/i.test(t))) type = 85;
  else if (/infantil|kids/i.test(t)) type = 80;
  else if (/manga longa|longsleeve/i.test(t)) type = 75;
  else if (/regata|tank/i.test(t)) type = 70;
  else if (/conjunto.*treino|training set/i.test(t)) type = 60;
  else if (/treino|training/i.test(t)) type = 55;
  else if (/goleiro|goalkeeper/i.test(t)) type = 45;
  else if (/short/i.test(t)) type = 40;
  else if (/retr[oô]|retro/i.test(t)) type = 30;
  else if (/camisa|jersey/i.test(t)) type = 100;

  // Number scoring (desc)
  let num = 0;
  if (/\bIII\b/.test(title)) num = 1;
  else if (/\bII\b/.test(title)) num = 2;
  else if (/\bI\b/.test(title) && !/II|III/.test(title)) num = 3;

  return year * 10000 + type * 100 + num;
}

// --- Main ---
async function main() {
  console.log('Fetching collections...');

  const [smartRes, customRes] = await Promise.all([
    proxy({ clientId: CLIENT_ID, resource: 'smart_collections', method: 'list_all' }),
    proxy({ clientId: CLIENT_ID, resource: 'custom_collections', method: 'list_all' })
  ]);

  const smartCols = (smartRes.data || []).map(c => ({ ...c, colType: 'smart_collections' }));
  const customCols = (customRes.data || []).map(c => ({ ...c, colType: 'custom_collections' }));
  const allCols = [...smartCols, ...customCols];
  console.log(`Found ${allCols.length} collections (${smartCols.length} smart, ${customCols.length} custom)`);

  let sorted = 0, alreadyCorrect = 0, errors = 0;
  const results = [];

  for (const col of allCols) {
    try {
      await delay(400);

      // Set sort_order to manual if needed
      if (col.sort_order !== 'manual') {
        await proxy({
          clientId: CLIENT_ID,
          resource: col.colType,
          method: 'update',
          resourceId: col.id,
          payload: { [col.colType === 'smart_collections' ? 'smart_collection' : 'custom_collection']: { sort_order: 'manual' } }
        });
        await delay(400);
      }

      // Fetch products in this collection (paginate if needed)
      let products = [];
      let page_info = null;
      do {
        const params = { collection_id: col.id.toString(), limit: '250' };
        if (page_info) params.page_info = page_info;
        const prodsRes = await proxy({
          clientId: CLIENT_ID, resource: 'products', method: 'list', params
        });
        const batch = prodsRes.data?.products || [];
        products = products.concat(batch);
        page_info = prodsRes.page_info || null;
        if (page_info) await delay(400);
      } while (page_info);

      if (products.length === 0) {
        results.push({ title: col.title, status: 'empty' });
        continue;
      }

      // Compute sort keys and check order
      const withKeys = products.map(p => ({ id: p.id, title: p.title, key: getSortKey(p.title) }));
      const sortedProducts = [...withKeys].sort((a, b) => b.key - a.key);

      const isCorrect = withKeys.every((p, i) => p.id === sortedProducts[i].id);
      if (isCorrect) {
        alreadyCorrect++;
        results.push({ title: col.title, status: 'correct', count: products.length });
        continue;
      }

      // Apply reorder via GraphQL
      const moves = sortedProducts.map((p, i) => ({
        id: 'gid://shopify/Product/' + p.id,
        newPosition: i.toString()
      }));

      await delay(400);
      const reorderRes = await proxy({
        clientId: CLIENT_ID, resource: 'graphql', method: 'graphql',
        payload: {
          query: `mutation reorder($id: ID!, $moves: [MoveInput!]!) {
            collectionReorderProducts(id: $id, moves: $moves) {
              job { id }
              userErrors { message }
            }
          }`,
          variables: {
            id: 'gid://shopify/Collection/' + col.id,
            moves
          }
        }
      });

      const ue = reorderRes.data?.data?.collectionReorderProducts?.userErrors || [];
      if (ue.length > 0) {
        errors++;
        results.push({ title: col.title, status: 'error', errors: ue.map(e => e.message), count: products.length });
      } else {
        sorted++;
        results.push({ title: col.title, status: 'sorted', count: products.length });
      }

      console.log(`[${sorted + alreadyCorrect + errors}/${allCols.length}] ${col.title}: ${isCorrect ? 'OK' : 'reordered'} (${products.length} products)`);

    } catch (err) {
      errors++;
      results.push({ title: col.title, status: 'error', errors: [err.message] });
      console.error(`Error on ${col.title}: ${err.message}`);
    }
  }

  // Report
  console.log('\n=== REPORT ===');
  console.log(`Sorted: ${sorted} | Already correct: ${alreadyCorrect} | Errors: ${errors} | Empty: ${results.filter(r => r.status === 'empty').length}`);
  console.log('');
  for (const r of results) {
    if (r.status === 'error') console.log(`  ERROR: ${r.title} — ${r.errors.join(', ')}`);
    else if (r.status === 'sorted') console.log(`  SORTED: ${r.title} (${r.count} products)`);
  }

  fs.writeFileSync('/tmp/sort-collections-report.json', JSON.stringify({ sorted, alreadyCorrect, errors, results }, null, 2));
  console.log('\nFull report saved to /tmp/sort-collections-report.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
```

## Modo de Uso

### Fase de Análise (sem executar)

1. Ler `.env` para pegar `VITE_SUPABASE_ANON_KEY`
2. Buscar o cliente pelo nome em `agency_clients`
3. Salvar o script acima como `.mjs` temporário, **mas com um modo `--dry-run`** que apenas lista as coleções que precisam reordenar (sem aplicar o GraphQL mutation)
4. Rodar em background e aguardar
5. Mostrar o preview ao usuário

### Fase de Execução (após confirmação)

1. Rodar o script completo (sem dry-run) em background
2. Aguardar conclusão
3. Mostrar o relatório final

## Regra de Ouro

- **SEMPRE** mostrar preview antes de executar
- **NUNCA** executar sem confirmação do usuário
- Usar `delay(400)` entre cada chamada de API
- Rodar como script Node.js em background (nunca inline)

## ⚠️ Propagação do `sort_order = manual`

Algumas coleções falham com o erro:
```
"Can't reorder products unless collection is manually sorted"
```

Causa: a Shopify não propagou imediatamente a mudança de `sort_order` antes do `collectionReorderProducts`. Delays curtos (300ms) não bastam para todas.

**Solução — retry automático das falhas:**

```js
// Após o loop principal, re-tentar as que falharam com delay maior:
for (const failed of errors) {
  await shReq(shop, token, 'PUT', `/admin/api/2026-01/smart_collections/${failed.id}.json`, {
    smart_collection: { sort_order: 'manual' },
  });
  await delay(2500); // propagação Shopify
  // fetch products + reorder graphql
}
```

Na run de 229 coleções, ~4 falham assim — retry com 2.5s resolve todas.

## ⚠️ Rate limit com scripts concorrentes

NÃO rode 2+ scripts escrevendo no mesmo shop simultaneamente (ex: sort + clear product_type + price update). Shopify retorna 429 e ~2% das calls falham. Serialize ou espere um terminar.

Processe $ARGUMENTS conforme os passos acima.

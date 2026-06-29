---
name: bulk-fix-prices
description: Audita e corrige precos de produtos na Shopify comparando com a tabela de precos do banco de dados.
argument-hint: [nome do cliente]
---

# Bulk Fix Prices

Audita e corrige precos de produtos na Shopify comparando com a tabela `client_pricing` do banco de dados.

## Fluxo

1. Identificar cliente pelo nome
2. Buscar tabela de precos do banco
3. Buscar todos os produtos da Shopify
4. Categorizar cada produto pelo titulo
5. Calcular preco correto por variante (base + extras)
6. Mostrar preview das discrepancias
7. Apos confirmacao, corrigir precos
8. Reportar resultado

## 1. Identificar cliente

Buscar no banco:
```sql
SELECT id, name, shopify_domain FROM agency_clients
WHERE name ILIKE '%NOME%' AND shopify_status = 'connected';
```

## 2. Buscar tabela de precos

Se nao existir pricing para o cliente, avisar o usuario para usar `/update-prices` primeiro.

## 3. Script de auditoria

Salvar como `.mjs` e rodar com `node script.mjs` em background. O script faz tudo: busca precos do banco, busca produtos da Shopify, categoriza, calcula, compara e gera relatorio.

### Helpers obrigatorios

```javascript
const https = require('https');
const fs = require('fs');

// Ler .env
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const SUPA_HOST = 'pxhmzpwvxvlwngjbjkrg.supabase.co';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function supaRest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPA_HOST,
      path: `/rest/v1/${path}`,
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch { reject(new Error('Parse error: ' + b.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function shopifyReq(shop, token, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: shop,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, d: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, d: b }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
```

### Buscar credenciais do cliente

```javascript
async function getCreds(clientId) {
  const rows = await supaRest(`agency_clients?select=shopify_domain,shopify_access_token&id=eq.${clientId}`);
  if (!rows.length) throw new Error('Cliente nao encontrado');
  return rows[0];
}
```

### Buscar pricing do banco

```javascript
async function fetchPricing(clientId) {
  const rows = await supaRest(`client_pricing?select=section,key,value&client_id=eq.${clientId}`);
  if (!rows.length) {
    console.log('ERRO: Nenhum pricing encontrado para este cliente.');
    console.log('Use /update-prices para cadastrar os precos primeiro.');
    process.exit(1);
  }
  // Montar mapa: { "camisa_torcedor": "199.90", "personalizacao": "30.00", ... }
  const pricing = {};
  for (const r of rows) {
    pricing[r.key] = parseFloat(r.value) || 0;
  }
  return pricing;
}
```

### Categorizar produto pelo titulo

Ordem canonica de prioridade: **patch** > retro > jogador > infantil > ... > torcedor (fallback).

**CRITICO:** Patch DEVE vir primeiro. Titulos "Patch X" ou "Kit Patch Y" NAO sao camisas — tem preco proprio (~R$30).

```javascript
function categorize(title) {
  const t = title.toLowerCase();

  // 1. PATCH (prioridade maxima — NUNCA confundir com camisa)
  if (/^patch|^patches|^kit patch/i.test(title)) return 'patch';

  // 2. Retro
  if (/retr[oô]|retro/.test(t)) return 'camisa_retro';

  // 3. Jogador / Authentic / Player
  if (/jogador|authentic|player/.test(t)) return 'camisa_jogador';

  // 4. Infantil / Kids (exceto "KidSuper" que e marca)
  if (/infantil|kids/i.test(t) && !/kidsup/i.test(t)) return 'conjunto_infantil';

  // 5. Agasalho
  if (/agasalho/.test(t)) return 'agasalho_viagem';

  // 6. Conjunto de treino
  if (/conjunto.*treino|training.*set/.test(t)) return 'conjunto_treino';

  // 7. Jaqueta / Corta-vento
  if (/jaqueta|corta.?vento|windbreaker/.test(t)) return 'jaqueta';

  // 8. Moletom
  if (/moletom|hoodie/.test(t)) return 'moletom';

  // 9. Short
  if (/short/.test(t)) return 'short';

  // 10. Fallback: torcedor
  return 'camisa_torcedor';
}
```

### Calcular preco esperado de uma variante

```javascript
function calcExpectedPrice(title, variant, pricing) {
  const category = categorize(title);
  let base = pricing[category] || 0;
  if (base === 0) {
    return { price: null, category, reason: 'sem preco base' };
  }

  let extras = [];
  const t = title.toLowerCase();

  // Manga longa
  if (/manga longa|longsleeve|long sleeve/.test(t)) {
    const ml = pricing['manga_longa'] || 0;
    if (ml > 0) { base += ml; extras.push(`+${ml} manga_longa`); }
  }

  // Checar opcoes da variante
  const opts = [variant.option1, variant.option2, variant.option3].filter(Boolean);
  const optsLower = opts.map(o => o.toLowerCase());

  // Personalizacao
  for (const o of optsLower) {
    if (/personaliz/.test(o) && !/n[aã]o/.test(o)) {
      const p = pricing['personalizacao'] || 0;
      if (p > 0) { base += p; extras.push(`+${p} personalizacao`); }
      break;
    }
  }

  // Patch
  for (const o of optsLower) {
    if (/patch/.test(o) && !/sem patch|n[aã]o/.test(o)) {
      const p = pricing['patch'] || 0;
      if (p > 0) { base += p; extras.push(`+${p} patch`); }
      break;
    }
  }

  // Tamanhos especiais
  for (const o of optsLower) {
    if (/4gg|4xl|xxxxl/.test(o)) {
      const p = pricing['tamanho_4gg'] || 0;
      if (p > 0) { base += p; extras.push(`+${p} 4gg`); }
      break;
    } else if (/3gg|3xl|xxxl/.test(o) && !/4/.test(o)) {
      const p = pricing['tamanho_3gg'] || 0;
      if (p > 0) { base += p; extras.push(`+${p} 3gg`); }
      break;
    } else if (/2gg|2xl|xxl/.test(o) && !/3|4/.test(o)) {
      const p = pricing['tamanho_2gg'] || 0;
      if (p > 0) { base += p; extras.push(`+${p} 2gg`); }
      break;
    }
  }

  return { price: base.toFixed(2), category, extras };
}
```

### Script completo de AUDITORIA

```javascript
// audit-prices.mjs
// Uso: CLIENT_ID=uuid node audit-prices.mjs

const CLIENT_ID = process.env.CLIENT_ID || '<SUBSTITUIR>';

(async () => {
  console.log('=== AUDITORIA DE PRECOS ===\n');

  // 1. Buscar pricing
  const pricing = await fetchPricing(CLIENT_ID);
  console.log('Pricing carregado:', Object.keys(pricing).length, 'chaves');
  console.log(JSON.stringify(pricing, null, 2), '\n');

  // 2. Buscar credenciais
  const { shopify_domain: shop, shopify_access_token: token } = await getCreds(CLIENT_ID);
  console.log('Loja:', shop, '\n');

  // 3. Buscar todos os produtos (paginando)
  let allProducts = [];
  let url = '/admin/api/2026-01/products.json?limit=250&fields=id,title,handle,variants';
  while (url) {
    const res = await shopifyReq(shop, token, 'GET', url, null);
    allProducts.push(...(res.d.products || []));
    // Paginacao via Link header
    const link = res.headers['link'] || '';
    const next = link.match(/<https:\/\/[^>]*\/admin\/api\/[^>]*(\/admin\/api\/[^>]*)>;\s*rel="next"/);
    url = next ? next[1] : null;
    if (url) await delay(350);
  }
  console.log('Total de produtos:', allProducts.length, '\n');

  // 4. Auditar cada variante
  const issues = [];
  const stats = {};  // { category: { total: 0, wrong: 0 } }

  for (const p of allProducts) {
    for (const v of (p.variants || [])) {
      const expected = calcExpectedPrice(p.title, v, pricing);
      const cat = expected.category;
      if (!stats[cat]) stats[cat] = { total: 0, wrong: 0, ok: 0 };
      stats[cat].total++;

      if (!expected.price) {
        stats[cat].wrong++;
        issues.push({
          product: p.title, handle: p.handle,
          productId: p.id, variantId: v.id,
          current: v.price, expected: '???',
          category: cat, reason: expected.reason,
          options: [v.option1, v.option2, v.option3].filter(Boolean).join(' / ')
        });
        continue;
      }

      if (parseFloat(v.price).toFixed(2) !== expected.price) {
        stats[cat].wrong++;
        issues.push({
          product: p.title, handle: p.handle,
          productId: p.id, variantId: v.id,
          current: v.price, expected: expected.price,
          category: cat, extras: expected.extras,
          options: [v.option1, v.option2, v.option3].filter(Boolean).join(' / ')
        });
      } else {
        stats[cat].ok++;
      }
    }
  }

  // 5. Relatorio
  console.log('=== RESUMO POR CATEGORIA ===');
  for (const [cat, s] of Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct = s.total ? ((s.ok / s.total) * 100).toFixed(0) : 0;
    console.log(`  ${cat}: ${s.total} variantes | ${s.ok} OK (${pct}%) | ${s.wrong} ERRADAS`);
  }

  console.log(`\nTotal de discrepancias: ${issues.length}`);

  if (issues.length > 0) {
    // Salvar detalhes em arquivo
    fs.writeFileSync('price-audit-result.json', JSON.stringify({ stats, issues }, null, 2));
    console.log('Detalhes salvos em price-audit-result.json');

    // Preview das primeiras 20
    console.log('\n=== AMOSTRA (primeiras 20 discrepancias) ===');
    for (const iss of issues.slice(0, 20)) {
      console.log(`  ${iss.product} [${iss.options}]`);
      console.log(`    Categoria: ${iss.category} | Atual: R$${iss.current} | Esperado: R$${iss.expected}`);
      if (iss.extras?.length) console.log(`    Extras: ${iss.extras.join(', ')}`);
    }
  } else {
    console.log('\nTodos os precos estao corretos!');
  }
})();
```

### Script completo de CORRECAO

```javascript
// fix-prices.mjs
// Uso: CLIENT_ID=uuid node fix-prices.mjs
// Opcional: COMPARE_AT_MARKUP=1.3 (multiplicador para preco riscado)

const CLIENT_ID = process.env.CLIENT_ID || '<SUBSTITUIR>';
const COMPARE_AT_MARKUP = parseFloat(process.env.COMPARE_AT_MARKUP || '0'); // 0 = nao mexer

(async () => {
  console.log('=== CORRECAO DE PRECOS ===\n');

  const pricing = await fetchPricing(CLIENT_ID);
  const { shopify_domain: shop, shopify_access_token: token } = await getCreds(CLIENT_ID);
  console.log('Loja:', shop);

  // Buscar todos os produtos
  let allProducts = [];
  let url = '/admin/api/2026-01/products.json?limit=250&fields=id,title,handle,variants';
  while (url) {
    const res = await shopifyReq(shop, token, 'GET', url, null);
    allProducts.push(...(res.d.products || []));
    const link = res.headers['link'] || '';
    const next = link.match(/<https:\/\/[^>]*\/admin\/api\/[^>]*(\/admin\/api\/[^>]*)>;\s*rel="next"/);
    url = next ? next[1] : null;
    if (url) await delay(350);
  }
  console.log('Total de produtos:', allProducts.length, '\n');

  // Calcular correcoes
  let fixed = 0, skipped = 0, errors = 0;

  for (const p of allProducts) {
    const variantUpdates = [];

    for (const v of (p.variants || [])) {
      const expected = calcExpectedPrice(p.title, v, pricing);
      if (!expected.price) { skipped++; continue; }

      const currentPrice = parseFloat(v.price).toFixed(2);
      if (currentPrice === expected.price && !COMPARE_AT_MARKUP) continue;

      const update = { id: v.id, price: expected.price };

      // Compare at price (preco riscado)
      if (COMPARE_AT_MARKUP > 0) {
        update.compare_at_price = (parseFloat(expected.price) * COMPARE_AT_MARKUP).toFixed(2);
      }

      if (currentPrice !== expected.price || COMPARE_AT_MARKUP > 0) {
        variantUpdates.push(update);
      }
    }

    if (variantUpdates.length === 0) continue;

    // Atualizar produto com todas as variantes de uma vez
    try {
      const res = await shopifyReq(shop, token, 'PUT',
        `/admin/api/2026-01/products/${p.id}.json`,
        { product: { id: p.id, variants: variantUpdates } }
      );

      if (res.status === 200) {
        fixed += variantUpdates.length;
        console.log(`OK: ${p.title} — ${variantUpdates.length} variantes corrigidas`);
      } else {
        errors++;
        console.log(`ERRO ${res.status}: ${p.title} — ${JSON.stringify(res.d).slice(0, 200)}`);
      }
    } catch (err) {
      errors++;
      console.log(`ERRO: ${p.title} — ${err.message}`);
    }

    await delay(350);
  }

  console.log('\n=== RESULTADO ===');
  console.log(`  Variantes corrigidas: ${fixed}`);
  console.log(`  Produtos com erro: ${errors}`);
  console.log(`  Variantes ignoradas (sem preco base): ${skipped}`);
  if (COMPARE_AT_MARKUP > 0) {
    console.log(`  Compare-at-price: ${COMPARE_AT_MARKUP}x do preco`);
  }
})();
```

## Chaves da tabela client_pricing

### Precos base (section = "prices")
| key | Descricao |
|-----|-----------|
| camisa_torcedor | Camisa torcedor (fallback) |
| camisa_jogador | Camisa jogador / authentic / player |
| camisa_retro | Camisa retro |
| conjunto_infantil | Conjunto infantil / kids |
| agasalho_viagem | Agasalho de viagem |
| conjunto_treino | Conjunto de treino |
| jaqueta | Jaqueta / corta-vento |
| moletom | Moletom / hoodie |
| short | Short |

### Extras (section = "extras")
| key | Descricao |
|-----|-----------|
| personalizacao | Extra por personalizacao (variante "personalizar" != "Nao") |
| manga_longa | Extra por manga longa (titulo contem "manga longa/longsleeve") |
| patch | Extra por patch (variante "patch" != "sem patch/nao") |
| tamanho_2gg | Extra por tamanho 2GG/XXL |
| tamanho_3gg | Extra por tamanho 3GG/XXXL |
| tamanho_4gg | Extra por tamanho 4GG/XXXXL |

## Instrucoes de execucao

1. Montar o script `.mjs` completo incluindo TODOS os helpers (supaRest, shopifyReq, delay, getCreds, fetchPricing, categorize, calcExpectedPrice)
2. Primeiro rodar AUDITORIA em background: `node audit-prices.mjs`
3. Mostrar ao usuario o resumo por categoria e a amostra de discrepancias
4. Pedir confirmacao antes de corrigir
5. Se confirmado, rodar CORRECAO em background: `node fix-prices.mjs`
6. Se o usuario pedir compare_at_price, usar `COMPARE_AT_MARKUP=1.3` (ou valor pedido)
7. Reportar resultado final

Processe $ARGUMENTS conforme os passos acima.

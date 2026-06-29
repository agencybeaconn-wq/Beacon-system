---
name: fix-handles
description: Corrige handles de coleções em lojas internacionais (EN) que foram gerados em português.
argument-hint: [nome do cliente]
---

# Fix Handles — Corrigir Handles de Coleções EN

Corrige handles de coleções em lojas internacionais (EN) que foram auto-gerados em português. Detecta handles com palavras em português, acentos, ou que não correspondem ao título em inglês, e gera handles corretos.

## Fluxo Socrático

Siga rigorosamente: **IDENTIFY → ANALYZE → PREVIEW → CONFIRM → EXECUTE → REPORT**

### 1. IDENTIFY — Identificar cliente

Buscar pelo nome passado em `$ARGUMENTS` (fuzzy match):

```sql
SELECT id, name, shopify_domain, store_language FROM agency_clients
WHERE name ILIKE '%NOME%' AND shopify_status = 'connected';
```

**Validar que é uma loja EN** (internacional). Se `store_language` não for `en` ou se o domínio não indicar loja internacional, avisar o usuário e perguntar se deseja continuar mesmo assim.

Se houver ambiguidade, perguntar ao usuário qual cliente.

### 2. ANALYZE — Buscar coleções e identificar handles incorretos

Criar e rodar um script `.mjs` **em background** que:

1. Busca todas as coleções (smart + custom)
2. Para cada coleção, compara o handle atual com o handle esperado (gerado a partir do título em inglês)
3. Detecta handles contendo palavras em português ou formatação incorreta
4. Gera relatório JSON com as coleções que precisam de correção

### 3. PREVIEW — Mostrar tabela

Mostrar ao usuário uma tabela:

```
PREVIEW: X de Y coleções precisam de correção de handle

| Tipo   | Título                  | Handle Atual             | Handle Proposto          |
|--------|-------------------------|--------------------------|--------------------------|
| smart  | Brazilian League        | brasileirao              | brazilian-league         |
| custom | National Teams          | selecoes                 | national-teams           |
| ...    | ...                     | ...                      | ...                      |

Smart collections (Z): serão deletadas e recriadas com novo handle (preservando rules, sort_order, disjunctive)
Custom collections (W): serão atualizadas diretamente via PUT
```

### 4. CONFIRM — Pedir confirmação

Perguntar: "Deseja prosseguir com a correção dos handles?"

### 5. EXECUTE — Aplicar correções

Rodar script Node.js em background que:

- **Custom collections**: atualiza o handle diretamente via PUT
- **Smart collections**: Shopify não permite alterar handle de smart collections, então:
  1. Ler TODOS os campos da smart collection (rules, disjunctive, sort_order, title, body_html, image, published, etc.)
  2. Deletar a smart collection original
  3. `delay(500)` entre delete e create
  4. Recriar com os mesmos campos mas com o novo handle

### 6. REPORT — Relatório final

Mostrar: **"Fixed X handles, Y errors"** com detalhes dos erros se houver.

---

## Handle Generation

Função canônica para gerar handles a partir do título em inglês:

```js
function toHandle(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

## Detecção de Handles Incorretos

Um handle precisa de correção se:

1. **Contém palavras em português conhecidas** (ver mapa abaixo)
2. **Contém caracteres acentuados** (ã, é, ç, etc.)
3. **Não corresponde ao `toHandle(title)`** — o handle gerado a partir do título difere do handle atual

### Mapa de Correções Comuns (Português → Inglês)

```js
const PT_TO_EN = {
  'colecao': 'collection',
  'camisa': 'jersey',
  'camisas': 'jerseys',
  'brasileirao': 'brazilian-league',
  'selecoes': 'national-teams',
  'feminino': 'women',
  'feminina': 'womens',
  'infantil': 'kids',
  'lancamentos': 'new-arrivals',
  'todos': 'all',
  'treino': 'training',
  'goleiro': 'goalkeeper',
  'retro': 'retro',
  'manga-longa': 'long-sleeve',
  'conjunto': 'set',
  'shorts': 'shorts',
  'regata': 'tank-top',
  'agasalho': 'jacket',
  'corta-vento': 'windbreaker',
  'polo': 'polo',
  'especial': 'special',
  'edicao-especial': 'special-edition',
  'pre-jogo': 'pre-match',
  'jogador': 'player',
  'torcedor': 'fan'
};
```

## Script Completo

Salvar como arquivo `.mjs` temporário e rodar com `node script.mjs` em background. O script abaixo é o padrão canônico — use-o como base.

**IMPORTANTE:** Ler o `VITE_SUPABASE_ANON_KEY` do arquivo `.env` na raiz do projeto.

```javascript
const https = require('https');
const fs = require('fs');

// --- Config ---
const CLIENT_ID = 'UUID_DO_CLIENTE';
const ENV = fs.readFileSync('.env', 'utf8');
const TOKEN = ENV.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const HOST = 'pxhmzpwvxvlwngjbjkrg.supabase.co';
const API_VERSION = '2026-01';
const DRY_RUN = process.argv.includes('--dry-run');

// --- Helpers ---
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function toHandle(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const PT_WORDS = ['colecao', 'camisa', 'camisas', 'brasileirao', 'selecoes', 'feminino', 'feminina',
  'infantil', 'lancamentos', 'todos', 'treino', 'goleiro', 'manga-longa', 'conjunto',
  'regata', 'agasalho', 'corta-vento', 'especial', 'edicao-especial', 'pre-jogo', 'jogador', 'torcedor'];

function hasPtWords(handle) {
  return PT_WORDS.some(w => handle.includes(w));
}

function hasAccents(handle) {
  return /[àáâãäéèêëíìîïóòôõöúùûüçñ]/.test(handle);
}

function needsFix(handle, title) {
  const expected = toHandle(title);
  return handle !== expected || hasPtWords(handle) || hasAccents(handle);
}

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

// --- Main ---
async function main() {
  console.log('Fetching collections...');

  const [smartRes, customRes] = await Promise.all([
    proxy({ clientId: CLIENT_ID, resource: 'smart_collections', method: 'list_all' }),
    proxy({ clientId: CLIENT_ID, resource: 'custom_collections', method: 'list_all' })
  ]);

  const smartCols = (smartRes.data || []).map(c => ({ ...c, colType: 'smart' }));
  const customCols = (customRes.data || []).map(c => ({ ...c, colType: 'custom' }));
  const allCols = [...smartCols, ...customCols];
  console.log(`Found ${allCols.length} collections (${smartCols.length} smart, ${customCols.length} custom)`);

  // Analyze
  const toFix = [];
  for (const col of allCols) {
    const expected = toHandle(col.title);
    if (needsFix(col.handle, col.title)) {
      toFix.push({
        id: col.id,
        title: col.title,
        currentHandle: col.handle,
        proposedHandle: expected,
        colType: col.colType,
        // Preserve smart collection fields for delete+recreate
        ...(col.colType === 'smart' ? {
          rules: col.rules,
          disjunctive: col.disjunctive,
          sort_order: col.sort_order,
          body_html: col.body_html,
          image: col.image,
          published: col.published
        } : {})
      });
    }
  }

  if (DRY_RUN) {
    console.log(`\n${toFix.length} of ${allCols.length} collections need handle fixes:\n`);
    console.log('Type    | Title                          | Current Handle              | Proposed Handle');
    console.log('--------|--------------------------------|-----------------------------|--------------------------');
    for (const c of toFix) {
      console.log(`${c.colType.padEnd(7)} | ${c.title.padEnd(30)} | ${c.currentHandle.padEnd(27)} | ${c.proposedHandle}`);
    }
    fs.writeFileSync('/tmp/fix-handles-preview.json', JSON.stringify({ total: allCols.length, toFix }, null, 2));
    console.log('\nPreview saved to /tmp/fix-handles-preview.json');
    return;
  }

  // Execute fixes
  let fixed = 0, errors = 0;
  const results = [];

  for (const col of toFix) {
    try {
      if (col.colType === 'custom') {
        // Custom: update handle directly via PUT
        await proxy({
          clientId: CLIENT_ID,
          resource: 'custom_collections',
          method: 'update',
          resourceId: col.id,
          payload: { custom_collection: { handle: col.proposedHandle } }
        });
        fixed++;
        results.push({ title: col.title, status: 'fixed', from: col.currentHandle, to: col.proposedHandle });
        console.log(`FIXED (custom): ${col.title} — ${col.currentHandle} → ${col.proposedHandle}`);

      } else if (col.colType === 'smart') {
        // Smart: delete + recreate with new handle
        // 1. Delete original
        await proxy({
          clientId: CLIENT_ID,
          resource: 'smart_collections',
          method: 'delete',
          resourceId: col.id
        });
        console.log(`DELETED smart: ${col.title} (id: ${col.id})`);

        await delay(500);

        // 2. Recreate with new handle, preserving all fields
        const newCol = {
          smart_collection: {
            title: col.title,
            handle: col.proposedHandle,
            rules: col.rules,
            disjunctive: col.disjunctive || false,
            sort_order: col.sort_order,
            body_html: col.body_html || '',
            published: col.published !== false
          }
        };
        // Only include image if it exists and has a src
        if (col.image && col.image.src) {
          newCol.smart_collection.image = { src: col.image.src, alt: col.image.alt || '' };
        }

        const createRes = await proxy({
          clientId: CLIENT_ID,
          resource: 'smart_collections',
          method: 'create',
          payload: newCol
        });

        if (createRes.error) {
          throw new Error(createRes.error);
        }

        fixed++;
        results.push({ title: col.title, status: 'fixed', from: col.currentHandle, to: col.proposedHandle, method: 'delete+recreate' });
        console.log(`RECREATED smart: ${col.title} — ${col.currentHandle} → ${col.proposedHandle}`);
      }

      await delay(500);

    } catch (err) {
      errors++;
      results.push({ title: col.title, status: 'error', error: err.message });
      console.error(`ERROR: ${col.title} — ${err.message}`);
    }
  }

  // Report
  console.log('\n=== REPORT ===');
  console.log(`Fixed: ${fixed} | Errors: ${errors}`);
  for (const r of results) {
    if (r.status === 'error') console.log(`  ERROR: ${r.title} — ${r.error}`);
    else console.log(`  FIXED: ${r.title} (${r.from} → ${r.to})`);
  }

  fs.writeFileSync('/tmp/fix-handles-report.json', JSON.stringify({ fixed, errors, results }, null, 2));
  console.log('\nFull report saved to /tmp/fix-handles-report.json');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
```

## Modo de Uso

### Fase de Auditoria (sem executar)

1. Ler `.env` para pegar `VITE_SUPABASE_ANON_KEY`
2. Buscar o cliente pelo nome em `agency_clients`
3. Validar que é loja EN (internacional)
4. Salvar o script acima como `.mjs` temporário com `--dry-run`
5. Rodar em background e aguardar
6. Ler o resultado e mostrar preview ao usuário

### Fase de Execução (após confirmação)

1. Rodar o script completo (sem `--dry-run`) em background
2. Aguardar conclusão
3. Mostrar o relatório final: **"Fixed X handles, Y errors"**

## Regras de Ouro

- **SEMPRE** validar que é loja EN antes de prosseguir
- **SEMPRE** mostrar preview (tabela current → proposed) antes de executar
- **NUNCA** executar sem confirmação do usuário
- **Smart collections** devem ser deletadas e recriadas — Shopify não permite alterar handle via API
- Preservar **rules, disjunctive, sort_order, body_html, image, published** ao recriar smart collections
- Usar `delay(500)` entre delete+create de smart collections
- Usar `delay(500)` entre cada operação de fix
- Rodar como script Node.js em background (nunca inline)
- Salvar scripts e reports em `scripts/` ou `/tmp/`

Processe $ARGUMENTS conforme os passos acima.

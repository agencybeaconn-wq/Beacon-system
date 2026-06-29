---
name: fix-handles
description: Corrige handles de coleções em lojas internacionais (EN) que foram gerados em português.
argument-hint: "[nome do cliente]"
---

# Fix Handles (EN stores)

Corrige handles de coleções em loja EN que ficaram em português. Detecta palavras PT, acentos, handles que não batem com título em inglês.

## Fluxo

IDENTIFY → ANALYZE (dry-run) → PREVIEW tabela → CONFIRM → EXECUTE → **PATCH THEME** → REPORT.

1. `agency_clients` por nome + validar `store_language=en` (ou domínio internacional). Se BR: avisar e perguntar se continua mesmo assim
2. Dry-run: lista `current → proposed` por tipo (smart/custom) com contagem total
3. Confirmar → aplicar renames no Shopify
4. **Patch theme JSON** — atualizar `templates/*.json` da loja (Shopify API + cópia local) trocando referências de handles antigos
5. Report: fixed X / errors Y / theme_files_patched Z

## Handle generation

```js
function toHandle(title) {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

## Detecção de "needs fix"

Um handle precisa correção se:
1. Contém palavra PT conhecida (mapa abaixo)
2. Contém acento (ã/é/ç/etc)
3. Não bate com `toHandle(title)` — gerado do título em inglês

## Mapa PT → EN (fillers comuns)

| PT | EN |
|---|---|
| colecao | collection |
| camisa / camisas | jersey / jerseys |
| brasileirao | brazilian-league |
| selecoes | national-teams |
| feminino / feminina | women / womens |
| infantil | kids |
| lancamentos | new-arrivals |
| todos | all |
| treino / goleiro | training / goalkeeper |
| manga-longa | long-sleeve |
| conjunto / regata | set / tank-top |
| agasalho / corta-vento | jacket / windbreaker |
| especial / edicao-especial | special / special-edition |
| pre-jogo | pre-match |
| jogador / torcedor | player / fan |

## Execução (por tipo)

**Custom collections:** PUT direto com novo handle (`/custom_collections/:id.json`)

**Smart collections:** Shopify NÃO deixa mudar handle via update. Processo:
1. Ler todos os campos (rules, disjunctive, sort_order, title, body_html, image, published)
2. DELETE original
3. `delay(500)`
4. CREATE com mesmo conteúdo + novo handle

## ⚠️ Handles críticos — patch automático

Se o handle é referenciado no tema (`templates/*.json` sections), em discounts, ou em menus, renomear quebra. A skill **patcheia o tema automaticamente** no step 4.

**Auto-patch (templates/*.json):** ver função `patchThemeTemplates` abaixo.

**Manual (flag pro colaborador):**
- Discounts BxGy com collection ID → se recriar smart collection, ID muda; o discount precisa ser reconfigurado
- Menus apontando pra `/collections/<handle>` antigo → patchear via Shopify API (Menu mutation), reportar resultado

### Step 4 — patchThemeTemplates(renameMap)

```js
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function patchThemeTemplates(themeDir, renameMap, shopifyApi) {
  // renameMap = { 'brasil': 'brazil', 'alemanha': 'germany', ... }
  const tmplDir = join(themeDir, 'templates');
  const files = (await readdir(tmplDir)).filter(f => f.endsWith('.json'));
  let totalPatches = 0;
  const patched = [];

  for (const file of files) {
    const path = join(tmplDir, file);
    let content = await readFile(path, 'utf-8');
    let patches = 0;

    for (const [oldH, newH] of Object.entries(renameMap)) {
      // Match exato pra evitar substring (brasil ≠ brasileirao, italia ≠ italiano)
      const regex = new RegExp(`"collection":\\s*"${oldH}"`, 'g');
      const before = content;
      content = content.replace(regex, `"collection": "${newH}"`);
      if (content !== before) patches++;
    }

    if (patches > 0) {
      await writeFile(path, content);
      patched.push({ file, patches });
      totalPatches += patches;

      // Subir pro Shopify (tema published) — não só local
      if (shopifyApi) {
        await shopifyApi.putAsset(`templates/${file}`, content);
        await delay(300);
      }
    }
  }

  return { totalPatches, patched };
}
```

**Após o patch:** rodar `lever-theme push` ou subir via Asset API. Report final inclui `theme_files_patched: N`.

## Rate limit

`delay(500)` entre operações. Smart collection delete→create precisa do delay pra propagar.

## Output

Report `/tmp/fix-handles-report.json` com `{ fixed, errors, skipped_critical, theme_files_patched, results[] }`.

## Custo-benefício (memory `feedback_custo_beneficio`)

Antes de aplicar, sempre imprimir:
- Quantos handles vão mudar (custom + smart separados — smart usa delete+create, é lento)
- Tempo estimado: `~600ms × N custom + ~3s × N smart` (delete+delay+create)
- Quantos `templates/*.json` serão patcheados

Padrão de invocação cuidadoso:
```bash
# 1. DRY-RUN primeiro
node fix-handles.mjs "Cliente"
# Imprime: "12 handles a corrigir (4 custom + 8 smart). ~30s. 3 theme files afetados."

# 2. Se quantidade bate com expectativa, --apply
node fix-handles.mjs "Cliente" --apply --expected=12

# 3. Se diff > 30% do esperado, skill aborta sem --force-large
```

Usa `lib/cost-estimate.mjs` quando virar .mjs (hoje é workflow markdown executado pelo Claude diretamente).

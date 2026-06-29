---
name: duplicate-variants
description: Copia o set completo de variantes (tamanhos, personalizar, opções) de um produto "modelo" pra outros produtos. Útil quando sobe camisa nova e quer aplicar o mesmo template de P/M/G/GG/2GG/Personalizar.
argument-hint: [nome cliente] --source=handle-modelo [--targets=h1,h2,h3 | --all-missing] [--dry-run|--apply]
---

# Duplicate Variants

Copia variantes completas (options + variants + prices por combinação) de um produto modelo pra vários alvos.

## Caso de uso

Você subiu 10 camisas novas, mas cada uma só tem variante padrão (single). Quer aplicar o template "PP/P/M/G/GG/2GG/3GG/4GG × Não Personalizar/Personalizar" = 16 variantes cada.

Em vez de criar 160 variantes manualmente, você:
1. Configura UMA camisa modelo com todas as variantes e preços corretos
2. Roda `/duplicate-variants` apontando pra ela e os targets

## Como funciona

1. Fetch `source` product (handle ou ID)
2. Lê `options` (Tamanho, Personalizar) e todas as `variants` (combinações, preços, SKUs vazios, compare_at)
3. Pra cada `target`:
   - Compara options existentes
   - Se target não tem options compatíveis → preview mostra diff, erra se for destrutivo
   - Se compatível → cria variantes faltantes via `productVariantsBulkCreate` mutation
4. Preços seguem template do pricing do cliente (via `calcExpectedPrice` da lib) ou copia iguais do source

## Modos

### `--targets=h1,h2,h3` — alvo explícito

```bash
node duplicate-variants.mjs "Mantos do PH" \
  --source=camisa-brasil-1-26-27 \
  --targets=camisa-argentina-1-26-27,camisa-uruguai-1-26-27 \
  --apply
```

### `--all-missing` — todos produtos sem variantes (1 única "Default")

```bash
# Aplica template em todas as camisas que só têm 1 variante default
node duplicate-variants.mjs "Mantos do PH" --source=camisa-modelo --all-missing
```

### `--category=camisa_torcedor` — filtra alvo por categoria

```bash
node duplicate-variants.mjs "Mantos do PH" --source=camisa-modelo --category=camisa_torcedor
```

## Safety

- **Dry-run padrão** — lista as variantes que seriam criadas
- **Não deleta variantes existentes**, só adiciona as que faltam
- **Preços**: usa pricing do banco do cliente (via lib) pra calcular cada variante — não copia cegamente do source
- **Idempotente**: rodar 2x não duplica as mesmas variantes (checa existência por option combo)

## Regra `compare_at = price × 2` (memory `feedback_compare_at_2x_rule`)

Toda variante criada pela skill deve ter `compare_at_price = price × 2` **EXCETO**:
- Variantes de **Personalização** (option `Personalizar=Com Personalização`) → `compare_at_price = null` (preço do extra, não do produto)
- Variantes de **Patches** (em produtos virtual de patch) → `compare_at_price = null`

Implementação:
```js
function computeCompareAt(price, optionValueMap) {
  const isPers = (optionValueMap['Personalizar'] || '').toLowerCase().includes('com');
  const isPatch = String(optionValueMap['Tipo'] || '').toLowerCase().includes('patch');
  if (isPers || isPatch) return null;
  return Math.round(price * 2 * 100) / 100; // 2 casas decimais
}
```

A skill **bloqueia** se detectar `compare_at` < `price` ou se source tem compare_at fora do padrão (avisa antes de copiar).

## Gaps conhecidos

- Não lida com `option3` (ainda só suporta Tamanho + Personalizar)
- Não aplica imagens de variante (image_id por variante) — usa a do produto

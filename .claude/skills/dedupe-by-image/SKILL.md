# dedupe-by-image — detecta produtos duplicados via similaridade de imagem

Complementa `dedupe-products` (que só compara handle/title). Esta skill pega a **primeira imagem** de cada produto, calcula um **dHash** (perceptual hash) via Jimp, e agrupa produtos com Hamming distance < threshold.

Use quando: dois produtos têm TÍTULOS DIFERENTES mas são a MESMA CAMISA (typo, reordering de palavras, idioma diferente). Ex.:
- "Jersey Nike Woman Brasil 2026/27 World Cup II" vs "Jersey Woman Brazil 2026 Worldcup Nike II - Blue"

## Uso

```bash
# DRY-RUN — só reporta grupos
node .claude/skills/dedupe-by-image/dedupe-by-image.mjs "Cliente"

# Threshold custom (default 6 — quanto menor, mais estrito)
node .claude/skills/dedupe-by-image/dedupe-by-image.mjs "Cliente" --threshold=4

# APLICA (delete duplicatas, keeper = produto mais antigo de cada grupo)
node .claude/skills/dedupe-by-image/dedupe-by-image.mjs "Cliente" --apply
```

## Como funciona

1. Lista todos produtos via REST `/admin/api/.../products.json?fields=id,title,handle,created_at,images`
2. Pra cada produto, pega a 1ª image URL
3. Download em paralelo (concurrency 10, delay 200ms)
4. Resize 9x8 grayscale via Jimp
5. dHash: pra cada linha, 8 bits comparando pares horizontais (`pixel[x] > pixel[x+1]`)
6. 64-bit hash por produto
7. Compara TODOS pares — agrupa quando Hamming < threshold
8. Reporta grupos, keeper = `created_at` mais antigo

## Custo

- ~5000 produtos = ~5000 downloads de imagem (cada ~10-50KB)
- ~10-15min total (depende de network + CPU pra hashing)
- API Shopify: ~22 calls (paginação produtos)

## Quando NÃO usar

- Loja com <500 produtos: dedupe por title já dá conta
- Imagens são placeholders genéricos (mesma foto pra todos): vai dar falso positivo

## Output

JSON em `.claude/skills/dedupe-by-image/.tmp_image_dedupe_plan.json` com grupos detectados, hashes, e plan de delete (se `--apply` for usado).

Print pro console: até 20 grupos com produto keeper + duplicates.

## Threshold guidance

- `< 3`: mesma imagem exata (mudou só compressão)
- `3-6`: muito similar (mesma camisa, ângulo levemente diferente)
- `7-10`: similar mas suspeito (pode ser camisa diferente do mesmo time)
- `> 10`: provavelmente diferentes

Default 6 = boa zona pra detectar duplicatas reais sem muito ruído.

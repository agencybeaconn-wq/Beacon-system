---
name: batch-images
description: Gerencia imagens de produtos em massa — reordenar, trocar principal, remover duplicadas, aplicar template de ordem (frente, costas, detalhe, modelo) em muitos produtos de uma categoria.
argument-hint: [nome cliente] [--reorder=template|alphabetical] [--category=X] [--replace-from=source-handle] [--apply]
---

# Batch Images

Operações em lote sobre as imagens dos produtos.

## Problema

Cliente tem 50 camisas mas a ordem das fotos tá zoada — algumas começam com a foto das costas, outras com modelo posado. Quer padronizar: **frente → costas → detalhe → modelo**.

Ou: trocar a foto principal de todas as camisas da Seleção Brasileira pela versão nova enviada.

## Operações disponíveis

### 1. Reordenar por template (`--reorder=template`)

Tenta classificar cada imagem por heurística (nome do arquivo + posição + metadados) em:
- **frente** (keyword: "front", "frente", "1", "principal")
- **costas** (keyword: "back", "costas", "2")
- **detalhe** (keyword: "detail", "detalhe", "zoom", "close")
- **modelo** (keyword: "model", "modelo", "pessoa", arquivo com .jpg vs .png)

Depois reordena pra sempre frente → costas → detalhe → modelo.

### 2. Reordenar alfabético (`--reorder=alphabetical`)

Por nome de arquivo. Útil quando os arquivos já tão nomeados certo.

### 3. Trocar foto principal (`--set-primary=N`)

Define a variante N como principal (position: 1).

### 4. Substituir imagens de um produto (`--replace-from=handle`)

Pega TODAS as imagens do produto modelo e substitui no target (mantém variantes, só troca media).

### 5. Remover duplicadas (`--dedupe-images`)

Detecta imagens com mesmo hash (via `src` URL ou tamanho) e remove repetidas.

## Exemplos

```bash
# Reordenar template em todas as camisas torcedor da loja
node batch-images.mjs "Mantos do PH" --reorder=template --category=camisa_torcedor --dry-run

# Trocar fotos do modelo Brasil pelas novas (todos os kits)
node batch-images.mjs "Mantos do PH" --replace-from=camisa-brasil-1-26-27-nova --targets=camisa-brasil-2-26-27,camisa-brasil-3-26-27

# Dedupe geral da loja
node batch-images.mjs "Mantos do PH" --dedupe-images --apply
```

## Safety

- **Dry-run padrão** — mostra plano (antes/depois de cada produto)
- **Backup**: salva lista de imagens originais em `.tmp_images_backup_{client}_{ts}.json` antes de mexer
- **Rate-limited**: 600ms entre chamadas (Shopify 429 a 6 req/s)

## Gaps conhecidos

- Não sobe imagens novas (só reordena as existentes do produto)
- Detecção de "frente/costas" é heurística, pode errar em ~10% — sempre dry-run antes

---
name: bulk-descriptions
description: Altera descrições de produtos em massa. Suporta find/replace, append/prepend HTML, e template por categoria (toda camisa torcedor ganha mesma descrição padrão com placeholders do briefing). Usa bulk operation pra velocidade.
argument-hint: [nome do cliente] [--apply] [--find=... --replace=...] [--template] [--append=... | --prepend=...]
---

# bulk-descriptions — Altera descrições em massa

Atualiza o campo `body_html` (descrição) de produtos Shopify em massa.

## Quando usar

- Cliente novo precisa de descrições padronizadas por categoria (toda camisa torcedor com mesma estrutura)
- Find/replace em descrições (ex: trocar "Camisa oficial" por "Camisa autêntica")
- Adicionar informações padrão no fim de toda descrição (ex: "Frete grátis acima de R$129")
- Limpar HTML antigo em massa

## Triggers (linguagem natural)

- "alterar descrições"
- "padronizar descrições"
- "trocar X por Y nas descrições"
- "adicionar padding nas descrições"
- "aplicar template de descrição"

## Modos de operação

### 1. Find/Replace
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" \
  --find="Camisa oficial" --replace="Camisa autêntica" --apply
```

### 2. Append (adiciona no fim)
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" \
  --append="<p><strong>Frete grátis acima de R$129</strong></p>" --apply
```

### 3. Prepend (adiciona no início)
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" \
  --prepend="<p>Produto oficial licenciado</p>" --apply
```

> **Regra Lever:** ZERO emojis em descrições. A skill valida `--append`, `--prepend`, `--set`, `--replace` e bloqueia se detectar emoji. Use `{% render 'icon-*' %}` no template do tema, não emoji em HTML.

### 3b. Set (sobrescreve body_html inteiro com o mesmo HTML em todos os produtos)
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "Foot Mania" \
  --set='<p><img src="https://cdn.shopify.com/.../LP.webp" alt=""></p>' --apply
```
Útil pra: reset de loja nova, campanha com imagem única, padronizar visual em cliente novo.

### 4. Template por categoria (padrão Lever)
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" \
  --template --apply
```
- Usa `.claude/skills/bulk-descriptions/templates/<lang>-<category>.md`
- Categorias: `camisa_torcedor`, `camisa_jogador`, `camisa_retro`, `camisa_manga_longa`, `conjunto_infantil`, `agasalho_viagem`, `conjunto_treino`, `jaqueta`, `moletom`, `short`
- Lê briefing do cliente pra placeholders: `{{client_name}}`, `{{product_title}}`, `{{team_name}}`, `{{year}}`, `{{support_email}}`, `{{shipping_min_value}}`

Se um produto não bate com nenhuma categoria, é skipado.

### 5. Filtro por categoria (opcional)
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" \
  --find="R$129" --replace="R$149" --category=camisa_torcedor --apply
```
Aplica só em produtos da categoria especificada.

### 6. Só em produtos sem descrição (opcional)
```bash
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" \
  --template --only-empty --apply
```
Aplica só em produtos com `body_html` vazio (útil pra preencher do zero sem sobrescrever o que cliente já ajustou).

## Protocolo

VALIDATE → FETCH → DETECT changes → PREVIEW → CONFIRM → BULK APPLY → LOG

- **Dry-run default**: nunca aplica sem `--apply`
- **Preview**: mostra 3 exemplos de antes/depois
- **Bulk operation** via `runBulkMutation` (1-2 min pra 1000+ produtos)

## Background-safe

- Bulk operations são atômicas (1-shot), não precisam checkpoint granular
- SIGINT fecha limpo e imprime status atual

## Verificação

```bash
# Antes
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" --template
# → Preview: 611 produtos camisa_torcedor, 178 retro, etc

# Apply
node .claude/skills/bulk-descriptions/bulk-descriptions.mjs "De Boleiro" --template --apply

# Depois: abrir 1 produto no admin e verificar descrição
```

## Limitações

- Só mexe em `body_html` (descrição) — não muda title, vendor, tags
- Template mode usa markdown convertido pra HTML simples (headers, bold, listas, links)
- Não preserva formatação complexa (tables com colspan, iframes, etc) — find/replace é mais conservador

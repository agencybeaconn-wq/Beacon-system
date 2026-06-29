---
client_id: TBD
name: Lucky Fours
shopify_domain: luckyfours.com
status: scraped-pending-import
template: none
tags: [client, watches, en, scraped]
created: 2026-04-25
source_origin: scraper
---

# ⌚ Lucky Fours

> Loja de relógios scrapeada de https://luckyfours.com — pronta pra import numa dev store.

## 🔗 Links rápidos

- [Storefront origem](https://luckyfours.com)
- Dados scrapeados: [`clients/lucky-fours/`](./lucky-fours/)
- Scraper original: `/Users/joaovithorbauer/Downloads/Lucky Fours/scrape_luckyfours.py`

## 📋 Estado atual

- **Origem**: scrape via Shopify `/products.json` público (sem credenciais OAuth)
- **Destino**: dev store Shopify Partners (a criar)
- **Fluxo de transferência**: Partners → cliente final
- **Template Lever**: nenhum (loja é EN, vertical relógios — fora dos templates BR/EN canônicos)

## 📦 Dados disponíveis em `clients/lucky-fours/`

| Arquivo | Conteúdo |
|---------|----------|
| `products.csv` | 74 produtos / 759 linhas — formato Shopify export, pronto pra `import-from-csv` |
| `collections.csv` | 15 coleções (Mens, Womens, Sport, Quartz, Automatic, BOGO, etc) |
| `collects.csv` | 392 mapeamentos produto↔coleção, com posição |
| `raw/products.json` | Dump cru pra re-rodar transformações sem bater no site |
| `raw/collections.json` | Dump cru das coleções |

## 🛠 Como importar

### 1. Cadastrar a dev store em `agency_clients`
Via UI do Lever System (Conexões > Adicionar cliente > conectar Shopify OAuth) ou direto no Supabase. Domínio: `<dev-store>.myshopify.com`.

### 2. Importar os produtos
```bash
# DRY-RUN
node .claude/skills/import-missing/import-from-csv.mjs "Lucky Fours" \
  --csv=clients/lucky-fours/products.csv

# APPLY
node .claude/skills/import-missing/import-from-csv.mjs "Lucky Fours" \
  --csv=clients/lucky-fours/products.csv --apply
```

### 3. Criar coleções e mapeamentos
A skill `import-from-csv` só cria produtos. Pra coleções + collects, usar:
- App **Matrixify** (importa `collections.csv` + `collects.csv` direto), OU
- Criar 15 coleções manualmente no admin Shopify (são poucas), OU
- Estender este flow com um script que lê `collects.csv` e cria custom_collections + collects via REST.

### 4. Transferir via Partners
Após validar a loja: Partners Dashboard > Transfer ownership > email do cliente.

## ⚠️ Observações

- **Pricing**: o `import-from-csv` aplica `client_pricing` do cliente alvo. Como Lucky Fours **não tem** `client_pricing` configurado, ele cai no `v.price` do CSV (o preço original da Lucky Fours). Se quiser markup automático, configurar `client_pricing` antes.
- **Vendor**: produtos vêm com vendor `Lucky Fours` (do scrape). Se quiser trocar pelo nome do cliente final, rodar `update-vendor` ou editar o CSV antes.
- **Imagens**: hospedadas no CDN Shopify da loja origem (`cdn.shopify.com/s/files/1/0758/5333/2777/...`). Shopify destino baixa do CDN durante import (server-side). Se a loja origem cair, refazer scrape antes.
- **74 produtos** é volume baixo — `import-from-csv` deve resolver em <2 min. Pra volumes maiores usar `bulk-deploy-products`.

## 📝 Re-scraping

Se a loja origem mudar, refazer:
```bash
cd "/Users/joaovithorbauer/Downloads/Lucky Fours"
python3 scrape_luckyfours.py
cp output/*.csv clients/lucky-fours/  # copiar de volta pra cá
```

---

*Editável diretamente no Obsidian. Claude Code lê esse arquivo e usa como contexto.*

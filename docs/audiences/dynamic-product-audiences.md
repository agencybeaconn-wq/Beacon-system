# Públicos de Produtos Dinâmicos (Dynamic Product Audiences)

Criação de públicos baseados em intenção de compra (sinais de app e site) para Anúncios de Catálogo Advantage+.

## 1. Configuração de Sinais de Usuário

### Eventos de App (Mobile)
Requer SDK do Facebook ou MMP.
- **Eventos Obrigatórios:** `Search`, `ViewContent`, `AddToCart`, `Purchase`.
- **Parâmetros:** `content_id` (ou `content` array), `content_type`, `currency`, `value`.
- **MMPs:** Devem mapear eventos para `fb_mobile_search`, `fb_mobile_content_view`, etc.

### Eventos de Site (Pixel)
- **Eventos:** `Search`, `ViewCategory`, `ViewContent`, `AddToCart`, `Purchase`.
- **Parâmetros Críticos:**
    - `content_ids` ou `contents`: IDs dos produtos.
    - `content_type`: `product` (variante específica) ou `product_group` (grupo de variantes).

> **Dica:** Use `content_type: product` sempre que possível para recomendações mais precisas (cor/tamanho exatos).

## 2. Associação com Catálogo
É necessário vincular o Pixel e o App ao Catálogo para que a Meta possa cruzar os IDs dos eventos com os produtos.

```bash
curl -F 'external_event_sources=["<PIXEL_ID>","<APP_ID>"]' \
     -F 'access_token=<ACCESS_TOKEN>' \
     https://graph.facebook.com/v24.0/<PRODUCT_CATALOG_ID>/external_event_sources
```

## 3. Criação de Público de Produto (`/product_audiences`)

Cria públicos dinâmicos (ex: "Viu ou Adicionou ao Carrinho mas não Comprou").

### Endpoint
```bash
POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/product_audiences
```

### Parâmetros
- **`product_set_id`**: ID do conjunto de produtos (Product Set) a ser usado.
- **`inclusions`**: Regras para incluir usuários (ex: `ViewContent`, `AddToCart`).
- **`exclusions`**: Regras para excluir usuários (ex: `Purchase`).

### Exemplo: Retargeting Clássico (Viu/AddCart - Comprou)
```bash
curl -X POST \
  -F 'name="Retargeting - View/Cart not Purchase"' \
  -F 'product_set_id="<PRODUCT_SET_ID>"' \
  -F 'inclusions=[
       { "retention_seconds": 86400, "rule": { "event": { "eq": "AddToCart" } } },
       { "retention_seconds": 72000, "rule": { "event": { "eq": "ViewContent" } } }
     ]' \
  -F 'exclusions=[
       { "retention_seconds": 172800, "rule": { "event": { "eq": "Purchase" } } }
     ]' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/product_audiences
```

### Lógica de Exclusão
Se um usuário compra o produto B, e a regra exclui `Purchase`:
- Se A e B estão no mesmo `product_group`: O usuário é excluído de anúncios para A e B.
- Se A e B são grupos diferentes: O usuário ainda pode ver anúncios para A (se tiver visto A).

## 4. Recuperação
```bash
GET https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences?fields=data_source,subtype
```

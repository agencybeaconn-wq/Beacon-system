# Públicos Personalizados de App para Celular

Criação de públicos baseados em ações realizadas no aplicativo (instalação, compra, nível alcançado, etc.).

## Visão Geral
Utiliza eventos registrados via **Facebook SDK**, **App Events API** ou **MMPs** (Mobile Measurement Partners).
- **Exemplos:** "Comprou nos últimos 30 dias", "Adicionou ao carrinho mas não comprou", "Usuários Top 20% em gastos".

## Criação de Público

### Requisitos
- Permissão de Administrador, Desenvolvedor ou Anunciante na conta de anúncios.
- Conta de anúncios associada ao aplicativo nas configurações.
- Aceite dos Termos de Serviço de Públicos Personalizados.

### Endpoint
```bash
POST https://graph.facebook.com/v24.0/act_<AD_ACCOUNT_ID>/customaudiences
```

### Parâmetros
- **`name`**: Nome do público.
- **`rule`**: Regra JSON definindo os critérios (veja abaixo).
- **`prefill`**: `1` para incluir usuários passados que atendem aos critérios.
- **`retention_days`**: Dias de retenção (1 a 180). Se um usuário realizar o evento novamente, o tempo é renovado.

## Regras de Público de App

### Estrutura Básica
```json
{
  "inclusions": {
    "operator": "or",
    "rules": [
      {
        "event_sources": [{ "id": "<APP_ID>", "type": "app" }],
        "retention_seconds": 2592000, // 30 dias
        "filter": { ... }
      }
    ]
  }
}
```

### Exemplos de Filtros

#### 1. Evento Padrão (Compra)
```json
"filter": {
  "operator": "and",
  "filters": [
    { "field": "event", "operator": "eq", "value": "fb_mobile_purchase" }
  ]
}
```

#### 2. Evento Personalizado com Parâmetros
Evento `timeOnPanel` > 30, cor "red" ou "blue", sobremesa favorita contém "banana".
```json
"filter": {
  "operator": "and",
  "filters": [
    { "field": "event", "operator": "eq", "value": "timeOnPanel" },
    { "field": "_value", "operator": ">", "value": 30 },
    { "field": "color", "operator": "is_any", "value": ["red", "blue"] },
    { "field": "favoriteDessert", "operator": "contains", "value": "banana" }
  ]
}
```

#### 3. Agregação (Top 25% Compradores)
```json
"aggregation": {
  "type": "count",
  "method": "percentile",
  "operator": "in_range",
  "from": 75,
  "to": 100
}
```

#### 4. Exclusão (Abandonou Carrinho)
Inclui `add_to_cart` e exclui `fb_mobile_purchase`.
```json
{
  "inclusions": { ... rules for add_to_cart ... },
  "exclusions": { ... rules for fb_mobile_purchase ... }
}
```

## Introspecção de Eventos (`/app_event_types`)
Para descobrir quais eventos e parâmetros seu app está enviando e que podem ser usados nas regras.

```bash
GET https://graph.facebook.com/v24.0/<APP_ID>/app_event_types
```

## Limitações iOS 14.5+
- **SKAdNetwork:** Públicos de inclusão não suportados em campanhas SKAdNetwork.
- **Conexões de App:** Novas campanhas de instalação para iOS 14.5+ não podem usar direcionamento por conexões.
